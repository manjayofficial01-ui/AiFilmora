customize_in vec3 vPos;
customize_in vec3 vUV;
customize_in mat3 vTangentBasis;
customize_in float vAlpha;

#define PI 3.141592
#define TwoPI (2.0 * PI)
#define Epsilon 0.00001

// Constant normal incidence Fresnel factor for all dielectrics.
#define Fdielectric vec3(0.04)


// GGX/Towbridge-Reitz normal distribution function.
// Uses Disney's reparametrization of alpha = roughness^2.
float ndfGGX(float cosLh, float roughness)
{
    float alpha   = roughness * roughness;
    float alphaSq = alpha * alpha;

    float denom = (cosLh * cosLh) * (alphaSq - 1.0) + 1.0;
    return alphaSq / (PI * denom * denom);
}

// Single term for separable Schlick-GGX below.
float gaSchlickG1(float cosTheta, float k)
{
    return cosTheta / (cosTheta * (1.0 - k) + k);
}

// Schlick-GGX approximation of geometric attenuation function using Smith's method.
float gaSchlickGGX(float cosLi, float cosLo, float roughness)
{
    float r = roughness + 1.0;
    float k = (r * r) / 8.0; // Epic suggests using this roughness remapping for analytic lights.
    return gaSchlickG1(cosLi, k) * gaSchlickG1(cosLo, k);
}

// Shlick's approximation of the Fresnel factor.
vec3 fresnelSchlick(vec3 F0, float cosTheta)
{
    return F0 + (vec3(1.0) - F0) * pow(1.0 - cosTheta, 5.0);
}

