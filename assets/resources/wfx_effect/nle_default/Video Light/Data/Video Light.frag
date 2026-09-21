
#define WorldSpaceCameraPos vec3(0.5,0.5,1.5)
#define FresnelPow 5.0
#define F0Base 0.04
#define PI 3.14159265359
#define MAX_LIGHTS 20


// 对素材做模糊
float insideBox(vec2 v, vec2 bottomLeft, vec2 topRight) {
    vec2 s = step(bottomLeft, v) - step(topRight, v);
    return s.x * s.y;
}
vec4 blur(vec2 uv){
  vec4 uBound = vec4(0.0,0.0,1.0,1.0);
  vec2 viewSize = vec2(300.0,300.0);
  float calLayer = 1.0;
  float curIteration = 1.0 + 1.0;

  vec4 fragColor = vec4(0.0);
  if(insideBox(TransTc(uv),uBound.xy,uBound.zw)>0.5){
      if(calLayer == 0.0){
          float f_curIteration = float(curIteration);
          vec2 halfpixel = 0.5 / (viewSize.xy / (pow(2.0, f_curIteration)));
          float offset = float(1.0);

          vec4 sum = INPUT4(uv) * 4.0;
          sum += INPUT4(uv - halfpixel.xy * offset);
          sum += INPUT4(uv + halfpixel.xy * offset);
          sum += INPUT4(uv + vec2(halfpixel.x, -halfpixel.y) * offset);
          sum += INPUT4(uv - vec2(halfpixel.x, -halfpixel.y) * offset);

          fragColor = sum / 8.0;
      }else if(calLayer == 1.0){
          float f_power = float(curIteration) - 2.0;
          vec2 halfpixel = 0.5 / (viewSize.xy * (pow(2.0, f_power)));
          float offset = float(1.0);

          vec4 sum = INPUT4(uv +vec2(-halfpixel.x * 2.0, 0.0) * offset);
          
          sum += INPUT4(uv + vec2(-halfpixel.x, halfpixel.y) * offset) * 2.0;
          sum += INPUT4(uv + vec2(0.0, halfpixel.y * 2.0) * offset);
          sum += INPUT4(uv + vec2(halfpixel.x, halfpixel.y) * offset) * 2.0;
          sum += INPUT4(uv + vec2(halfpixel.x * 2.0, 0.0) * offset);
          sum += INPUT4(uv + vec2(halfpixel.x, -halfpixel.y) * offset) * 2.0;
          sum += INPUT4(uv + vec2(0.0, -halfpixel.y * 2.0) * offset);
          sum += INPUT4(uv + vec2(-halfpixel.x, -halfpixel.y) * offset) * 2.0;

          fragColor = sum / 12.0; 
      }else{
          fragColor = INPUT4(uv);
      }
  }
  return fragColor;
}


//颜色转换
vec4 GetColor(int color){
    return vec4(float((color)&0xff),float((color>>8)&0xff),float((color>>16)&0xff), 255.0)/255.0;
}

//根据入射角和菲涅尔反射率计算菲涅尔效应的颜色
vec3 GetFresnel(float hov, vec3 F0)
{
    vec3 fresnel = F0 + (vec3(1.0) - F0) * pow((1.0 - hov), FresnelPow);
    return fresnel;
}

//根据法线和粗糙度计算 DGGX（GGX 分布函数）。
float GetDGGX(float noh, float roughness)
{ 
    float r2 = roughness * roughness;
    float r4 = r2 * r2;
    float nhGGX = noh * noh * (r4 - 1.0) + 1.0; 
    nhGGX = max(nhGGX, 0.001);
    float D = r4 / (PI * nhGGX * nhGGX);
    return D;
}

//根据法线、观察角和粗糙度计算 GSmith（GGX 函数的几何遮挡项）。
float GetGSmith(float nov, float nol, float roughness)
{
    float r2 = roughness + 1.0;
    float r4 = r2 * r2 / 8.0;
    float nvSmith = nov / (nov * (1.0 - r4) + r4 + 0.001); 
    float nlSmith = nol / (nol * (1.0 - r4) + r4 + 0.001);
    float G = nvSmith * nlSmith;
    return G;
}

//根据漫反射颜色计算漫反射光照。
vec3 GetDiffuse(vec3 diffuseColor)
{
    diffuseColor = diffuseColor / PI; 
    return diffuseColor;
}

//计算法线贴图
vec3 GetNormalMap(vec2 uv)
{
    vec3 normalMap = INPUT2(uv).zyx;
    normalMap = vec3(normalMap.x, 1.0-normalMap.y, 1.0-normalMap.z);
    normalMap = vec3(normalMap.z,normalMap.y,normalMap.x);
    normalMap = normalMap * 2. - 1.0;

    float mask = INPUT3(uv).r;
    vec3 normalMapTex = vec3(0.0,0.0,1.0);
    // normalMap = normalMapTex;
    normalMap = mix(normalMap,normalMapTex,1.0 - mask);

    normalMap = normalize(normalMap);
    return normalMap;
}

