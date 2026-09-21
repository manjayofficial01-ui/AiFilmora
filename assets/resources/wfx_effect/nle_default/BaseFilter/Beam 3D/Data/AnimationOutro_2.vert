float A_Outro(float aA1, float aA2) {
  return 1.0 - 3.0 * aA2 + 3.0 * aA1;
}

float B_Outro(float aA1, float aA2) {
  return 3.0 * aA2 - 6.0 * aA1;
}

float C_Outro(float aA1) {
  return 3.0 * aA1;
}

float GetSlope_Outro(float aT, float aA1, float aA2) {
  return 3.0 * A_Outro(aA1, aA2) * aT * aT + 2.0 * B_Outro(aA1, aA2) * aT + C_Outro(aA1);
}

float CalcBezier_Outro(float aT, float aA1, float aA2) {
  return ((A_Outro(aA1, aA2) * aT + B_Outro(aA1, aA2)) * aT + C_Outro(aA1)) * aT;
}

float GetTForX_Outro(float aX, float mX1, float mX2) {
  float aGuessT = aX;
  for (int i = 0; i < 6; ++i) {
    float currentSlope = GetSlope_Outro(aGuessT, mX1, mX2);
    if (currentSlope == 0.0)
      return aGuessT;
    float currentX = CalcBezier_Outro(aGuessT, mX1, mX2) - aX;
    aGuessT -= currentX / currentSlope;
  }
  return aGuessT;
}

float KeySpline_Outro(vec2 p1, vec2 p2, float aX) {
    float mX1 = p1.x;
    float mY1 = p1.y;
    float mX2 = p2.x; 
    float mY2 = p2.y;
  if (mX1 == mY1 && mX2 == mY2)
    return aX;  // linear
  return CalcBezier_Outro(GetTForX_Outro(aX, mX1, mX2), mY1, mY2);
}

mat4 setRotation_Outro( float x, float y, float z )
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
mat4 setTranslation_Outro( float x, float y, float z )
{
    return mat4( 1.0, 0.0, 0.0, 0.0,
				 0.0, 1.0, 0.0, 0.0,
				 0.0, 0.0, 1.0, 0.0,
				 x,     y,   z, 1.0 );
}

mat4 setZoom_Outro(float x, float y, float z){
    return mat4( x, 0.0, 0.0, 0.0,
				 0.0, y, 0.0, 0.0,
				 0.0, 0.0, z, 0.0,
				 0.0, 0.0, 0.0, 1.0 );
}

float random_x_scroll_Outro(float co)
{
    return 2.0*fract(sin(co*258.245) * 43758.545)-1.0;
}

float random_y_scroll_Outro(float co)
{
    return 2.0*fract(sin(co*12.989) * 43758.545)-1.0;
}

float random_z_scroll_Outro(float co)
{
    return 2.0*fract(sin(co*562.23) * 43758.545)-1.0;
}

vec3 scroll_radians_Outro(float charIndex, float charNum){
    float charPos = (charIndex+1.0)/charNum;
    float x_scroll = random_x_scroll_Outro(charPos)*radians(45.0);
    float y_scroll = random_y_scroll_Outro(charPos)*radians(360.0 * 3.0);
    float z_scroll = random_z_scroll_Outro(charPos)*radians(90.0);
    return vec3(x_scroll, y_scroll, z_scroll);
}

vec4 AnimationShatterExit(vec4 centers,vec4 meshInfo,vec3 position,mat4 MVP,mat4 Model,out mat4 outMVP,out mat4 outModel, out float alpha,out vec4 outWorldPos){
    float iGlobalTime = PREFIX(global_time);
    float totalTime = PREFIX(total_time);
    float duration = PREFIX(duration);
    float duration_exit = PREFIX(duration_exit);
    float charIndex = centers.w;  
    float charNum = PREFIX(uContourNum);
	
	duration_exit = duration_exit * min(1.0, totalTime / max(duration + duration_exit, 0.0001));
	
	if(duration_exit < 0.0001){
		outMVP = MVP;
		outModel = Model;
		float SeparationFactor = PREFIX(SeparationFactor);
		alpha = 1.0;
		vec4 outPos = vec4((position.xyz-meshInfo.xyz)+meshInfo.xyz*SeparationFactor,1.0);
		outWorldPos = outModel*outPos;
		return outPos;
	}
	
	float outro_start_time = totalTime - duration_exit;
	float process = clamp((iGlobalTime - outro_start_time) / (duration_exit - 1.0/PREFIX(frame_rate)), 0.0, 1.0);

    mat4 trans = setTranslation_Outro(-centers.x, -centers.y, -centers.z);
    mat4 trans_back = setTranslation_Outro(centers.x, centers.y, centers.z);
   
    vec2 p1 = vec2(0.65, 0.21);
    vec2 p2 = vec2(0.88, 0.5);
    float bezier_t = KeySpline_Outro(p1, p2, (process));
	
	if(process < 0.6){
		alpha = 1.0;
	}else{
		alpha = -(1.0 / 0.4) * process + (1.0 / 0.4);
	}

    vec3 radsOfScroll = scroll_radians_Outro(charIndex, charNum)*bezier_t;
    float x_scroll = radsOfScroll.x;
    float y_scroll = radsOfScroll.y;
    float z_scroll = radsOfScroll.z;

    float trans_z = -12.0*bezier_t;

    mat4 rotateMat = setRotation_Outro(0.0, y_scroll, 0.0);
    mat4 transMat = setTranslation_Outro(0.0, 0.0, trans_z);
    
    vec4 ttPos = vec4(position.xyz,1.0);
    outMVP = MVP*trans_back*transMat*rotateMat*trans;
    outModel = Model*trans_back*transMat*rotateMat*trans;
    outWorldPos = outModel*ttPos;

    return ttPos;
}