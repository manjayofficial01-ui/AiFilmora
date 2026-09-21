/*
customize_in vec4 uAffineMat0;
customize_in vec4 uAffineMat1;
customize_in vec4 uAffineMat2;
customize_out vec4 vAffineMat0;
customize_out vec4 vAffineMat1;
customize_out vec4 vAffineMat2;
*/
customize_out vec2 vUV;

vec4 GetOutPos(vec2 tPos){
    return vec4(((tPos.xy)*2.0-1.0), 0.0,1.0);
}
vec2 GetUV(vec4 tPos){
    return vec2(tPos.xy*vec2(1.0,-1.0)+1.0)/2.0;
}

void main () {
/*
    vAffineMat0 = uAffineMat0;
    vAffineMat1 = uAffineMat1;
    vAffineMat2 = uAffineMat2;
*/
    //texcoord
    gl_Position = GetOutPos(texcoord.xy);
    vUV = GetUV(GetOutPos(position.xy));
    //vUV = GetUV(gl_Position);
    tc = vec2(0.5);
}