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

float open_down_quad_func(float x, float x_l, float x_r, float y){
    float a = -4.0*y/((x_r-x_l)*(x_r-x_l));
    float b = -(x_l+x_r)*a;
    float c = x_l*x_r*a;
    return a*x*x+b*x+c;
}

float open_down_linear_func(float x, float x_l, float x_r, float y){
    if(x < x_l || x > x_r)
      return 0.0;
    float x_m = (x_l+x_r)/2.0;
    if(x < x_m){
      float k = 2.0 * y / (x_r - x_l);
      float b = -1.0 * k * x_l;
      return k * x + b;
    }else{
      float k = 2.0 * y / (x_l - x_r);
      float b = -1.0 * k * x_r;
      return k * x + b;
    }
}


vec2 time_bounce_2(float t, float charIndex, float charNum, float x1, float x2, float y1, float y2, float y3){
  if(charNum > 1.0){
    float charPos = charIndex/(charNum-1.0);
    float delayTimePos = 0.55;
    t = clamp((t-charPos*delayTimePos)/(1.0-delayTimePos), 0.0, 1.0);
  }   
  float x0 = 0.0;
  float x3 = 1.0;
  if(t > x0 && t <= x1){
    float norm_t = t / x1;
    vec2 p1 = vec2(0.65, 0.39);
    vec2 p2 = vec2(0.47, 0.93);
    float bezier_t = KeySpline(p1, p2, norm_t);
    return vec2(open_down_quad_func(t, x0, x1, y1), bezier_t);
  }else if(t > x1 && t <= x2){
    return vec2(open_down_quad_func(t, x1, x2, y2), 0.0);
  }else if(t > x2 && t <= x3){
    return vec2(open_down_quad_func(t, x2, x3, y3), 0.0);
  }
  return vec2(0.0, 0.0);
}

vec4 AnimationShatter(vec4 centers,vec4 meshInfo,vec3 position,mat4 MVP,mat4 Model,out mat4 outMVP,out mat4 outModel,out vec4 outWorldPos){
    float iGlobalTime = PREFIX(global_time);
    float totalTime = PREFIX(total_time);
    // float process = clamp(iGlobalTime/(totalTime-2.0/PREFIX(frame_rate)), 0.0, 1.0);
    float duration = PREFIX(duration);
	float duration_exit = PREFIX(duration_exit);
	duration = duration * min(1.0, totalTime / max(duration + duration_exit, 0.0001));
    float process = clamp(iGlobalTime/(duration-1.0/PREFIX(frame_rate)), 0.0, 1.0);
    float charIndex = centers.w;  
    float charNum = PREFIX(uContourNum);
    
    mat4 trans = setTranslation(-centers.x, -centers.y, -centers.z);
    mat4 trans_back = setTranslation(centers.x, centers.y, centers.z);

    float x1 = 0.655;
    float x2 = 0.825;

    float y1 = 0.345;
    float y2 = 0.06;
    float y3 = 0.034;

    vec2 trans_rotate_val = time_bounce_2(process, charIndex, charNum, x1, x2, y1, y2, y3);
    float y_bounce = trans_rotate_val.x;
    float x_rotate = radians(trans_rotate_val.y*360.0);
    mat4 transMat = setTranslation(0.0, y_bounce, 0.0);
    mat4 rotateMat = setRotation(x_rotate, 0.0, 0.0);
    vec4 ttPos = vec4(position.xyz,1.0);
    outMVP = MVP*trans_back*transMat*rotateMat*trans;
    outModel = Model*trans_back*transMat*rotateMat*trans;
    outWorldPos = outModel*ttPos;
    return ttPos;
}