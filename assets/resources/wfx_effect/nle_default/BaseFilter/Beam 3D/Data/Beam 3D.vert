customize_out vec2 vUV;
customize_out float tPos;
customize_out vec2 vProgressRange;
customize_out vec3 vColor;
customize_out float tAlpha;
customize_out float depth;

mat4 getIdentityMat2(){
    return mat4( 1.0, 0.0, 0.0, 0.0,
				 0.0, 1.0, 0.0, 0.0,
				 0.0, 0.0, 1.0, 0.0,
				 0.0, 0.0, 0.0, 1.0 );
}

vec2 fun(in vec2 p0, in vec2 p1, in vec2 p2, in vec2 p3, in float t){
    float tt = (1.0 - t) * (1.0 -t);
    return tt * (1.0 -t) *p0 +
    3.0 * t * tt * p1 +
    3.0 * t *t *(1.0 -t) *p2 + t *t *t *p3;
}

// sanjie
vec2 fun2(in vec2 p0, in vec2 p1, in vec2 p2, in vec2 p3, in float t)
{
    vec2 q0 = mix(p0, p1, t);
    vec2 q1 = mix(p1, p2, t);
    vec2 q2 = mix(p2, p3, t);

    vec2 r0 = mix(q0, q1, t);
    vec2 r1 = mix(q1, q2, t);

    return mix(r0, r1, t);
}

// er jie
vec2 fun3(in vec2 p0, in vec2 p1, in vec2 p2, in vec2 p3, in float t)
{

    float tt = (1.0 - t) * (1.0 -t);

    return tt * p0 + 2.0 * t * (1.0 -t) * p1 + t * t * p2;

}

//(1-t)^2P0 + 2(1-t)tP1 + t^2*P2
//(1-t)^3P0 + 3(1-t)^2tP1 + 3(1-t)t^2P2 + t^3*P3
void main () {

    vec4 uStartEndData = PREFIX_DRAW_INSTANCE(uStartEndData);
    vec4 uControlData = PREFIX_DRAW_INSTANCE(uControlData);
    vec4 centers = PREFIX_DRAW_INSTANCE(uCenter);
    float uRadius = PREFIX(uRadius);
    float uProgress = PREFIX(uProgress);
    vec2 uProgressRange = PREFIX_DRAW_INSTANCE(uProgressRange);
    float uProgressEnd = PREFIX(uProgressEnd);
    float uZoomStartNode = PREFIX(uZoomStartNode);
    float uZoomEndNode = PREFIX(uZoomEndNode);
    vec4 uColor = PREFIX_DRAW_INSTANCE(uColor);
    float uPointCount = max(float(PREFIX(uPointCount))-1.0,1.0);
    int isAdaptiveAntialiasing = PREFIX(isAdaptiveAntialiasing);
    vColor = uColor.rgb;
    float radiusRatio = uColor.a;
    uRadius *= radiusRatio;
    mat4 uMVP = PREFIX(uMVP);
    float bevelDepth = 0.0;
    float bias = 0.001;
    float textIndex = floor(centers.w/100.0);
    float heightSymbol =  floor((centers.w - textIndex*100.0)/10.0);
    bevelDepth = centers.w - textIndex*100.0 - heightSymbol*10.0;
    if(heightSymbol == 1.0){
        bevelDepth *= -1.0;
    }
    bevelDepth += bias;
    centers.w = textIndex;

    vProgressRange = uProgressRange;

    vec2 viewSize = vec2(PREFIX(uViewSizeWidth),PREFIX(uViewSizeHeight));

    vec4 pos;
    pos.w = 1.0;
    pos.z = bevelDepth;

    vec2 p0 = uStartEndData.xy;
    vec2 p3 = uStartEndData.zw;

    vec2 p1 = uControlData.xy;
    vec2 p2 = uControlData.zw;
    
    float standard = viewSize.y;
    float minStandard = standard*smoothstep(0.0,1.0,(min(iResolutionOrig.y,standard)/standard));

    float t = position.x/uPointCount;
    float t1 = (position.x+1.0)/uPointCount;
    tPos = t;
    vec2 point = vec2(0.0);
    vec2 pointNext = vec2(0.0);
    if(p2.x<-10000.0){
        point = fun3(p0, p1, p3, p3, t)*vec2(1.0,1.0);
        pointNext = fun3(p0, p1, p3, p3, t1)*vec2(1.0,1.0);
    } else {
        point = fun2(p0, p1, p2, p3, t)*vec2(1.0,1.0);
        pointNext = fun2(p0, p1, p2, p3, t1)*vec2(1.0,1.0);
    }
    if(isAdaptiveAntialiasing == 1)
        tAlpha = clamp(length((pointNext-point)*iResolutionOrig/2.0),0.008,1.0);
    else
        tAlpha = 1.0;

    float tempT = uProgressRange.x+(uProgressRange.y-uProgressRange.x)*t;
    float scale = smoothstep(uProgress,uProgressEnd,tempT)+step(1.0,uProgressEnd)*(1.0-step(uProgressEnd-1.0,tempT))*smoothstep(uProgress,uProgressEnd,1.0+tempT);
    float radius = max(mix(1.0,pow(scale*1.2,0.8),uZoomStartNode)*mix(1.0,pow((1.0-scale)*1.2,0.8),uZoomEndNode)*uRadius/standard,1.5/minStandard);
    float aspect = iResolutionOrig.y/iResolutionOrig.x;
    vUV = texcoord.xy;
    pos.xy = point;

    vec4 meshInfo = vec4(0.0);
    vec4 outWorldPos = vec4(0.0);
    mat4 uModel = getIdentityMat2();
    vec4 outPos = AnimationShatter(centers,meshInfo,pos.xyz,uMVP,uModel,uMVP,uModel,outWorldPos);
    
    float uAlpha = 1.0;
    outPos = AnimationShatterExit(centers,meshInfo,outPos.xyz/outPos.w,uMVP,uModel,uMVP,uModel,uAlpha,outWorldPos);
   
    vec4 ttpos = uMVP*outPos;
    ttpos.y = -ttpos.y;
    float projFlag = uMVP[2].w;
    if(projFlag != 0.0){
        radius *= 2.4;
    }
    vec4 proj_coords = ttpos+vec4(vec2(radius),0.0,0.0)*vec4(texcoord.xy*vec2(aspect,1.0),1.0,1.0);
    vec3 projNormCoords = (proj_coords.xyz/proj_coords.w+1.0)/2.0;
    depth = projNormCoords.z;
    
    gl_Position = proj_coords;
    tc = TransTc(projNormCoords.xy);
}