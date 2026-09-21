/*
customize_in vec4 vAffineMat0;
customize_in vec4 vAffineMat1;
customize_in vec4 vAffineMat2;
*/
customize_in vec2 vUV;
vec4 GetOutPos(vec2 tPos){
    return vec4(((tPos.xy)*2.0-1.0), 0.0,1.0);
}
vec2 GetUV(vec4 tPos){
    return vec2(tPos.xy*vec2(1.0,-1.0)+1.0)/2.0;
}
/*
vec2 Affine(vec2 t){
    vec2 p0 = GetUV(GetOutPos(vec2(vAffineMat0.x,vAffineMat0.y)));
    vec2 p1 = GetUV(GetOutPos(vec2(vAffineMat0.z,vAffineMat0.w)));
    vec2 p2 = GetUV(GetOutPos(vec2(vAffineMat1.x,vAffineMat1.y)));
    vec2 q0 = GetUV(GetOutPos(vec2(vAffineMat1.z,vAffineMat1.w)));
    vec2 q1 = GetUV(GetOutPos(vec2(vAffineMat2.x,vAffineMat2.y)));
    vec2 q2 = GetUV(GetOutPos(vec2(vAffineMat2.z,vAffineMat2.w)));

    float w0 = 1.0/max((p0.x-t.x)*(p0.x-t.x)+(p0.y-t.y)*(p0.y-t.y),0.001);
    float w1 = 1.0/max((p1.x-t.x)*(p1.x-t.x)+(p1.y-t.y)*(p1.y-t.y),0.001);
    float w2 = 1.0/max((p2.x-t.x)*(p2.x-t.x)+(p2.y-t.y)*(p2.y-t.y),0.001);
    float tw = w0+w1+w2;
    vec2 pc = vec2(w0*p0.x+w1*p1.x+w2*p2.x,w0*p0.y+w1*p1.y+w2*p2.y)/tw;
    vec2 qc = vec2(w0*q0.x+w1*q1.x+w2*q2.x,w0*q0.y+w1*q1.y+w2*q2.y)/tw;
    vec2 A0 = vec2(0.0);
    vec2 A1 = vec2(0.0);
    vec2 B0 = vec2(0.0);
    vec2 B1 = vec2(0.0);
    vec2 M0 = vec2(0.0);
    vec2 M1 = vec2(0.0);
    
    vec2 _p = p0;
    vec2 _q = q0;
    float _w = w0;
    vec2 P = vec2(_p.x-pc.x,_p.x-pc.y);
    vec2 PT = vec2(_p.x-pc.x,_p.x-pc.y);
    vec2 Q = vec2(_q.x-qc.x,_q.x-qc.y);
    vec2 T0 = vec2(P.x,P.y)*PT.x;
    vec2 T1 = vec2(P.x,P.y)*PT.y;
    
    A0=A0+_w*T0;
    A1=A1+_w*T1;
    
    T0 = vec2(Q.x,Q.y)*PT.x;
    T1 = vec2(Q.x,Q.y)*PT.y;
    
    B0=B0+_w*T0;
    B1=B1+_w*T1;
    
    //1
    _p = p1;
    _q = q1;
    _w = w1;
    P = vec2(_p.x-pc.x,_p.x-pc.y);
    PT = vec2(_p.x-pc.x,_p.x-pc.y);
    Q = vec2(_q.x-qc.x,_q.x-qc.y);
    T0 = vec2(P.x,P.y)*PT.x;
    T1 = vec2(P.x,P.y)*PT.y;
    
    A0=A0+_w*T0;
    A1=A1+_w*T1;
    
    T0 = vec2(Q.x,Q.y)*PT.x;
    T1 = vec2(Q.x,Q.y)*PT.y;
    
    B0=B0+_w*T0;
    B1=B1+_w*T1;
    
    //2
    _p = p2;
    _q = q2;
    _w = w2;
    P = vec2(_p.x-pc.x,_p.x-pc.y);
    PT = vec2(_p.x-pc.x,_p.x-pc.y);
    Q = vec2(_q.x-qc.x,_q.x-qc.y);
    T0 = vec2(P.x,P.y)*PT.x;
    T1 = vec2(P.x,P.y)*PT.y;
    
    A0=A0+_w*T0;
    A1=A1+_w*T1;
    
    T0 = vec2(Q.x,Q.y)*PT.x;
    T1 = vec2(Q.x,Q.y)*PT.y;
    
    B0=B0+_w*T0;
    B1=B1+_w*T1;

    //cvInvert(A,M);
    float det=max(A0.x*A1.y-A0.y*A1.x,0.0001);
    if (det < 0.0001) {
        return vec2(t.x + qc.x - pc.x,t.y + qc.y - pc.y);
    }
    float temp1=A1.y/det;
    float temp2=-A0.y/det;
    float temp3=-A1.x/det;
    float temp4=A0.x/det;
    A0.x=temp1;
    A0.y=temp2;
    A1.x=temp3;
    A1.y=temp4;

    M0.x=A0.x*B0.x+A0.y*B1.x;
    M0.y=A0.x*B0.y+A0.y*B1.y;
    M1.x=A1.x*B0.x+A1.y*B1.x;
    M1.y=A1.x*B0.y+A1.y*B1.y;

    vec2 V=vec2(t.x-pc.x,t.y-pc.y);
    vec2 R;
    R.x=V.x*M0.x+V.y*M1.x;//lv（x）总计算公式
    R.y=V.x*M0.y+V.y*M1.y;
    
    return vec2(R.x+qc.x,R.y+qc.y);
}*/
vec4 FUNCNAME(vec2 tc) {
    int uIsShow = PREFIX(uIsShow);
    int uIsShowGrid = PREFIX(uIsShowGrid);
    if(uIsShow == 1) {
        //vec2 uvOrigin = Affine(vUV.xy);
        vec4 outColor = INPUT(vUV.xy);
        return mix(vec4(outColor.rgb*outColor.a,outColor.a),vec4(0.0,0.0,1.0,1.0), float(uIsShowGrid));
    }
    return vec4(0.0);
}
