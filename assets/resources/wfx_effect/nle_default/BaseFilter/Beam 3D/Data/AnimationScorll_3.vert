
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
float KeySpline(vec2 p1, vec2 p2, float aX) {
    float mX1 = p1.x;
    float mY1 = p1.y;
    float mX2 = p2.x; 
    float mY2 = p2.y;
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
    return 2.0*fract(sin(co*258.245) * 43758.545)-1.0;
}

float random_y_scroll(float co)
{
    return 0.5*fract(sin(co*12.989) * 43758.545)+0.5;
}

float random_z_scroll(float co)
{
    return 2.0*fract(sin(co*562.23) * 43758.545)-1.0;
}

float random_x_move(float co)
{
    return 2.0*fract(sin(co*382.92) * 43758.545)-1.0;
}

float random_y_move(float co)
{
    return 2.0*fract(sin(co*78.63) * 43758.545)-1.0;
}

float random_z_move(float co)
{
    return fract(sin(co*145.21) * 43758.545)*0.5+0.5;
}

vec3 scroll_radians(float charIndex, float charNum){
    float charPos = (charIndex+1.0)/charNum;
    float x_scroll = random_x_scroll(charPos)*radians(45.0);
    float y_scroll = random_y_scroll(charPos)*radians(720.0);
    float z_scroll = random_z_scroll(charPos)*radians(135.0);
    
    return vec3(x_scroll, y_scroll, z_scroll);
}
vec3 scroll_move(float charIndex, float charNum){
    float charPos = (charIndex+1.0)/charNum;
    float x_move = 0.0;
    float y_move = 0.0;
    float z_move = random_z_move(charPos)*2.0;

    return vec3(x_move, y_move, z_move);
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
   
    vec2 p1 = vec2(0.65, 0.21);
    vec2 p2 = vec2(0.88, 0.5);
    float bezier_t = KeySpline(p1, p2, (1.0-process));

    vec3 radOfScroll = scroll_radians(charIndex, charNum)*bezier_t;
    float x_scroll = radOfScroll.x;
    float y_scroll = radOfScroll.y;
    float z_scroll = radOfScroll.z;

    vec3 moveOfScroll = scroll_move(charIndex, charNum)*bezier_t;
    float x_trans = moveOfScroll.x;
    float y_trans = moveOfScroll.y;
    float z_trans = moveOfScroll.z;

    if(floor(iGlobalTime*PREFIX(frame_rate)+0.5) < 3.0){
      z_trans = 10.0;
    } 

    mat4 rotateMat = setRotation(x_scroll, y_scroll, z_scroll);
    mat4 transMat = setTranslation(x_trans, y_trans, z_trans);
    
    vec4 ttPos = vec4(position.xyz,1.0);
    outMVP = MVP*trans_back*transMat*rotateMat*trans;
    outModel = Model*trans_back*transMat*rotateMat*trans;
    outWorldPos = outModel*ttPos;

    return ttPos;
}