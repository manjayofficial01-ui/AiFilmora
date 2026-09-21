mat4 setTranslation( float x, float y, float z )
{
    return mat4( 1.0, 0.0, 0.0, 0.0,
				 0.0, 1.0, 0.0, 0.0,
				 0.0, 0.0, 1.0, 0.0,
				 x,     y,   z, 1.0 );
}

mat4 getIdentityMat(){
    return mat4( 1.0, 0.0, 0.0, 0.0,
				 0.0, 1.0, 0.0, 0.0,
				 0.0, 0.0, 1.0, 0.0,
				 0.0, 0.0, 0.0, 1.0 );
}

float time_bounce(float t, float xm, float ym, float yn, float charIndex, float charNum){  
    if(charNum > 1.0){
      float charPos = charIndex/(charNum-1.0);
      float delayTimePos = 0.558;
      t = clamp((t-charPos*delayTimePos)/(1.0-delayTimePos), 0.0, 1.0);     
    }   
    if( xm >= 0.5){
        return 0.0;
    }
    if(t <= 2.0*xm){
      float a = -ym/(xm*xm);
      float b = 2.0 * ym/xm;
      float c = 0.0;
      return a*t*t+b*t+c;
    }else if(t > 2.0*xm && t <= 1.0){
      float xn = (1.0+2.0*xm)/2.0; 
      float a = 1.0;
      float b = -(2.0*xm+1.0);
      float c = 2.0*xm;
      return (a*t*t+b*t+c)*yn/((1.0-xn)*(2.0*xm-xn));
    }
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
    
    float xm = 0.351; // <=0.5
    float ym = 0.202;
    float yn = 0.05;
    float y_bounce = time_bounce(process, xm, ym, yn, charIndex, charNum);
    mat4 transMat = setTranslation(0.0, y_bounce,0.0);
    vec4 ttPos = vec4(position.xyz,1.0);
    vec4 retPos = ttPos;
    outMVP = MVP*transMat;
    outModel = Model*transMat;
    outWorldPos = outModel*retPos;
    return retPos;
}