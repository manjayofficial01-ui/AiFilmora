customize_out vec2 vUV;
customize_out vec3 vLighting;
float rand(vec2 co){
 return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
}
vec2 rot(vec2 v,float angle){
    float theta = angle*3.1415926/180.0;
    return mat2(cos(theta),-sin(theta),
                sin(theta),cos(theta))*v;
}


/*fractalType*/
/*
 * 0: basic
 * 1: turbulent smooth
 * 2: turbulent basic
 * 3: turbulent sharp
 */
//int fractalType = PREFIX(fractalType);

/*noiseType*/
/*
 * 0: block
 * 1: linear
 * 2: softlinear
 * 3: spline
 */

/*overflow*/
/*
 * 0: clip
 * 1: soft clamp
 * 2: wrap back
 * 3: allow hdr results
 */

#define SIZE 64.0
#define PI acos(-1.)
#define TAU 2.*PI
#define toRad PI/180.
#define toDeg 180./PI
#define HASHSCALE3 vec3(.1031, .1030, .0973)

vec3 hash33(vec3 p3)
{
    p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}

vec2 flip(vec2 coord) {
    return vec2(coord.x, iResolution.y - coord.y);
}

float bicubic(float a, float b, float c, float d, float t) {
    float p = - a / 2. + b * 3./2. - c * 3./2. + d / 2.;
    float q = a - b * 5./2. + c * 2. - d / 2.;
    float r = - a / 2. + c / 2.;
    float s = b;
    
    return p * t*t*t + q * t*t + r * t + s;
}

float wrap(float value, float minValue, float maxValue) {
    return mod((value - minValue), (maxValue - minValue)) + minValue;
}

// Fractal Type

float basic(float f) {
    return f;
}

float turbulentBasic(float f) {
    return abs(f - 0.5) * 2.;
}

float turbulentSmooth(float f) {
    float x = turbulentBasic(f);
    return x*x;
}

float turbulentSharp(float f) {
    float x = turbulentBasic(f);
    return sqrt(x);
}

float selectFractal(float f) {
    int fractalType = PREFIX(fractalType);
    float ret = 0.;
    if (fractalType == 0) {
        ret = basic(f);
    } else if (fractalType == 1) {
        ret = turbulentSmooth(f);
    } else if (fractalType == 2) {
        ret = turbulentBasic(f);
    } else if (fractalType == 3) {
        ret = turbulentSharp(f);
    } else {
        ret = basic(f);
    }
    return ret;
}

// Cycle

float selectCycle(float value, float base, float periode) {
    float ret = 0.;
    int cycleEvolution = PREFIX(cycleEvolution);
    if (cycleEvolution == 1) {
        ret = wrap(value, base, base + periode);
    } else {
        ret = value;
    }
    return ret;
}

// Noise Type

float block(vec2 fragCoord, float depth) {
    int randomSeed = PREFIX(randomSeed);
    float randf = float(randomSeed);
    int centerSubscale = PREFIX(centerSubscale);
    int cycle = PREFIX(cycle); // not used if cycleEvolution is false
    if (centerSubscale == 1) randf += depth;
    vec3 hash = hash33(vec3(floor(fragCoord), randf));
    float freq = hash.x; // random freq for each coord
    float periode = 1. + floor(freq * float(cycle + 1));
    int cycleEvolution = PREFIX(cycleEvolution);
    if (cycleEvolution == 1) {
        freq = periode / float(cycle);
    }
    float iTime = PREFIX(global_time);
    float evolution = PREFIX(evolution)*iTime; // in Periode
    float evo = evolution * freq + hash.y;
    float e = randf + floor(evo); // evolution here
    float f = fract(evo);
    
    float a = hash33(vec3(floor(fragCoord), selectCycle(e - 1., randf, periode))).x;
    float b = hash33(vec3(floor(fragCoord), selectCycle(e + 0., randf, periode))).x;
    float c = hash33(vec3(floor(fragCoord), selectCycle(e + 1., randf, periode))).x;
    float d = hash33(vec3(floor(fragCoord), selectCycle(e + 2., randf, periode))).x;
    
    return bicubic(a, b, c, d, f);
}

