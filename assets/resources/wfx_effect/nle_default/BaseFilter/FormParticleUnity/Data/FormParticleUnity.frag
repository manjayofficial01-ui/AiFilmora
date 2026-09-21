customize_in vec2 vUV;
customize_in vec3 vLighting;
vec4 FUNCNAME(vec2 tc) {
    vec4 result = vec4(vLighting.rgb,smoothstep(3.0/max(iResolutionOrig.x,iResolutionOrig.y),1.0,1.0-length(vUV)));
    float averageLighting = (vLighting.r+vLighting.g+vLighting.b)/3.0;
    return vec4(result.rgb*result.a,averageLighting*result.a);
}
