
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

float actualCharIndex(float charIndex, int charNum){
    // even
    if(modI(charNum, 2) == 0){
        charNum -= 1;
        if(int(charIndex) == charNum){
            return charIndex;
        }
        float midCharIndex = (float(charNum)-1.0)/2.0;
        charIndex -= midCharIndex;
        if(charIndex == 0.0){
            return charIndex;
        }else if(charIndex > 0.0){
            return 2.0*charIndex-1.0;
        }else if(charIndex < 0.0){
            return 2.0*abs(charIndex);
        }

    }
    //odd
    else{
        float midCharIndex = (float(charNum)-1.0)/2.0;
        charIndex -= midCharIndex;
        if(charIndex == 0.0){
            return charIndex;
        }else if(charIndex > 0.0){
            return charIndex * 2.0;
        }else if(charIndex < 0.0){
            return 2.0*abs(charIndex)-1.0;
        }
    }
}

float time_scroll(float t, float charIndex, float charNum){
    int nCharNum = int(charNum);
    if(charNum != 1.0){
      charIndex = actualCharIndex(charIndex, nCharNum);
      float charPos = charIndex/(charNum-1.0);
      float delayTimePos = 0.3;
      t = clampFunc((t-charPos*delayTimePos)/(1.0-delayTimePos), 0.0, 1.0);
    }
    return t;   
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

    mat4 trans = setTranslation(-centers.x, -centers.y, -centers.z);
    mat4 trans_back = setTranslation(centers.x, centers.y, centers.z);
   
    float rotate_trans_t = time_scroll(process, charIndex, charNum);
    vec2 p1 = vec2(0.65, 0.21);
    vec2 p2 = vec2(0.88, 0.5);
    float scroll_t = KeySpline(p1, p2, (1.0-rotate_trans_t));

    float rotateRad = radians(scroll_t*-540.0);

    float trans_z = scroll_t*2.8; 
    if(floor(iGlobalTime*PREFIX(frame_rate)+0.5) < 3.0){
      trans_z = 10.0;
    }  
    mat4 rotateMat = setRotation(0.0, rotateRad, 0.0);
    mat4 transMat = setTranslation(0.0, 0.0, trans_z);
    
    vec4 ttPos = vec4(position.xyz,1.0);
    outMVP = MVP*trans_back*transMat*rotateMat*trans;
    outModel = Model*trans_back*transMat*rotateMat*trans;
    outWorldPos = outModel*ttPos;

    return ttPos;
}