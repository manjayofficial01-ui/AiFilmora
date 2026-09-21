vec4 GetRealTensor(vec4 tensor){
  if(tensor.z == 0.0){
    tensor.x *= -1.0;
  }
  if(tensor.w == 0.0){
    tensor.y *= -1.0;
  }
  return tensor;
}

vec4 convert2Gray(vec4 color){
  float gray = dot(color.rgb, vec3(0.114, 0.587, 0.299));
  return vec4(vec3(gray), color.a);
}

float sinhFunc(float x){
  return (exp(x)-exp(-x))/2.0;
}
float coshFunc(float x){
  return (exp(x)+exp(-x))/2.0;
}

float tanhFunc(float x){
  return sinhFunc(x)/coshFunc(x);
}

vec4 run_fdog_0(vec2 uv){
  float sigma_e = PREFIX(fdog_sigma_e);
  float sigma_r = sigma_e*PREFIX(fdog_sigma_r)*iResolution.x/512.0;
  float tau = PREFIX(fdog_tau);

  float twoSigmaESquared = 2.0 * sigma_e * sigma_e;
  float twoSigmaRSquared = 2.0 * sigma_r * sigma_r;
  vec3 t = GetRealTensor(INPUT3(uv)).xyz;
  vec3 n = vec3(t.y, -t.x, 0.0);
  float m = sqrt(n.x*n.x+n.y*n.y);
  if (abs(n.x) >= abs(n.y)){
    if(n.x == 0.0) n.y = 0.0;
    else n.y = n.y / n.x;
    n.x = 1.;
    n.z = 0.;
  } else{
    if(n.y == 0.0) n.x = 0.0;
    else n.x = n.x / n.y;
    n.y = 1.; 
    n.z = 0.;
  }
  
  vec4 ht = INPUT1(uv);
  vec3 sum = vec3(ht.x, ht.x, 0.0); 
  vec3 norm = vec3(1.0, 1.0, 0.0);
  float halfWidth = clamp(2.0*sigma_r, 2.0, 4.0);
  for (float d = 1.0; d <= halfWidth; d+=1.0){
    vec3 kernel = vec3( exp( -d * d / twoSigmaESquared), 
                        exp( -d * d / twoSigmaRSquared), 0.);
    norm.x += 2.0 * kernel.x;
    norm.y += 2.0 * kernel.y;
    vec4 L0 =  INPUT1(uv-vec2(d*n.x, d*n.y)/iResolution.xy);
    vec4 L1 =  INPUT1(uv+vec2(d*n.x, d*n.y)/iResolution.xy);
    L0.y = L0.x;
    L1.y = L1.x;

    sum.x += kernel.x * ( L0.x + L1.x);
    sum.y += kernel.y * ( L0.y + L1.y);
  }
  sum.x /= norm.x;
  sum.y /= norm.y;
  float diff = 100.0*(sum.x - tau * sum.y);
  if(diff < 0.0){
    return vec4(vec2(abs(diff)), 0.0, ht.w);
  }else{
    return vec4(vec2(diff), 1.0, ht.w);
  }
}

vec4 GetRealValue(vec4 col){
  if(col.z == 0.0){
    return vec4(vec3(-col.x),col.w);
  }else{
    return vec4(vec3(col.x),col.w);
  }
}

vec4 run_fdog_1(vec2 uv){
  float sigma_m = PREFIX(fdog_sigma_m)/100.0;
  float phi = PREFIX(fdog_phi);

  float twoSigmaMSquared = 2.0 * sigma_m * sigma_m;
  float halfWidth = clamp(2.0*sigma_m, 2.0, 4.0);

  vec3 t = GetRealTensor(INPUT3(uv)).xyz;
  vec3 n = vec3(t.x,t.y,0.0);
  if (abs(n.x) >= abs(n.y)){
    if(n.x == 0.0) n.y = 0.0;
    else n.y = n.y / n.x;
    n.x = 1.;
    n.z = 0.;
  } else{
    if(n.y == 0.0) n.x = 0.0;
    else n.x = n.x / n.y;
    n.y = 1.;
    n.z = 0.;
  }
  vec4 ht = GetRealValue(INPUT2(uv));
  float sum = ht.x; 
  float norm = 1.0;
  if(sigma_m != 0.0){
    for (float d = 1.0; d <= halfWidth; d+=1.0){
      float kernel = exp( -d * d / twoSigmaMSquared);
      norm += 2.0 * kernel;   
      vec4 L0 =  GetRealValue(INPUT2(uv-vec2(d*n.x, d*n.y)/iResolution.xy));
      vec4 L1 =  GetRealValue(INPUT2(uv+vec2(d*n.x, d*n.y)/iResolution.xy));
      sum += kernel * ( L0.x + L1.x );
    }
  }
  sum /= norm;
  float edge = ( sum > 0.0 )? 1.0 : 1.0+tanhFunc(phi*sum);
  return vec4(vec3(edge),1.0);  
}

vec4 FUNCNAME(vec2 tc) {
  int pass = PREFIX(pass);
  if(pass == 0){
    return run_fdog_0(tc);
  }else if(pass == 1){ 
    return run_fdog_1(tc);
  }
  return vec4(1.0);
}