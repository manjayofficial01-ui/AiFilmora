vec4 FUNCNAME(vec2 tc)
{    
    float iGlobalTime = PREFIX(global_time);
    float iTotalTime = PREFIX(total_time);
    int color = PREFIX(color);
    int opacity = PREFIX(opacity);
    float thickness = PREFIX(thickness) / 30.0;
    
    vec3 inputCol = vec3(float(color & 0xff), float((color >> 8) & 0xff), float((color >> 16) & 0xff)) / 255.0;
    
    vec4 origCol = INPUT(tc);
    vec4 retCol = origCol;
    
    float twoPI = 3.141592653 * 2.0;
    float samples = 48.0;
    
    vec2 aspect = 1.0 / iResolution.xy;
    float radius = 10.0 * thickness;
    float mask = 0.0;
    for (float i = 0.0; i < twoPI; i += twoPI / samples) {
        vec2 offset = vec2(sin(i), cos(i)) * aspect * radius;
        vec4 col = INPUT(tc + offset);
        float dis = smoothstep(0.0, 1.0, distance(col.a, origCol.a));
        mask = mix(mask, 1.0, dis);
    }
    
    if(origCol.a > 0.0){
        origCol.rgb /= origCol.a;
    }
    
    retCol.rgb = mix(inputCol * mask * float(opacity) / 100.0, origCol.rgb, origCol.a);
    retCol.a = max(mask, origCol.a);

    return retCol;
}