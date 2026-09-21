
mat4 getIdentityMat(){
    return mat4( 1.0, 0.0, 0.0, 0.0,
                 0.0, 1.0, 0.0, 0.0,
                 0.0, 0.0, 1.0, 0.0,
                 0.0, 0.0, 0.0, 1.0 );
}

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
 * @param mX1/mY1/mX2/mY2: 贝塞尔曲线四个值
 * 说明: 这个函数以上的其他函数都是本函数使用的辅助函数
 */
float KeySpline(vec4 p, float aX) {
    float mX1 = p.x;
    float mY1 = p.y;
    float mX2 = p.z; 
    float mY2 = p.w;
  if (mX1 == mY1 && mX2 == mY2)
    return aX;  // linear
  return CalcBezier(GetTForX(aX, mX1, mX2), mY1, mY2);
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
mat4 setTranslation( float x, float y, float z )
{
    return mat4( 1.0, 0.0, 0.0, 0.0,
				 0.0, 1.0, 0.0, 0.0,
				 0.0, 0.0, 1.0, 0.0,
				 x,     y,   z, 1.0 );
}

mat4 setZoom(float x, float y, float z){
    return mat4( x, 0.0, 0.0, 0.0,
				 0.0, y, 0.0, 0.0,
				 0.0, 0.0, z, 0.0,
				 0.0, 0.0, 0.0, 1.0 );
}

int modI(int a,int b){
    return (a)-((a)/(b))*(b);
}

float clampFunc(float x, float minVal, float maxVal){
  return min(max(x, minVal), maxVal);
}

float random_x_scroll(float co)
{
    return 0.5*fract(sin(co*258.245) * 43758.545)+0.5;
}

float random_y_scroll(float co)
{
    return 0.5*fract(sin(co*12.989) * 43758.545)+0.5;
}

float random_z_scroll(float co)
{
    return 0.5*fract(sin(co*562.23) * 43758.545)+0.5;
}

float delayTimeFunc(float t, float charIndex, float charNum){
  if(charNum > 1.0){
    float charPos = charIndex/(charNum-1.0);
    float delayTimePos = 0.4;
    t = max((t-charPos*delayTimePos)/(1.0-delayTimePos), 0.0);
  }
  return t;
}

float damped_oscillatory_wave(float t, float ampl, float rand_fres, float phase){
  return ampl*sin(3.14*15.0*rand_fres*(t+phase));
}

float timeExpFunc(float t){
  return -1.0*exp(-15.0*t)+1.0;
}

vec4 scroll_rad_move(float t, float charIndex, float charNum){
    float charPos = (charIndex+1.0)/charNum;
    float random_fres_x = random_x_scroll(charPos);
    float random_fres_y = random_y_scroll(charPos);
    float random_fres_z = random_z_scroll(charPos);
    t = delayTimeFunc(t, charIndex, charNum);
    float zoomVal = timeExpFunc(t);
    float curTime = clamp(t, 0.0, 1.0);
    vec4 p = vec4(.1,.76,.25,.88);
    float ampl = (1.0-(zoomVal)*0.95)*KeySpline(p, 1.0-curTime);
    

    float x_scroll = damped_oscillatory_wave(t, ampl, random_fres_x, 0.0)*radians(45.0);
    float y_scroll = damped_oscillatory_wave(t, ampl, random_fres_y, 0.5)*radians(40.0);
    float z_scroll = damped_oscillatory_wave(t, ampl, random_fres_z, 0.4)*radians(30.0);
    
    return vec4(x_scroll, y_scroll, z_scroll, zoomVal);
}

vec4 AnimationShatter(vec4 centers,vec4 meshInfo,vec3 position,mat4 MVP,mat4 Model,out mat4 outMVP,out mat4 outModel,out vec4 outWorldPos){
    float iGlobalTime = PREFIX(global_time);
    float totalTime = PREFIX(total_time);
    // float process = clampFunc(iGlobalTime/(totalTime-2.0/PREFIX(frame_rate)), 0.0, 1.0);
    float duration = PREFIX(duration);
	float duration_exit = PREFIX(duration_exit);
	duration = duration * min(1.0, totalTime / max(duration + duration_exit, 0.0001));
    float process = clamp(iGlobalTime/(duration-1.0/PREFIX(frame_rate)), 0.0, 1.0);
    float charIndex = centers.w;  
    float charNum = PREFIX(uContourNum);

    mat4 trans = setTranslation(-centers.x, -centers.y, -centers.z);
    mat4 trans_back = setTranslation(centers.x, centers.y, centers.z);
   
    vec4 attrOfScroll = scroll_rad_move(process, charIndex, charNum);
    float x_scroll = attrOfScroll.x;
    float y_scroll = attrOfScroll.y;
    float z_scroll = attrOfScroll.z;

    float zoomVal = attrOfScroll.w;

    mat4 rotateMat = setRotation(x_scroll, y_scroll, z_scroll);
    // mat4 transMat = setTranslation(0.0, 0.0, 0.0);
    mat4 zoomMat = setZoom(zoomVal,zoomVal,1.0);
    
    vec4 ttPos = vec4(position.xyz,1.0);
    outMVP = MVP*trans_back*rotateMat*zoomMat*trans;
    outModel = Model*trans_back*rotateMat*zoomMat*trans;
    outWorldPos = outModel*ttPos;

    return ttPos;
}