float linear(vec2 fragCoord, float depth) {
    fragCoord -= 0.5;
    float tl = block(fragCoord, depth);
    float tr = block(fragCoord + vec2(1., 0.), depth);
    float bl = block(fragCoord + vec2(0., 1.), depth);
    float br = block(fragCoord + vec2(1., 1.), depth);
    
    vec2 f = fract(fragCoord);
    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

float softLinear(vec2 fragCoord, float depth) {
    fragCoord -= 0.5;
    float tl = block(fragCoord, depth);
    float tr = block(fragCoord + vec2(1., 0.), depth);
    float bl = block(fragCoord + vec2(0., 1.), depth);
    float br = block(fragCoord + vec2(1., 1.), depth);
    
    vec2 f = fract(fragCoord);
    f = smoothstep(0., 1., f);
    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

float spline(vec2 fragCoord, float depth) {
    fragCoord -= 0.5;
    
    float ttll = block(fragCoord + vec2(-1., -1.), depth);
    float ttl = block(fragCoord + vec2(0., -1.), depth);
    float ttr = block(fragCoord + vec2(1., -1.), depth);
    float ttrr = block(fragCoord + vec2(2., -1.), depth);
                       
    float tll = block(fragCoord + vec2(-1, 0.), depth);
    float tl = block(fragCoord, depth);
    float tr = block(fragCoord + vec2(1., 0.), depth);
    float trr = block(fragCoord + vec2(2, 0.), depth);
    
    float bll = block(fragCoord + vec2(-1., 1.), depth);
    float bl = block(fragCoord + vec2(0., 1.), depth);
    float br = block(fragCoord + vec2(1., 1.), depth);
    float brr = block(fragCoord + vec2(2., 1.), depth);
    
    float bbll = block(fragCoord + vec2(-1., 2.), depth);
    float bbl = block(fragCoord + vec2(0., 2.), depth);
    float bbr = block(fragCoord + vec2(1., 2.), depth);
    float bbrr = block(fragCoord + vec2(2., 2.), depth);
                       
    vec2 f = fract(fragCoord);
    
    float tt = bicubic(ttll, ttl, ttr, ttrr, f.x);
    float t = bicubic(tll, tl, tr, trr, f.x);
    float b = bicubic(bll, bl, br, brr, f.x);
    float bb = bicubic(bbll, bbl, bbr, bbrr, f.x);
    
    return bicubic(tt, t, b, bb, f.y);
}

// Overflow

float clipOverflow(float value) {
    return clamp(value, 0., 1.);
}

float softClampOverflow(float value) {
    return 1. / (1. + exp(2. - 4.*value));
}

float wrapBackOverflow(float value) {
    return abs(value - 2.*floor(value*0.5 + 0.5));
}

float allowHdrResultsOverflow(float value) {
    return value;
}

float selectOverflow(float value) {
  float ret = 0.;
#ifndef OVERFLOW
  int overflow = PREFIX(overflow);
  if (overflow == 0) {
    ret = clipOverflow(value);
  } else if (overflow == 1) {
    ret = softClampOverflow(value);
  } else if (overflow == 2) {
    ret = wrapBackOverflow(value);
  } else if (overflow == 3) {
    ret = allowHdrResultsOverflow(value);
  } else {
    ret = allowHdrResultsOverflow(value);
  }
#else
  #if OVERFLOW == 0
    ret = clipOverflow(value);
  #elif OVERFLOW == 1
    ret = softClampOverflow(value);
  #elif OVERFLOW == 2
    ret = wrapBackOverflow(value);
  #elif OVERFLOW == 3
    ret = allowHdrResultsOverflow(value);
  #else
    ret = allowHdrResultsOverflow(value);
  #endif
#endif
  return ret;
}

float layer(vec2 fragCoord, float depth) {
  float ret = 0.;
#ifndef NOISETYPE
  int noiseType = PREFIX(noiseType);
  if (noiseType == 0) {
      ret = block(fragCoord, depth);
  } else if (noiseType == 1) {
      ret = linear(fragCoord, depth);
  } else if (noiseType == 2) {
      ret = softLinear(fragCoord, depth);
  } else if (noiseType == 3) {
      ret = spline(fragCoord, depth);
  } else {
      ret = spline(fragCoord, depth);
  }
#else
  #if NOISETYPE == 0
    ret = block(fragCoord, depth);
  #elif NOISETYPE == 1
    ret = linear(fragCoord, depth);
  #elif NOISETYPE == 2
    ret = softLinear(fragCoord, depth);
  #elif NOISETYPE == 3
    ret = spline(fragCoord, depth);
  #else
    ret = spline(fragCoord, depth);
  #endif
#endif
  return selectFractal(ret);
}

mat3 inverseMatrix(vec2 translate, float rotate, vec2 scale) {
    return mat3(
        cos(-rotate)/scale.x,sin(-rotate)/scale.y,0.,
        -sin(-rotate)/scale.x,cos(-rotate)/scale.y,0.,
        -translate.x,-translate.y,1.
    );
}

void transformed( out vec4 fragColor, in vec2 fragCoord ) {
    float subScaling = PREFIX(subScaling);
    float subRotation = PREFIX(subRotation); // in Periode
    vec2 viewSize = vec2(PREFIX(uViewSizeWidth),PREFIX(uViewSizeHeight));
    vec2 subOffset = vec2(PREFIX(subOffset_x), PREFIX(subOffset_y))-vec2(viewSize.x*0.5, viewSize.y*0.5);
    mat3 matrix = inverseMatrix(subOffset, subRotation * toRad, vec2(subScaling));
    
    float val = 0.;
    
    float totalWeight = 0.;
    mat3 trans = mat3(1.);
    float weight = 1.;
    float complexity = PREFIX(complexity);
    float subInfluence = PREFIX(subInfluence);
    for (float i=1.; i<complexity; i++) {
        vec2 newCoord = (trans * vec3(fragCoord, 1.)).xy;
        val  += layer(newCoord, i) * weight;
        
        totalWeight += weight;
        
        trans = matrix * trans;
        weight *= subInfluence;
    }
    
    float f = fract(complexity);
    if (f == 0.) f = 1.;
    
    vec2 newCoord = (trans * vec3(fragCoord, 1.)).xy;
    val  += layer(newCoord, floor(complexity)+1.) * weight * f;

    totalWeight += weight * f;
    
    val /= totalWeight;

    // color
    int invert = PREFIX(invert);
    if (invert == 1) {
        val = 1. - val;
    }
    float contrast = PREFIX(contrast);
    float brightness = PREFIX(brightness);
    val = (val - 0.5) * contrast + 0.5;
    val += brightness;
    
    val = selectOverflow(val);
    
    fragColor = vec4(vec3(val),1.);
}

vec4 FractalNoise(vec2 tc) {
    vec2 viewSize = vec2(PREFIX(uViewSizeWidth),PREFIX(uViewSizeHeight));
    vec4 outColor = vec4(0.5);
    vec2 ratio = viewSize/iResolution;
    vec2 flipCoord = flip(tc*iResolutionOrig.xy)*ratio-vec2(viewSize.x*0.5, viewSize.y*0.5);
    float rotation = PREFIX(rotation); // in Periode
    vec2 zoom = vec2(PREFIX(zoomWidth), PREFIX(zoomHeight));
    vec2 offsetTurbulence = vec2(PREFIX(offsetTurbulence_x), PREFIX(offsetTurbulence_y));
    mat3 trans = inverseMatrix(offsetTurbulence, rotation * toRad, zoom);
    flipCoord = (trans * vec3(flipCoord, 1.)).xy;
    transformed(outColor, flipCoord);
    return outColor;
}


void main () {
    mat4 uMVP = PREFIX(uMVP);
    mat4 uModel = PREFIX(uModel);
    float uParticleSize = PREFIX(uParticleSize);
    float uSizeX = float(PREFIX(uSizeX));
    float uSizeY = float(PREFIX(uSizeY));
    float uSizeZ = float(PREFIX(uSizeZ));
    float uParticleInX = float(PREFIX(uParticleInX));
    float uParticleInY = float(PREFIX(uParticleInY));
    float uParticleInZ = float(PREFIX(uParticleInZ));
    float uDisperseX = PREFIX(uDisperseX);
    float uDisperseY = PREFIX(uDisperseY);
    float uDisperseZ = PREFIX(uDisperseZ);
    float FractalX = PREFIX(FractalX);
    float FractalY = PREFIX(FractalY);
    float FractalZ = PREFIX(FractalZ);
    float uIsRandomParticleSize = float(PREFIX(uIsRandomParticleSize));
    float uTwist = PREFIX(uTwist);
    float LightingPoint0Shininess = PREFIX(LightingPoint0Shininess);
    vec3 uLightingPoint0AmbientColor = PREFIX(uLightingPoint0AmbientColor).bgr;
    vec3 uLightingPoint0DiffuseColor = PREFIX(uLightingPoint0DiffuseColor).bgr;
    vec3 uLightingPoint0SpecularColor = PREFIX(uLightingPoint0SpecularColor).bgr;
    int uShape = PREFIX(uShape);
    int uIsFractalField = PREFIX(uIsFractalField);
    int uEnableLightingPoint0 = PREFIX(uEnableLightingPoint0);
    vec3 posLightingPoint = vec3(PREFIX(LightingPoint0_x),-PREFIX(LightingPoint0_y),PREFIX(LightingPoint0_z));
    vec3 pos = position.xyz;
    float radius = position.w;
    float aspect = iResolutionOrig.y / iResolutionOrig.x;
    float particleSize = (0.002+mix(1.0,radius,uIsRandomParticleSize)*0.01)*uParticleSize;
    vUV = texcoord.xy;
    vec3 spacing = vec3(uSizeX,uSizeY,uSizeZ)/300.0/vec3(uParticleInX,uParticleInY,uParticleInZ);
    float i = (position.z-uParticleInZ/2.0)*uParticleInY*uParticleInX+(position.y-uParticleInY/2.0)*uParticleInX+position.x-uParticleInX/2.0;
    if(uShape == 0){
        pos*= spacing;
    } else if(uShape == 1){
        spacing = spacing.zzz;
        float sphereRadius = abs((position.z+uParticleInZ/2.0+0.5)*spacing.z);
        float sphereRadiusH = sphereRadius*cos(3.1415926*position.y/uParticleInY);
        float sphereRadiusV = sphereRadius*(sin(3.1415926*position.y/uParticleInY));
        pos.x = sphereRadiusH*sin(3.1415926*2.0*position.x/uParticleInX);
        pos.y = sphereRadiusV;
        pos.z = sphereRadiusH*cos(3.1415926*2.0*position.x/uParticleInX);
    }
    if(uIsFractalField == 1){
        vec4 fractalNoiseX = FractalNoise(pos.yz);
        vec4 fractalNoiseY = FractalNoise(pos.xz);
        vec4 fractalNoiseZ = FractalNoise(pos.xy);
        pos += (vec3(fractalNoiseX.r,fractalNoiseY.r,fractalNoiseZ.r)-vec3(0.5))*spacing*2.0*vec3(FractalX,FractalY,FractalZ);
    }
    pos.yz = rot(pos.yz,uTwist*pos.x*50.0);
    pos+=vec3(uDisperseX,uDisperseY,uDisperseZ)*(vec3(rand(vec2(i*12.43,234.230)), rand(vec2(i*123.32,173.1523)),rand(vec2(i*34.35,3747.123)))-vec3(0.5))*vec3(aspect,1.0,1.0)*spacing;
    if(uEnableLightingPoint0==1){
        vec3 mPos = (uModel*vec4(pos,1.0)).xyz;
        vec3 lightDir = normalize(posLightingPoint-mPos);
        float distanceLight = distance(mPos,posLightingPoint);
        vec3 viewDir = normalize(vec3(0.0,0.0,10.0)-mPos);
        vec3 halfDir = normalize(lightDir + viewDir);
        vec3 normal = normalize(mPos);
        float Kd = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = uLightingPoint0DiffuseColor * Kd;
        vec3 specular = uLightingPoint0SpecularColor * pow(max(dot(normal, halfDir),0.0), LightingPoint0Shininess);
        vLighting = uLightingPoint0AmbientColor+diffuse + specular;
    } else {
        vLighting = vec3(1.0);
    }
    gl_Position = uMVP*uModel*vec4(pos,1.0)*vec4(aspect,1.0,1.0,1.0)+vec4(vec2(particleSize),0.0,0.0)*vec4(texcoord.xy*vec2(aspect,1.0),1.0,1.0);
    tc = vec2(0.5);
}