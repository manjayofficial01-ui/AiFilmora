customize_out vec2 vUV;

void main () {
    int uIsSrc = PREFIX(uIsSrc);
    if(uIsSrc == 1) {
        vUV = vec2(texcoord.x,1.0-texcoord.y);
        gl_Position = vec4((position.xy*2.0-1.0),0.0,1.0);
        tc = vec2(0.5);
    } else {
        mat4 uMVP = PREFIX(uMVP);
        mat4 uFaceMat = PREFIX(uFaceMat);
        vec2 uCenter = PREFIX(uCenterAndScale).xy;
        float uFaceScaleW = PREFIX(uCenterAndScale).z*11.76;
        float uFaceScaleH = PREFIX(uCenterAndScale).w*11.76;
        vec2 uTexSize = PREFIX(uTexSize);
        vec2 positionX = PREFIX(positionX);
        vec4 pos = vec4(((position.xy*2.0-1.0)*vec2(uTexSize.x/uTexSize.y,1.0)+vec2((1.0-(positionX.x/uTexSize.x)*2.0)*uTexSize.x/uTexSize.y,1.0-(positionX.y/uTexSize.y)*2.0))*vec2(uTexSize.y/1334.0)*0.52633*PREFIX(Scale),0.0,1.0);
        vec4 out_pos = uFaceMat *pos;
        out_pos/=out_pos.w;
        out_pos.xy *= vec2(750.0/1334.0,1.0);
        out_pos.xy *= vec2(uFaceScaleW, uFaceScaleH);
        if(iResolution.y <= iResolution.x){
            out_pos.xy *= vec2(1.0, iResolution.x / iResolution.y * 9.0 / 16.0);
        }
        out_pos.xy += uCenter;
        gl_Position = out_pos;
        vUV = vec2(texcoord.x,texcoord.y);
        tc = vec2(0.5);
    }
}