customize_in vec4 normals;
customize_in vec4 tangents;
customize_in vec4 centers;
customize_in vec4 meshInfo;
customize_out vec3 vPos;
customize_out vec3 vUV;
customize_out mat3 vTangentBasis;
customize_out float vAlpha;

void main () {
    mat4 uMVP = PREFIX(uMVP);
    mat4 uModel = PREFIX(uModel);
    float texMapScale = mix(mix(PREFIX(texMapScale),PREFIX(texMapScaleEdge),step(0.5,texcoord.z)),PREFIX(texMapScaleBevel),step(1.5,texcoord.z));
    vec3 N = normalize(normals.xyz);
    vec3 T = normalize(tangents.xyz);
    vec3 B = normalize(cross(N,T));
    vec4 outWorldPos;
    vec4 outPos = AnimationShatter(centers,meshInfo,position.xyz,uMVP,uModel,uMVP,uModel,outWorldPos);
    float uAlpha = 1.0;
    outPos = AnimationShatterExit(centers,meshInfo,outPos.xyz/outPos.w,uMVP,uModel,uMVP,uModel,uAlpha,outWorldPos);
    vAlpha = mix(uAlpha,1.0-centers.w,step(100.0,texcoord.z));//Cursor
    vPos = outWorldPos.xyz/outWorldPos.w;
    if(PREFIX(ShowModel)==0){
        vTangentBasis = mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * mat3(N, T, B);
    }else{
        vTangentBasis = mat3(N, T, B);
    }
    vec4 tPos= uMVP*outPos;
    vec2 texMapPos = mix(mix(vec2(-PREFIX(texMapPosition_X),PREFIX(texMapPosition_Y)),vec2(-PREFIX(texMapEdgePosition_X),-PREFIX(texMapEdgePosition_Y)),step(0.5,texcoord.z)),vec2(-PREFIX(texMapBevelPosition_X),-PREFIX(texMapBevelPosition_Y)),step(1.5,texcoord.z));
    vec2 texMapScaleY = mix(vec2(1.0,PREFIX(texMapScaleEdge_Y)),vec2(1.0,PREFIX(texMapScaleBevel_Y)),step(1.5,texcoord.z));
    vUV = vec3(mix((vec2(texcoord.x,1.0-texcoord.y)+texMapPos-0.5)*texMapScale+0.5,(texcoord.xy*texMapScaleY+texMapPos)*texMapScale,step(0.5,texcoord.z)),texcoord.z);
    gl_Position = TransV(mix(tPos,vec4(tPos.xy,-1.0,tPos.w),step(100.0,texcoord.z)));//Cursor
    tc = vec2(0.5)+vec2(tPos.x,-tPos.y)*0.5;
}