// ----------------------------------------------------------------------------
vec3 fresnelSchlickRoughness(vec3 F0, float cosTheta, float roughness)
{
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

vec2 cubeTC(vec3 N){
    float Env_angle = PREFIX(Env_angle)*TwoPI/360.0;
    float Env_vertical_angle = PREFIX(Env_vertical_angle)*TwoPI/360.0;
    vec3 tN = N;
    tN.yz = rotate(tN.yz,Env_vertical_angle);
    tN.xz = rotate(tN.xz,Env_angle);
    float phi   = atan(tN.z, tN.x);
    float theta = acos(tN.y);
    return vec2(phi/TwoPI, theta/PI);
}

vec3 getSpecularIrradiance(vec2 uv, int level){
    if(level == 0){
        return INPUT8(uv).rgb;
    }else if(level == 1){
        return INPUT9(uv).rgb;
    }else if(level == 2){
        return INPUT10(uv).rgb;
    }else if(level == 3){
        return INPUT11(uv).rgb;
    }else if(level == 4){
        return INPUT12(uv).rgb;
    }else if(level == 5){
        return INPUT13(uv).rgb;
    }else if(level == 6){
        return INPUT14(uv).rgb;
    } else 
        return vec3(0.0);
}

vec3 getSpecularIrradianceLod(vec2 uv, float lod){
    int curLevel = int(floor(lod));
    int nextLevel = curLevel+1;
    return mix(getSpecularIrradiance(uv,curLevel),getSpecularIrradiance(uv,nextLevel),lod-float(curLevel));
}

vec2 ParallaxOffset( float h, float height, vec3 viewDir)
{
    h = h * height - height/2.0;
    vec3 v = normalize(viewDir);
    v.z += 0.42;
    return h * (v.xy / v.z);
}

vec2 FaceTC(int faceMode,vec2 tc){
    int texMapMode = PREFIX(texMapMode);
    vec2 tcList[9];
    //texMapMode = 0
    tcList[0] = tc;
    tcList[1] = tc;
    tcList[2] = tc;
    //texMapMode = 1
    tcList[3] = vec2(tc.x,(tc.y-0.001)/2.0);
    tcList[4] = vec2(tc.x,1.001/2.0+tc.y/2.0);
    tcList[5] = vec2(tc.x,1.001/2.0+tc.y/2.0);
    //texMapMode = 2
    tcList[6] = vec2(tc.x,(tc.y-0.001)/3.0);
    tcList[7] = vec2(tc.x,1.001/3.0+tc.y/3.0);
    tcList[8] = vec2(tc.x,2.001/3.0+tc.y/3.0);
    return tcList[texMapMode*3+faceMode];
}

vec3 GetColor(int color){
    return vec3(float((color)&0xff),float((color>>8)&0xff),float((color>>16)&0xff))/255.0;
}

vec3 SRGBtoLINEAR(vec3 srgb) {
    return srgb;
}

vec4 Show(){
    float step05 = step(0.5,vUV.z);
    float step15 = step(1.5,vUV.z);
    vec3 eyePosition = vec3(PREFIX(CameraPos_x),PREFIX(CameraPos_y),PREFIX(CameraPos_z));
    vec3 Lo = normalize(eyePosition - vPos);
    float ParallaxScale = PREFIX(ParallaxScale);
    float enable_image_albedo = float(PREFIX(enable_image_albedo))*(1.0-step05)+float(PREFIX(enable_image_albedo_edge))*(step05-step15)+float(PREFIX(enable_image_albedo_bevel))*step15;
    float enable_image_metalness = float(PREFIX(enable_image_metalness))*(1.0-step05)+float(PREFIX(enable_image_metalness_edge))*(step05-step15)+float(PREFIX(enable_image_metalness_bevel))*step15;
    float enable_image_normal = float(PREFIX(enable_image_normal))*(1.0-step05)+float(PREFIX(enable_image_normal_edge))*(step05-step15)+float(PREFIX(enable_image_normal_bevel))*step15;
    float enable_image_roughness = float(PREFIX(enable_image_roughness))*(1.0-step05)+float(PREFIX(enable_image_roughness_edge))*(step05-step15)+float(PREFIX(enable_image_roughness_bevel))*step15;
    float enable_image_height = float(PREFIX(enable_image_height))*(1.0-step05)+float(PREFIX(enable_image_height_edge))*(step05-step15)+float(PREFIX(enable_image_height_bevel))*step15;
    
    vec3 albedo_ratio = GetColor(PREFIX(albedo))*(1.0-step05)+GetColor(PREFIX(albedo_edge))*(step05-step15)+GetColor(PREFIX(albedo_bevel))*step15;
    float metalness_ratio = PREFIX(metalness)*(1.0-step05)+PREFIX(metalness_edge)*(step05-step15)+PREFIX(metalness_bevel)*step15;
    vec3 normal_ratio = GetColor(PREFIX(normal))*(1.0-step05)+GetColor(PREFIX(normal_edge))*(step05-step15)+GetColor(PREFIX(normal_bevel))*step15;
    float roughness_ratio = PREFIX(roughness)*(1.0-step05)+PREFIX(roughness_edge)*(step05-step15)+PREFIX(roughness_bevel)*step15;
    float height_ratio = PREFIX(height)*(1.0-step05)+PREFIX(height_edge)*(step05-step15)+PREFIX(height_bevel)*step15;
    float normal_strength = PREFIX(normal_strength)*(1.0-step05)+PREFIX(normal_strength_edge)*(step05-step15)+PREFIX(normal_strength_bevel)*step15;
    
    vec2 limitUV = fract(vUV.xy);
    float height = 0.0;
    vec2 UV;
    vec3 albedo;
    float metalness = 0.0;
    float roughness = 0.0;
    vec3 N;
    int faceMode = int(step05)+int(step15);
    limitUV = FaceTC(faceMode,limitUV);
    height = mix(1.0,INPUT5(limitUV).r,enable_image_height)*height_ratio;
    vec2 Offset = ParallaxOffset(height,ParallaxScale,Lo);
    UV = fract(vUV.xy + Offset);
    UV = FaceTC(faceMode,UV);
    // Sample input textures to get shading model params.
    albedo = mix(vec3(1.0),INPUT1(limitUV).rgb,enable_image_albedo)*albedo_ratio;
    metalness = mix(1.0,INPUT2(limitUV).r,enable_image_metalness)*metalness_ratio;
    roughness = mix(1.0,INPUT4(limitUV).r,enable_image_roughness)*roughness_ratio;
    // Outgoing light direction (vector from world-space fragment position to the "eye").

    // Get current fragment's normal and transform to world space.
    N = normalize(2.0 * mix(vec3(1.0),INPUT3(UV).rgb,enable_image_normal)*normal_ratio - 1.0);
    N.yz *=normal_strength;
    N = normalize(N);
    N = mix(vec3(N.r,N.b,N.g),vec3(N.r,N.b,-N.g),step05);
    
    N = normalize(vTangentBasis * N);
    // Angle between surface normal and outgoing light direction.
    float cosLo = max(0.0, dot(N, Lo));

    // Specular reflection vector.
    vec3 Lr = 2.0 * cosLo * N - Lo;

    // Fresnel reflectance at normal incidence (for metals use albedo color).
    vec3 F0 = mix(Fdielectric, albedo.bgr, metalness);

    // Direct lighting calculation for analytical lights.
    vec3 directLighting = vec3(0);

    vec3 posLightingPoint[6];
    posLightingPoint[0] = vec3(PREFIX(LightingPoint0_x),PREFIX(LightingPoint0_y),PREFIX(LightingPoint0_z));
    posLightingPoint[1] = vec3(PREFIX(LightingPoint1_x),PREFIX(LightingPoint1_y),PREFIX(LightingPoint1_z));
    posLightingPoint[2] = vec3(PREFIX(LightingPoint2_x),PREFIX(LightingPoint2_y),PREFIX(LightingPoint2_z));
    posLightingPoint[3] = vec3(PREFIX(LightingPoint3_x),PREFIX(LightingPoint3_y),PREFIX(LightingPoint3_z));
    posLightingPoint[4] = vec3(PREFIX(LightingPoint4_x),PREFIX(LightingPoint4_y),PREFIX(LightingPoint4_z));
    posLightingPoint[5] = vec3(PREFIX(LightingPoint5_x),PREFIX(LightingPoint5_y),PREFIX(LightingPoint5_z));
    float LightingPointShininess[6];
    LightingPointShininess[0] = PREFIX(LightingPoint0Shininess);
    LightingPointShininess[1] = PREFIX(LightingPoint1Shininess);
    LightingPointShininess[2] = PREFIX(LightingPoint2Shininess);
    LightingPointShininess[3] = PREFIX(LightingPoint3Shininess);
    LightingPointShininess[4] = PREFIX(LightingPoint4Shininess);
    LightingPointShininess[5] = PREFIX(LightingPoint5Shininess);
    int LightingPointColor[6];
    LightingPointColor[0] = PREFIX(LightingPoint0Color);
    LightingPointColor[1] = PREFIX(LightingPoint1Color);
    LightingPointColor[2] = PREFIX(LightingPoint2Color);
    LightingPointColor[3] = PREFIX(LightingPoint3Color);
    LightingPointColor[4] = PREFIX(LightingPoint4Color);
    LightingPointColor[5] = PREFIX(LightingPoint5Color);
    for(int i=0; i<PREFIX(LightingPointCount); ++i)
    {
        vec3 Li = posLightingPoint[i]-vPos;
        float dis = length(Li);
        Li = normalize(Li);
        vec3 Lradiance = (vec3(LightingPointShininess[i])/max(pow(dis,2.0),0.001)).bgr;

        // Half-vector between Li and Lo.
        vec3 Lh = normalize(Li + Lo);

        // Calculate angles between surface normal and various light vectors.
        float cosLi = max(0.0, dot(N, Li));
        float cosLh = max(0.0, dot(N, Lh));

        // Calculate Fresnel term for direct lighting. 
        vec3 F  = fresnelSchlick(F0, max(0.0, dot(Lh, Lo)));
        // Calculate normal distribution for specular BRDF.
        float D = ndfGGX(cosLh, roughness);
        // Calculate geometric attenuation for specular BRDF.
        float G = gaSchlickGGX(cosLi, cosLo, roughness);

        // Diffuse scattering happens due to light being refracted multiple times by a dielectric medium.
        // Metals on the other hand either reflect or absorb energy, so diffuse contribution is always zero.
        // To be energy conserving we must scale diffuse BRDF contribution based on Fresnel factor & metalness.
        vec3 kd = mix(vec3(1.0) - F, vec3(0.0), metalness);

        // Lambert diffuse BRDF.
        // We don't scale by 1/PI for lighting & material units to be more convenient.
        // See: https://seblagarde.wordpress.com/2012/01/08/pi-or-not-to-pi-in-game-lighting-equation/
        vec3 diffuseBRDF = kd * albedo.bgr;

        // Cook-Torrance specular microfacet BRDF.
        vec3 specularBRDF = (F * D * G) / max(Epsilon, 4.0 * cosLi * cosLo);

        // Total contribution for this light.
        directLighting += (diffuseBRDF + specularBRDF) * GetColor(LightingPointColor[i]).bgr * Lradiance * cosLi;
    }
    
    // Ambient lighting (IBL).
    vec3 ambientLighting;
    {
        // Sample diffuse irradiance at normal direction.
        vec3 irradiance = SRGBtoLINEAR(INPUT7(cubeTC(N)).bgr);

        // Calculate Fresnel term for ambient lighting.
        // Since we use pre-filtered cubemap(s) and irradiance is coming from many directions
        // use cosLo instead of angle with light's half-vector (cosLh above).
        // See: https://seblagarde.wordpress.com/2011/08/17/hello-world/
        vec3 F;
        if(PREFIX(enable_fresnel_schlick_roughness) == 1){
            F = fresnelSchlickRoughness(F0, cosLo, roughness);
        } else {
            F = fresnelSchlick(F0, cosLo);
        }

        // Get diffuse contribution factor (as with direct lighting).
        vec3 kd = mix(vec3(1.0) - F, vec3(0.0), metalness);

        // Irradiance map contains exitant radiance assuming Lambertian BRDF, no need to scale by 1/PI here either.
        vec3 diffuseIBL = kd * SRGBtoLINEAR(albedo.bgr) * irradiance;

        // Sample pre-filtered specular reflection environment at correct mipmap level.
        int specularTextureLevels = 6;
        //vec3 specularIrradiance = INPUT7(cubeTC(Lr), int(roughness * float(specularTextureLevels))).rgb;
        vec3 specularIrradiance = SRGBtoLINEAR(getSpecularIrradianceLod(cubeTC(Lr),(roughness * float(specularTextureLevels))).bgr);

        // Split-sum approximation factors for Cook-Torrance specular BRDF.
        vec2 specularBRDF = INPUT6(vec2(cosLo, 1.0-roughness)).bg;

        // Total specular IBL contribution.
        vec3 specularIBL = (F0 * specularBRDF.x + specularBRDF.y) * specularIrradiance;

        // Total ambient lighting contribution.
        ambientLighting = diffuseIBL + specularIBL;
    }

    vec3 color = albedo*0.2 + ambientLighting.bgr*PREFIX(IBL_strength) + (1.0-float(PREFIX(is_global_boom)))*directLighting.bgr;

    // HDR tonemapping
    //color = color / (color + vec3(1.0));
    // gamma correct
    //color = pow(color, vec3(1.0/2.2));

    vec4 retCol = vec4(mix(color,color*step(0.2,max(max(color.r,color.g),color.b)),float(PREFIX(is_global_boom))),1.0);
	retCol.a = vAlpha;
	retCol.rgb *= retCol.a;
    retCol = mix(retCol,vec4(vTangentBasis[1].xyz,vAlpha),(1.0-float(PREFIX(is_global_boom)))*step(100.0,vUV.z));//Cursor
	return retCol;
}

vec3 GetNormal(){
    float step05 = step(0.5,vUV.z);
    float step15 = step(1.5,vUV.z);
    vec3 eyePosition = vec3(PREFIX(CameraPos_x),PREFIX(CameraPos_y),PREFIX(CameraPos_z));
    vec3 Lo = normalize(eyePosition - vPos);
    float ParallaxScale = PREFIX(ParallaxScale);
    float enable_image_normal = float(PREFIX(enable_image_normal))*(1.0-step05)+float(PREFIX(enable_image_normal_edge))*(step05-step15)+float(PREFIX(enable_image_normal_bevel))*step15;
    float enable_image_height = float(PREFIX(enable_image_height))*(1.0-step05)+float(PREFIX(enable_image_height_edge))*(step05-step15)+float(PREFIX(enable_image_height_bevel))*step15;

    vec3 normal_ratio = GetColor(PREFIX(normal))*(1.0-step05)+GetColor(PREFIX(normal_edge))*(step05-step15)+GetColor(PREFIX(normal_bevel))*step15;
    float height_ratio = PREFIX(height)*(1.0-step05)+PREFIX(height_edge)*(step05-step15)+PREFIX(height_bevel)*step15;
    float normal_strength = PREFIX(normal_strength)*(1.0-step05)+PREFIX(normal_strength_edge)*(step05-step15)+PREFIX(normal_strength_bevel)*step15;
    
    vec2 limitUV = fract(vUV.xy);
    float height = 0.0;
    vec2 UV;
    vec3 N;
    int faceMode = int(step05)+int(step15);
    limitUV = FaceTC(faceMode,limitUV);
    height = mix(1.0,INPUT5(limitUV).r,enable_image_height)*height_ratio;
    vec2 Offset = ParallaxOffset(height,ParallaxScale,Lo);
    UV = fract(vUV.xy + Offset);
    UV = FaceTC(faceMode,UV);

    // Get current fragment's normal and transform to world space.
    N = normalize(2.0 * mix(vec3(1.0),INPUT3(UV).rgb,enable_image_normal)*normal_ratio - 1.0);
    N.yz *=normal_strength;
    N = normalize(N);
    N = mix(vec3(N.r,N.b,N.g),vec3(N.r,N.b,-N.g),step05);
    
    N = normalize(vTangentBasis * N);
    return N;
}

vec4 ShowSolidColor(){
    float step05 = step(0.5,vUV.z);
    float step15 = step(1.5,vUV.z);
    float enable_image_albedo = float(PREFIX(enable_image_albedo))*(1.0-step05)+float(PREFIX(enable_image_albedo_edge))*(step05-step15)+float(PREFIX(enable_image_albedo_bevel))*step15;
    vec3 albedo_ratio = GetColor(PREFIX(albedo))*(1.0-step05)+GetColor(PREFIX(albedo_edge))*(step05-step15)+GetColor(PREFIX(albedo_bevel))*step15;
    vec2 limitUV = fract(vUV.xy);
    int faceMode = int(step05)+int(step15);
    limitUV = FaceTC(faceMode,limitUV);
    vec3 albedo = mix(vec3(1.0),INPUT1(limitUV).rgb,enable_image_albedo)*albedo_ratio;

    int ShowModel = PREFIX(ShowModel);
    if(ShowModel == 2 && step15 > 0.5){//bevel
        vec3 N = GetNormal();
        vec3 LightingPointColor0 = GetColor(PREFIX(LightingPoint0Color));
        albedo = mix(LightingPointColor0,albedo,abs(N.z));
    }else if(ShowModel == 3 && (step05-step15) > 0.5){//edge
        vec3 N = GetNormal();
        vec3 LightingPointColor0 = GetColor(PREFIX(LightingPoint0Color));
        albedo = mix(LightingPointColor0,albedo,step(0.94,(N.y+1.0)/2.0));
    }else if(ShowModel == 4 && (1.0-step05) > 0.5){//face
        float enable_image_albedo_bevel = float(PREFIX(enable_image_albedo_bevel));
        vec3 albedo_ratio_bevel = GetColor(PREFIX(albedo_bevel));
        vec3 albedo_bevel = mix(vec3(1.0),INPUT1(limitUV).rgb,enable_image_albedo_bevel)*albedo_ratio_bevel;
        vec3 N = GetNormal();
        vec3 LightingPointColor0 = GetColor(PREFIX(LightingPoint0Color));
        albedo = mix(LightingPointColor0,mix(albedo_bevel,albedo,step(0.0,N.z)),abs(N.z));
    }
    vec4 retCol = vec4(albedo,1.0);
    retCol.a = vAlpha;
    retCol.rgb *= retCol.a;
    retCol = mix(retCol,vec4(vTangentBasis[1].xyz,vAlpha),step(100.0,vUV.z));//Cursor
    return retCol;
}

vec3 admix(vec3 src1,vec3 src2){
    return vec3(1.0)-(vec3(1.0)-src1)*(vec3(1.0)-src2);
}

vec4 Boom(){
    // Direct lighting calculation for analytical lights.
    vec3 directLighting = vec3(0);
    vec3 posLightingPoint[6];
    posLightingPoint[0] = vec3(PREFIX(LightingPoint0_x),PREFIX(LightingPoint0_y),PREFIX(LightingPoint0_z));
    posLightingPoint[1] = vec3(PREFIX(LightingPoint1_x),PREFIX(LightingPoint1_y),PREFIX(LightingPoint1_z));
    posLightingPoint[2] = vec3(PREFIX(LightingPoint2_x),PREFIX(LightingPoint2_y),PREFIX(LightingPoint2_z));
    posLightingPoint[3] = vec3(PREFIX(LightingPoint3_x),PREFIX(LightingPoint3_y),PREFIX(LightingPoint3_z));
    posLightingPoint[4] = vec3(PREFIX(LightingPoint4_x),PREFIX(LightingPoint4_y),PREFIX(LightingPoint4_z));
    posLightingPoint[5] = vec3(PREFIX(LightingPoint5_x),PREFIX(LightingPoint5_y),PREFIX(LightingPoint5_z));
    float LightingPointShininess[6];
    LightingPointShininess[0] = PREFIX(LightingPoint0Shininess);
    LightingPointShininess[1] = PREFIX(LightingPoint1Shininess);
    LightingPointShininess[2] = PREFIX(LightingPoint2Shininess);
    LightingPointShininess[3] = PREFIX(LightingPoint3Shininess);
    LightingPointShininess[4] = PREFIX(LightingPoint4Shininess);
    LightingPointShininess[5] = PREFIX(LightingPoint5Shininess);
    int LightingPointColor[6];
    LightingPointColor[0] = PREFIX(LightingPoint0Color);
    LightingPointColor[1] = PREFIX(LightingPoint1Color);
    LightingPointColor[2] = PREFIX(LightingPoint2Color);
    LightingPointColor[3] = PREFIX(LightingPoint3Color);
    LightingPointColor[4] = PREFIX(LightingPoint4Color);
    LightingPointColor[5] = PREFIX(LightingPoint5Color);
    for(int i=0; i<PREFIX(LightingPointCount); ++i)
    {
        vec3 Li = posLightingPoint[i]-vPos;
        float dis = length(Li);
        vec3 Lradiance = min(vec3(LightingPointShininess[i])/max(pow(dis,15.0),0.001),5.0);
        // Total contribution for this light.
        //directLighting = admix(directLighting, Lradiance*GetColor(LightingPointColor[i]));
        directLighting += Lradiance*GetColor(LightingPointColor[i]);
    }
    return vec4(directLighting*(directLighting.r+directLighting.g+directLighting.b)/3.0,(directLighting.r+directLighting.g+directLighting.b)/3.0)*(1.0-step(100.0,vUV.z));
}

vec4 FUNCNAME(vec2 tc) {
    int is_boom = PREFIX(is_boom);
    int ShowModel = PREFIX(ShowModel);
    if(is_boom == 1){
        return Boom();
    }else{
        if(ShowModel==0){
            return Show();
        }else if(ShowModel>0){//纯色
            return ShowSolidColor();
        }
    }
}
