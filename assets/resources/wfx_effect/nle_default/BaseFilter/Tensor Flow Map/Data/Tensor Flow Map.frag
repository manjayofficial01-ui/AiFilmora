
vec3 Sample(vec2 uv, vec2 offset){
  float factor = max(iResolution.x, iResolution.y) / 433.0;
  vec4 color = INPUT(uv + (offset / iResolution.xy));
  return color.xyz;
}

vec4 computeStructureTensors(vec2 uv){
  // Sobel
  vec3 tl = Sample(uv, vec2(-1.0, 1.0));
  vec3 tc = Sample(uv, vec2(0.0, 1.0));
  vec3 tr = Sample(uv, vec2(1.0, 1.0));
  
  vec3 l  = Sample(uv, vec2(-1.0, 0.0));
  vec3 c  = Sample(uv, vec2(0.0, 0.0));
  vec3 r  = Sample(uv, vec2(1.0, 0.0));
  
  vec3 bl = Sample(uv, vec2(-1.0, -1.0));
  vec3 bc = Sample(uv, vec2(0.0, -1.0));
  vec3 br = Sample(uv, vec2(1.0, -1.0));
  
  vec3 dx = (tl - tr + 2.0 * l - 2.0 * r + bl - br) / 4.0;
  vec3 dy = (-tl - 2.0 * tc - tr + bl + 2.0 * bc + br) / 4.0;
  float E = dx.r*dx.r + dx.g*dx.g + dx.b*dx.b;
  float F = dx.r*dy.r + dx.g*dy.g + dx.b*dy.b;
  float G = dy.r*dy.r + dy.g*dy.g + dy.b*dy.b;
  float m = sqrt(E*E+F*F+G*G);
  vec3 EFG = vec3(E,abs(F),G);
  if(m>0.0){
    EFG /= m;
  }
  if(F<0.0){
    return vec4(EFG,0.0);
  }else{
    return vec4(EFG,1.0);
  }
}

float normpdf(float x, float sigma) {
  return 0.39894 * exp(-0.5 * x * x/ (sigma * sigma)) / sigma;
}

vec4 computeSmoothStructureTensors(vec2 uv, float tensor_sigma){
  const int mSize = 5; // 9
  const int kSize = (mSize-1)/2;
  float kernel[mSize];

  for (int j = 0; j <= kSize; ++j){
    kernel[kSize+j] = kernel[kSize-j] = normpdf(float(j), tensor_sigma);
  }
  float wight = 0.0;
  for (int j = 0; j < mSize; ++j){
    wight += kernel[j];
  }
  vec3 ret = vec3(0.0);
  for (int i=-kSize; i <= kSize; ++i){
    for (int j=-kSize; j <= kSize; ++j){
      vec2 tc = uv+vec2(i,j)/iResolution.xy;
      vec4 inCol = INPUT(tc);
      if(inCol.w == 0.0){
        inCol.y *= -1.0;
      }
      vec3 EFG = inCol.xyz;
      ret += kernel[kSize+j]*kernel[kSize+i]*EFG;
    }
  }
  ret /= wight*wight;
  return vec4(ret,1.0);
}

vec4 FUNCNAME(vec2 tc) 
{
  float tensor_sigma = PREFIX(tensor_sigma);
  int getEFG = PREFIX(GetEFG);
  if(getEFG == 0){
    vec4 StructureTensors = computeStructureTensors(tc);
    return StructureTensors;
  }else if(getEFG == 1){
    vec4 EFG = computeSmoothStructureTensors(tc, tensor_sigma);
    float E = EFG.x;
    float F = EFG.y;
    float G = EFG.z;

    float det = sqrt(pow(E-G,2.0)+4.*F*F);
    vec2 v = vec2((E-G-det)*0.5,F);
    float m = sqrt(v.x*v.x+v.y*v.y);
    vec4 ret = vec4(0.0, 1.0, 1.0, 1.0);
    if(m > 0.0){
      v.x /= m;
      v.y /= m;
      float symbol_x = 1.0;
      float symbol_y = 1.0;
      if(v.x < 0.0)
        symbol_x = 0.0;
      if(v.y < 0.0)
        symbol_y = 0.0;
      ret = vec4(abs(v.x), abs(v.y), symbol_x, symbol_y);
    }
    return ret;
  }
}
