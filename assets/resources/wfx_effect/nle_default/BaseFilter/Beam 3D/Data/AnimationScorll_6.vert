
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

float delayTimeFunc(float t, float charIndex, float charNum){
  float charPos = charIndex/(charNum-1.0);
  float delayTimePos = 0.6;
  t = clampFunc((t-charPos*delayTimePos)/(1.0-delayTimePos), 0.0, 1.0);
  return t;
}

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float scroll_radians_x(float charIndex){
	return radians((random(vec2(charIndex * 1000.0 + 100.0)) * 0.5 + 0.5) * -45.0);
}

float scroll_radians_y(float charIndex){
	return radians((random(vec2(charIndex * 2000.0 + 200.0)) * 0.5 + 0.5) * -360.0);
}

float scroll_radians_z(float charIndex){
	return radians((random(vec2(charIndex * 3000.0 + 300.0)) * 0.5 + 0.5) * 360.0);
}

vec4 AnimationShatter(vec4 centers,vec4 meshInfo,vec3 position,mat4 MVP,mat4 Model,out mat4 outMVP,out mat4 outModel,out vec4 outWorldPos){
    float iGlobalTime = PREFIX(global_time);
	float totalTime = PREFIX(total_time);
	float duration = PREFIX(duration);
	float duration_exit = PREFIX(duration_exit);
	duration = duration * min(1.0, totalTime / max(duration + duration_exit, 0.0001));
    float process = clamp(iGlobalTime/(duration-1.0/PREFIX(frame_rate)), 0.0, 1.0);
    float charIndex = centers.w;  
    float charNum = PREFIX(uContourNum);
    float textAngle = PREFIX(textAngle);
	float middleIndex = float(int(charNum) / 2);
	
	float singleTime = duration / charNum;
	float scale_process = (iGlobalTime - charIndex * singleTime) / (duration * 0.2);
	scale_process = clamp(scale_process, 0.0, 1.0);
	vec4 p = vec4(.36,.69,.63,.96);
    float delay_time = delayTimeFunc(process, charIndex, charNum);
	float t = KeySpline(p, 1.0 - delay_time);
	
	float radOfScroll_x = scroll_radians_x(charIndex) * t;
	float radOfScroll_y = scroll_radians_y(charIndex) * t;
    
	mat4 rotateMat = setRotation(radOfScroll_x, radOfScroll_y, 0.0);
	mat4 zoomMat = setZoom(1.0 - t, 1.0 - t, 1.0);
	mat4 trans = setTranslation(-centers.x, -centers.y, -centers.z);
    mat4 trans_back = setTranslation(centers.x, centers.y, centers.z);
	
	float offset_x = t * 0.3 * sin(textAngle);
	float offset_y = t * 0.3 * cos(textAngle);
	mat4 transMat = setTranslation(offset_x, offset_y, 0.0);
    
    vec4 ttPos = vec4(position.xyz,1.0);
    outMVP = MVP*transMat*trans_back*rotateMat*zoomMat*trans;
    outModel = Model*trans_back*transMat*rotateMat*trans;
    outWorldPos = outModel*ttPos;

    return ttPos;
}