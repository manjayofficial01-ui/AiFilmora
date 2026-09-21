#define PI2 (3.1415926*2.0)

float A(float aA1, float aA2) {
return 1.0 - 3.0 * aA2 + 3.0 * aA1;
}

float B(float aA1, float aA2) {
return 3.0 * aA2 - 6.0 * aA1;
}

float C(float aA1) {
return 3.0 * aA1;
}

float GetSlope(float aT, float aA1, float aA2) {
return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1);
}

float CalcBezier(float aT, float aA1, float aA2) {
return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
}

float GetTForX(float aX, float mX1, float mX2) {
float aGuessT = aX;
for (int i = 0; i < 6; ++i) {
float currentSlope = GetSlope(aGuessT, mX1, mX2);
if (currentSlope == 0.0)
return aGuessT;
float currentX = CalcBezier(aGuessT, mX1, mX2) - aX;
aGuessT -= currentX / currentSlope;
}
return aGuessT;
}

/*
* @param aX: 传入时间变量
* @param p1/p2: 贝塞尔曲线两个控制点
* 说明: 这个函数以上的其他函数都是本函数使用的辅助函数
*/
float KeySpline(vec4 p, float aX) {
vec2 p1= p.xy;
vec2 p2= p.zw;
float mX1 = p1.x;
float mY1 = p1.y;
float mX2 = p2.x;
float mY2 = p2.y;
if (mX1 == mY1 && mX2 == mY2)
return aX; // linear
return CalcBezier(GetTForX(aX, mX1, mX2), mY1, mY2);
}

float rand(float x) {
    return fract(sin(x * 154.4514) * 72561.556);
}

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

vec3 RotationAnimation(vec3 meshCenter,float progress,float scaleRatio,float progressScale,float progressRot){
    meshCenter.xy = meshCenter.xy*scaleRatio+vec2(70.5)*max(0.0,1.0-progressScale*15.0)*(1.0-progress);
    float thickness = PREFIX(Extrude);
    float finalScaleZ = 20.2;
    float temp = (meshCenter.z+thickness)/thickness;
    finalScaleZ *=temp;
    meshCenter.z = meshCenter.z+35.5*max(0.0,1.0-progressScale*2.0)*(1.0-progress)+(finalScaleZ-finalScaleZ*progress);
    meshCenter.xy = rotate(meshCenter.xy, progressRot*18.0*PI2);
    return meshCenter;
}

vec3 RotationLocalAnimation(vec3 localPos,float progress){
    localPos.yz = rotate(localPos.yz, progress*14.0*PI2);
    return localPos;
}
mat4 setRotation( float x, float y, float z )
{
    float a = sin(x); float b = cos(x);
    float c = sin(y); float d = cos(y);
    float e = sin(z); float f = cos(z);



    float ac = a*c;
    float bc = b*c;

    return mat4( d*f,      d*e,       -c, 0.0,
                 ac*f-b*e, ac*e+b*f, a*d, 0.0,
                 bc*f+a*e, bc*e-a*f, b*d, 0.0,
                 0.0,      0.0,      0.0, 1.0 );
}

vec4 AnimationShatter(vec4 centers,vec4 meshInfo,vec3 position,mat4 MVP,mat4 Model,out mat4 outMVP,out mat4 outModel,out vec4 outWorldPos){
    float SeparationFactor = PREFIX(SeparationFactor);
    float duration = max(PREFIX(duration),0.001);
    float global_time = PREFIX(global_time);
    vec4 uBound = PREFIX(uBound);
    vec3 meshCenter = meshInfo.xyz*SeparationFactor;
    float r = min(length(meshInfo.xy),1.0);
    float progressScale = min(1.0,global_time/duration);
    float durationRot = duration*0.7;
    float progressRot = min(1.0,(global_time+(((-meshInfo.y+1.0)/2.0-uBound.y)/(uBound.w-uBound.y))*0.3*durationRot+rand(abs(r-0.5)*3141.123+14.12)+rand(meshInfo.w*0.001)*0.4*durationRot)/durationRot);
    progressRot = KeySpline(vec4(.46,.5,0,1.01),min(progressRot+0.15-r*0.15,1.0));
    float progress = min(1.0,(global_time+(((-meshInfo.y+1.0)/2.0-uBound.y)/(uBound.w-uBound.y))*0.3*duration+rand(abs(r-0.5)*3141.123+14.12)+rand(meshInfo.w*0.001)*0.4*duration)/duration);
    progress = KeySpline(vec4(.46,.5,0,1.01),min(progress+0.15-r*0.15,1.0));
    float scaleRatio = 0.5+0.5*KeySpline(vec4(.22,.66,.34,.93),progressScale);
    meshCenter = RotationAnimation(meshCenter,progress,scaleRatio,progressScale,progressRot);
    meshCenter.xy+=vec2(rand(meshInfo.w),rand(progress))*0.1*(1.0-abs(progress-0.5)*2.0);
    vec3 pos = (position.xyz-meshInfo.xyz);
    pos*=scaleRatio-rand(r*3141.123+14.12)*(1.0-scaleRatio);
    vec3 localPos = RotationLocalAnimation(pos,progress);
    outMVP = MVP;
    outModel = Model*setRotation(progress*14.0*PI2,0.0,0.0);
    outWorldPos = Model*vec4(localPos+meshCenter, 1.0);
    return vec4(localPos+meshCenter, 1.0);
}