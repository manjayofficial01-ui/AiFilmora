vec3 rgb2xyz (vec3 rgb) {
  rgb.rgb = rgb.bgr;
  float r = rgb.r;
  float g = rgb.g;
  float b = rgb.b;
  float x = (r * 0.4124564) + (g * 0.3575761) + (b * 0.1804375);
  float y = (r * 0.2126729) + (g * 0.7151522) + (b * 0.0721750);
  float z = (r * 0.0193339) + (g * 0.1191920) + (b * 0.9503041);
  vec3 xyz = vec3(x,y,z)/vec3(0.95047,1.0,1.08883);
  return (xyz);
}

float f(float t){
  if(t > 0.00885645167){
    return pow(t, 1.0/3.0);
  }else{
    return 7.787037037*t+0.13793103448;
  }
}

vec3 xyz2lab (vec3 xyz) {
  float x = f(xyz.x);
  float y = f(xyz.y);
  float z = f(xyz.z);
  /*
  L:[0.0,   100.0]->[0.0, 1.0]
  A:[-127.0,127.0]->[0.0, 1.0]
  B:[-127.0,127.0]->[0.0, 1.0]
  */
  vec3 lab = vec3(((116.0 * y) - 16.0)/100.0, (500.0 * (x - y)+127.0)/255.0, (200.0 * (y - z)+127.0)/255.0);
  return (lab);
}

vec3 rgb2lab(vec3 rgb){
  return xyz2lab(rgb2xyz(rgb));
}

vec4 GetRealTensor(vec4 tensor){
  if(tensor.z == 0.0){
    tensor.x *= -1.0;
  }
  if(tensor.w == 0.0){
    tensor.y *= -1.0;
  }
  return tensor;
}

vec4 get_oabf(vec2 uv, int pass){
  vec4 tfm = GetRealTensor(INPUT2(uv));
  vec3 tangent = tfm.xyz;
  vec3 t = (pass == 0) ? vec3(tangent.y, -tangent.x, 0.) : tangent;
  float sigma_d = PREFIX(sigma_d);
  float sigma_r = PREFIX(sigma_r)/100.0;
  if(abs(t.x) >= abs(t.y)){
    if(t.x == 0.0) t.y = 0.0;
    else t.y = t.y / t.x;
    t.x = 1.;
    t.z = 0.;
  }else{
    if(t.y == 0.0) t.x = 0.0;
    else t.x = t.x / t.y;
    t.y = 1.;
    t.z = 0.;
  }
  vec4 center = INPUT1(uv);
  vec3 sum = vec3(0);
  sum.x = center.x;
  sum.y = center.y;
  sum.z = center.z;
  float norm = 1.0;
  float halfWidth = clamp(2.0 * sigma_d, 2.0, 6.0);
  for(float d = 1.; d <= halfWidth; d+=1.0){
    float uxn = uv.x + d * t.x / iResolution.x;
    float uyn = uv.y + d * t.y / iResolution.y;
    float uxp = uv.x - d * t.x / iResolution.x;
    float uyp = uv.y - d * t.y / iResolution.y;

    vec4 c0 = INPUT1(vec2(uxn, uyn));
    vec4 c1 = INPUT1(vec2(uxp, uyp));

    float e0 = sqrt(pow(c0.x-center.x, 2.0) + pow(c0.y-center.y, 2.0) + pow(c0.z-center.z, 2.0));
    float e1 = sqrt(pow(c1.x-center.x, 2.0) + pow(c1.y-center.y, 2.0) + pow(c1.z-center.z, 2.0));
    float kerneld  = exp(-(d*d) / (2.0*sigma_d*sigma_d));
    float kernele0 = exp(-(e0*e0) / (2.0*sigma_r*sigma_r));
    float kernele1 = exp(-(e1*e1) / (2.0*sigma_r*sigma_r));

    norm += kerneld * kernele0;
    norm += kerneld * kernele1;

    sum.x += kerneld * kernele0 * c0.x;
    sum.y += kerneld * kernele0 * c0.y;
    sum.z += kerneld * kernele0 * c0.z;

    sum.x += kerneld * kernele1 * c1.x;
    sum.y += kerneld * kernele1 * c1.y;
    sum.z += kerneld * kernele1 * c1.z;
  }
  sum.x /= norm;
  sum.y /= norm;
  sum.z /= norm;
  return vec4(sum, center.w);
}

vec4 FUNCNAME(vec2 tc) {
  int iteration = PREFIX(iteration); 
  if(iteration == 0){
    vec4 src = INPUT1(tc);
    return vec4(rgb2lab(src.rgb),src.a);
  }else{
    int pass = PREFIX(pass);
    return get_oabf(tc,pass);
  }
}