//平行光
vec3 CalcDirLight(vec3 albedo, vec3 lightDir_, vec4 lightColor, float uRoughness,float lightApart,float diffuseIntensity, float specularIntensity, vec3 normal, vec3 viewDir, vec2 uv)
{

    vec3 lightDir = normalize(lightDir_);
    vec3 fragPos = vec3(uv.x,uv.y,0.0);

    lightDir.y *= -1.0; 
    float uMetallic = 3.6;
    float nov = max(0.0, dot(normal, viewDir));
    vec3 F0 = mix(vec3(F0Base), albedo, uMetallic);
    vec3 h = normalize(lightDir + viewDir);
    float nol = max(0.0, dot(normal, lightDir));
    float noh = max(0.0, dot(normal, h));
    float hov = max(0.0, dot(h, viewDir));
    float D = GetDGGX(noh, uRoughness);
    float G = GetGSmith(nov, nol, uRoughness);
    vec3 fresnel = GetFresnel(hov, F0);
    vec3 ks = fresnel;
    vec3 kd = (vec3(1.0) - uMetallic) * (1.0 - uMetallic);
    vec3 diffuse = GetDiffuse(albedo) * nol * kd;
    vec3 specular = D * G * fresnel; 
    vec3 shading =  (specularIntensity * specular * 0.3 + diffuseIntensity * 3.0 * diffuse) * lightColor.rgb * lightColor.a;
    
    lightDir.y *= -1.0; 
    vec3 light_pos = lightDir + vec3(0.5,0.5,0.0);
    float distance_r = max(dot( light_pos - fragPos, lightDir),0.0); 

    if (distance_r< lightApart){
      distance_r = 0.0;
    }
    else{
      distance_r = distance_r - lightApart;
    }

    float attenuation_r;
    if (distance_r> 2.*lightApart){
      attenuation_r = 0.0;
    }
    else{
      attenuation_r = (1.0 + sin((distance_r/ (lightApart ) + 1.0) * PI/2.0))/2.0;
    }

    shading *= 0.7 * attenuation_r;

    

    return shading;
}

//点光源
vec3 CalcPointLight(vec3 albedo, vec3 lightPos, vec4 lightColor, float uRoughness,float lightDecay,float diffuseIntensity, float specularIntensity, vec3 normal, vec3 viewDir, vec2 uv)
{
    vec3 lightPos_ = (lightPos +1.)/2.0; 
    vec3 fragPos = vec3(uv.x,uv.y,0.0);
    if (iResolution.y>iResolution.x){
      fragPos.y *= iResolution.y/iResolution.x;
      lightPos_.y *= iResolution.y/iResolution.x;
    }
    else{
      fragPos.x *= iResolution.x/iResolution.y;
      lightPos_.x *= iResolution.x/iResolution.y;
    }
    
    vec3 lightDir_ = normalize(lightPos_ - fragPos);
    lightDir_.y = -lightDir_.y;

    float uMetallic = 3.6;
    float nov = max(0.0, dot(normal, viewDir));
    vec3 F0 = mix(vec3(F0Base), albedo, uMetallic);
    vec3 h = normalize(lightDir_ + viewDir);
    float nol = max(0.0, dot(normal, lightDir_));
    float noh = max(0.0, dot(normal, h));
    float hov = max(0.0, dot(h, viewDir));
    float D = GetDGGX(noh, uRoughness);
    float G = GetGSmith(nov, nol, uRoughness);
    vec3 fresnel = GetFresnel(hov, F0);
    vec3 ks = fresnel;
    vec3 kd = (vec3(1.0) - uMetallic) * (1.0 - uMetallic);
    vec3 diffuse = GetDiffuse(albedo) * nol * kd;
    vec3 specular = D * G * fresnel;
    vec3 shading =  (specularIntensity * 0.3 * specular + diffuseIntensity * 3.0 * diffuse) * lightColor.rgb * lightColor.a;

    vec3 cur = lightPos_ - fragPos;
    float distance = length(cur);
    float constant1 = 1.0;
    lightDecay = 0.85 - (lightDecay - 1.0)*(lightDecay - 1.0);
    float linear1 =  (1.0-lightDecay) * 1000.0;
    float quadratic1 = 100.0;
    float attenuation = 1.0 / (linear1 * (distance * distance));    
    attenuation *= 40.0;
    shading *= attenuation;


    // vec4 depth = INPUT6(vec2(uv.x+0.025, 1.0-uv.y));
    // float gray = dot(depth.rgb, vec3(0.299, 0.587, 0.114));
    // float depthFactor = smoothstep(-0.8, 0.3, gray);
    // shading *= depthFactor;

    
    return shading;
}

