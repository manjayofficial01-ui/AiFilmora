customize_out vec2 vUV;
customize_out vec2 vCenter;
customize_out float radius;

void main () {
    int uIsBlend = PREFIX(uIsBlend);
    if(uIsBlend == 0){
        mat4 uMVP = PREFIX(uMVP);
        mat4 uFaceMat = PREFIX(uFaceMat);
        vec2 uCenter = PREFIX(uCenterAndScale).xy;
        float uFaceScale = PREFIX(uCenterAndScale).z*PREFIX(Scale);
        vec4 pos = vec4(position.xy*2.0-1.0, 0.0, 1.0);

        vec4 out_pos = uMVP * uFaceMat *pos;
        out_pos/=out_pos.w;
        out_pos.xy *= uFaceScale;
        out_pos.xy += uCenter;
        vCenter = TransV(vec4(uCenter,0.0,1.0)).xy*0.5+0.5;
        radius = uFaceScale*PREFIX(uRadiusProp);
        gl_Position = out_pos;
        vUV = TransV(out_pos).xy*0.5+0.5;
        tc = vec2(0.5);
    }else{
        vec4 pos = vec4(position.xy*2.0-1.0, 0.0, 1.0);
        gl_Position = pos;
        vUV = vec2(texcoord.x,1.0-texcoord.y);
    }  
}