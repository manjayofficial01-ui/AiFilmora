
float normpdf(float x, float sigma) {
  return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
}

float normpdf3(vec3 v, float sigma) {
  return 0.39894*exp(-0.5*dot(v,v)/(sigma * sigma))/sigma;
}

vec4 FUNCNAME(vec2 tc){
  int   radius = PREFIX(uEclosion)/2;
  float uHorizontal = float(PREFIX(uHorizontal));
  vec2  viewSize = iResolution.xy;
  vec4  inCol = INPUT(tc);
  float sigma = 10.0;
  float sigma3 = 0.1;
  float sumFactor = 0.0;
  vec3  sumColor = vec3(0.0);
  for(int i=-radius;i<radius;i++){
    vec2 uv = tc+mix(vec2(0.0, float(i)/viewSize.y), vec2(float(i)/viewSize.x, 0.0), uHorizontal);
    vec3 temp = INPUT(uv).xyz;
    float factor = normpdf3(temp-inCol.xyz, sigma3)*normpdf(float(i), sigma);
    sumFactor += factor;
    sumColor += factor*temp;
  }
  return vec4(sumColor/sumFactor, inCol.w);
}