vec4 lut3DFilter(vec4 textureColor, float opacity){
  float blueColor = textureColor.r * 63.0;
  vec2 quad1;
  quad1.y = floor(floor(blueColor) / 8.0);
  quad1.x = floor(blueColor) - (quad1.y * 8.0);
  vec2 quad2;
  quad2.y = floor(ceil(blueColor) /8.0);
  quad2.x = ceil(blueColor) - (quad2.y * 8.0);
  vec2 texPos1;
  texPos1.x = (quad1.x * 1.0/8.0) + 0.5/512.0 + ((1.0/8.0 - 1.0/512.0) * textureColor.b);
  texPos1.y = (quad1.y * 1.0/8.0) + 0.5/512.0 + ((1.0/8.0 - 1.0/512.0) * textureColor.g);
  vec2 texPos2;
  texPos2.x = (quad2.x * 1.0/8.0) + 0.5/512.0 + ((1.0/8.0 - 1.0/512.0) * textureColor.b);
  texPos2.y = (quad2.y * 1.0/8.0) + 0.5/512.0 + ((1.0/8.0 - 1.0/512.0) * textureColor.g);
  vec4 newColor1 = INPUT5(texPos1);
  vec4 newColor2 = INPUT5(texPos2);
  vec4 newColor = mix(newColor1, newColor2, fract(blueColor));
  vec4 fragOutCol = vec4(mix(textureColor.rgb, newColor.rgb, opacity), textureColor.a);
  fragOutCol.rgb *= fragOutCol.a;
  return fragOutCol;
}

// screen
float blendScreen(float base, float blend) {
    return 1.0-((1.0-base)*(1.0-blend));
}
 
vec3 blendScreen(vec3 base, vec3 blend) {
    return vec3(blendScreen(base.r,blend.r),blendScreen(base.g,blend.g),blendScreen(base.b,blend.b));
}

vec3 blendFunc(vec3 base, vec3 blend, float opacity) {
    return (blendScreen(base, blend) * opacity + base * (1.0 - opacity));
}

vec4 relit(vec4 oriCol, vec2 tc)
{
    vec3 normalMap = GetNormalMap(tc);
    vec3 fragPos = vec3(tc.x,tc.y,0.0);
    vec3 viewDir = normalize(WorldSpaceCameraPos - fragPos);
    vec3 shading = vec3(0.0);
    float roughness = 0.4; //PREFIX(Roughness);                                           //粗糙度(0.0, 1.0)   



    vec3 lightDir = vec3(0.0); //光源方向
    vec4 lightColor = vec4(1.0); //光源颜色
    float diffuseIntensity;
    float specularIntensity;
    float lightDecay;
    int lightType;

    // 光源1
    float posx1 = (PREFIX(PositionXX1) * 0.01 - 1.0) * (1.5 + 1.5) + 1.5;
    float posy1 = (PREFIX(PositionYY1) * 0.01 - 1.0) * (-1.5 - 1.5) - 1.5;
    float LightDis1 = (PREFIX(LightDistance1) * 0.01 - 1.0) * (1.0 + 0.7) + 1.0 ;
    float LightInt1 = (PREFIX(LightIntensity) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float HighLig1 = (PREFIX(Highlight1) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float LightRad1 = (PREFIX(LightRadius1) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;

    lightDir = vec3(posx1,posy1,LightDis1);     //方向
    lightColor = GetColor(PREFIX(LightColor1));                                       //颜色
    diffuseIntensity = LightInt1;                                      //漫反射强度(0.0, 1.0)    （光源强度）
    specularIntensity = HighLig1;                                          //镜面反射强度(0.0, 1.0) （高光）
    lightDecay = LightRad1;                                               //光照衰减(0.0, 1.0) （光源半径）
    lightType = PREFIX(LightType1);                                                    //0:Dir 1:Point

    
    if (lightType == 0){
      shading += CalcDirLight(oriCol.xyz, lightDir, lightColor, roughness, lightDecay, diffuseIntensity, specularIntensity, normalMap, viewDir, tc);
    }
    else if (lightType == 1){
      shading += CalcPointLight(oriCol.xyz, lightDir, lightColor, roughness, lightDecay, diffuseIntensity, specularIntensity, normalMap, viewDir, tc);
    }
                              
    shading = clamp(shading,0.0,1.0);
    shading = clamp(shading * oriCol.xyz,0.0,1.0); 

	  return vec4(shading,1.0);
}

vec4 FUNCNAME(vec2 tc)
{
  if(PREFIX(uStep) == 0){
    return INPUT2(tc);
  }else if(PREFIX(uStep) == 1){
    vec4 oriCol = INPUT1(tc);
    vec4 shading = relit(oriCol, tc) * 2.0;
    return shading;
    // return INPUT2(tc);
  }else if(PREFIX(uStep) == 2){
    vec3 albedo_Color = vec3(1.0);
    vec4 oriCol = INPUT1(tc);
    vec4 shading_blur = INPUT2(tc);
    vec4 shading = INPUT3(tc);
    float IntensityOp = (PREFIX(Intensity) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    vec4 retCol = lut3DFilter(oriCol, IntensityOp);
    vec3 result = retCol.rgb * albedo_Color.rgb - dot(shading_blur.rgb,vec3(0.299 ,0.587,0.114)) * 0.1;  
    shading_blur = 2.0 * mix(shading,shading_blur,0.1);

    result = clamp(result,0.0,1.0);
    shading_blur = clamp(shading_blur,0.0,1.0);

    retCol.xyz = blendFunc(result, shading_blur.rgb, 1.0) * oriCol.a; 
    return vec4(retCol.xyz, oriCol.a);
    // return INPUT3(tc);
  }
}