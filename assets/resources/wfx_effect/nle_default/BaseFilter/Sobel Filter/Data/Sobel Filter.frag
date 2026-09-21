
vec3 GetValue(vec2 uv) {
  int gray = PREFIX(gray);
  if(gray == 1){
    return vec3(dot(INPUT(uv).xyz, vec3(0.114, 0.587, 0.299)));
  }else{
    return INPUT(uv).xyz;
  }
}

float CalcSobelVal(mat3 I) {
  float gx = dot(vec3(1.0, 2.0,  1.0), I[0]) + dot(vec3(-1.0, -2.0, -1.0), I[2]); 
  float gy = dot(vec3(1.0, 0.0, -1.0), I[0]) + dot(vec3(2.0, 0.0, -2.0), I[1]) + dot(vec3( 1.0,  0.0, -1.0), I[2]);
  
  return sqrt(pow(gx, 2.0)+pow(gy, 2.0));
}

vec4 SobelFilter(vec2 uv){
  mat3 B_val;
  mat3 G_val;
  mat3 R_val;
  float edge_size = float(PREFIX(edge_size));
  float factor = max(iResolution.x, iResolution.y);
  factor = factor/mix(factor, 1.0, edge_size/100.0);
  for (int i=0; i<3; i++) {
    for (int j=0; j<3; j++) {
      vec2 pos = uv + vec2(float(i-1), float(j-1))/iResolution.xy*factor;
      vec3 temp = GetValue(pos);
      B_val[i][j] = temp.x;
      G_val[i][j] = temp.y;
      R_val[i][j] = temp.z;
    }
  }
  return vec4(vec3(CalcSobelVal(B_val), CalcSobelVal(G_val), CalcSobelVal(R_val)), INPUT(uv).a);
}

vec4 FUNCNAME(vec2 tc){
  return SobelFilter(tc);
}
