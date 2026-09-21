vec4 AnimationShatterExit(vec4 centers,vec4 meshInfo,vec3 position,mat4 MVP,mat4 Model,out mat4 outMVP,out mat4 outModel, out float alpha,out vec4 outWorldPos){
    outMVP = MVP;
    outModel = Model;
    float SeparationFactor = PREFIX(SeparationFactor);
	alpha = 1.0;
    vec4 outPos = vec4((position.xyz-meshInfo.xyz)+meshInfo.xyz*SeparationFactor,1.0);
    outWorldPos = outModel*outPos;
    return outPos;
}