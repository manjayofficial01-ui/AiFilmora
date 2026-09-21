/*{
    "GUID":"B375DF9D-9F5F-0FB6-302A-F233329C8AEE"
}*/

customize_in float tPos;
customize_in vec2 vUV;
customize_in vec2 vProgressRange;
customize_in vec3 vColor;
customize_in float tAlpha;
customize_in float depth;

vec4 FUNCNAME(vec2 tc) {

    float uRadius = PREFIX(uRadius);
    float uAlpha = PREFIX(uAlpha);
    float uProgress = PREFIX(uProgress);
    float uProgressEnd = PREFIX(uProgressEnd);
    float uAlphaStartNode = PREFIX(uAlphaStartNode);
    float uAlphaEndNode = PREFIX(uAlphaEndNode);
    float uSectionLength = PREFIX(uSectionLength);
    vec2 progressRange = vProgressRange;
    int UseDepthTex = PREFIX(UseDepthTex);
    
    if(UseDepthTex == 1){
        vec4 depthTex = DEPTH_INPUT(tc);
        if(depth > depthTex.r){
            return vec4(0.0);
        }
    }

    vec2 cUv = vUV;
    float tempT = progressRange.x+(progressRange.y-progressRange.x)*tPos;
    float beyondEnd = step(1.0,uProgressEnd)*(1.0-step(uProgressEnd-1.0,tempT));
    float realProgress = max(0.0,tempT-uProgress)/(uProgressEnd - uProgress)+beyondEnd*(1.0+tempT-uProgress)/(uProgressEnd - uProgress);
    int sectionCount = int(1.0/uSectionLength);
    int currentSection = int(realProgress/uSectionLength);
    float show = (1.0-mod(float(currentSection),2.0))*step(1.0-PREFIX(uShowRatio),1.0-(realProgress-float(currentSection)*uSectionLength)/uSectionLength);
    float realAlpha = step(uProgress,tempT)*(1.0-step(uProgressEnd,tempT))+beyondEnd;
    return vec4(vColor*(smoothstep(0.0,uAlphaStartNode,realProgress)*smoothstep(0.0,1.0000001-uAlphaEndNode,1.0000001-realProgress)), tAlpha*show*smoothstep(0.0,1.0,1.0-length(cUv))*uAlpha*realAlpha);
}
