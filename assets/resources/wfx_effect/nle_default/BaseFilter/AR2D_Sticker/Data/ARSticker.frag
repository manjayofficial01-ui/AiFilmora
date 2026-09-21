customize_in vec2 vUV;

vec4 FUNCNAME(vec2 tc) {
    int uIsShow = PREFIX(uIsShow);
    int uIsSrc = PREFIX(uIsSrc);
    if(uIsSrc == 1) {
        return INPUT1(vUV);
    } else if(uIsShow == 1) {
        return INPUT2(vUV);
    }
    return vec4(0.0);
}
