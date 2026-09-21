#define M_PI (3.1415926)

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

vec4 AnimationShatter(vec4 centers,vec4 meshInfo,vec3 position,mat4 MVP,mat4 Model,out mat4 outMVP,out mat4 outModel,out vec4 outWorldPos){
    outMVP = MVP;
    outModel = Model;    
    float duration = max(PREFIX(duration),0.001);
    float global_time = PREFIX(global_time);
    float progressScale = 1. - min(1.0,global_time/duration); 

    if(floor(global_time*PREFIX(frame_rate)+0.5) < 3.0){
      return setTranslation(0., 0., 100.0) * vec4(position, 1.);
    }  

    mat4 translate = setTranslation(0., .5 * pow(progressScale, 1.5), 1.5 * pow(progressScale, .5));
    mat4 scale = setZoom(1. + progressScale, 1. + progressScale, 1. + progressScale);
    mat4 rotate = setRotation(-.1 * M_PI * progressScale, .1 * M_PI * progressScale, 0.);
    vec4 outPos = translate * rotate * scale * vec4(position, 1.);
    outWorldPos = outModel*outPos;
    return outPos;
}