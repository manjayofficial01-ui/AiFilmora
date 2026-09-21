
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
    // vec3 normalMap = INPUT4(vec2(uv.x, 1.0-uv.y)).xyz;
    // vec3 normalMap = blur(vec2(uv.x, uv.y)).xyz;
    vec3 normalMap = INPUT2(uv).zyx;
    // vec3 normalMap = blur(vec2(uv.x, 1.0-uv.y)).xyz * vec3(1.0, 0.259, 0.78);
    normalMap = vec3(normalMap.x, 1.0-normalMap.y, 1.0-normalMap.z);
    normalMap = vec3(normalMap.z,normalMap.y,normalMap.x);
    normalMap = normalMap * 2. - 1.0;
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


    int lightEnable[8];
    vec3 lightDir[8];
    vec4 lightColor[8];
    float diffuseIntensity[8];
    float specularIntensity[8];
    float lightDecay[8];
    int lightType[8];

     // 光源1
    int Enable1 = PREFIX(LightEnable1);
    float posx1 = (PREFIX(PositionXX1) * 0.01 - 1.0) * (1.0 + 1.0) + 1.0;
    float posy1 = (PREFIX(PositionYY1) * 0.01 - 1.0) * (-1.0 - 1.0) - 1.0;
    float LightDis1 = (PREFIX(LightDistance1) * 0.01 - 1.0) * (1.0 + 0.7) + 1.0 ;
    float LightInt1 = (PREFIX(LightIntensity1) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float HighLig1 = (PREFIX(Highlight1) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float LightRad1 = (PREFIX(LightRadius1) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;

    lightEnable[0] = Enable1; //光源启用
    lightDir[0] = vec3(posx1,posy1,LightDis1);     //方向
    lightColor[0] = GetColor(PREFIX(LightColor1));                                       //颜色
    diffuseIntensity[0] = LightInt1;                                      //漫反射强度(0.0, 1.0)    （光源强度）
    specularIntensity[0] = HighLig1;                                          //镜面反射强度(0.0, 1.0) （高光）
    lightDecay[0] = LightRad1;                                               //光照衰减(0.0, 1.0) （光源半径）
    lightType[0] = PREFIX(LightType1);                                                    //0:Dir 1:Point

    // 光源2
    int Enable2 = PREFIX(LightEnable2);
    float posx2 = (PREFIX(PositionXX2) * 0.01 - 1.0) * (1.0 + 1.0) + 1.0;
    float posy2 = (PREFIX(PositionYY2) * 0.01 - 1.0) * (-1.0 - 1.0) - 1.0;
    float LightDis2 = (PREFIX(LightDistance2) * 0.01 - 1.0) * (1.0 + 0.7) + 1.0 ;
    float LightInt2 = (PREFIX(LightIntensity2) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float HighLig2 = (PREFIX(Highlight2) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float LightRad2 = (PREFIX(LightRadius2) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;

    lightEnable[1] = Enable2; //光源启用
    lightDir[1] = vec3(posx2,posy2,LightDis2);     //方向
    lightColor[1] = GetColor(PREFIX(LightColor2));                                       //颜色
    diffuseIntensity[1] = LightInt2;                                      //漫反射强度(0.0, 1.0)    （光源强度）
    specularIntensity[1] = HighLig2;                                          //镜面反射强度(0.0, 1.0) （高光）
    lightDecay[1] = LightRad2;                                               //光照衰减(0.0, 1.0) （光源半径）
    lightType[1] = PREFIX(LightType2);                                                 //0:Dir 1:Point

    // 光源3
    int Enable3 = PREFIX(LightEnable3);
    float posx3 = (PREFIX(PositionXX3) * 0.01 - 1.0) * (1.0 + 1.0) + 1.0;
    float posy3 = (PREFIX(PositionYY3) * 0.01 - 1.0) * (-1.0 - 1.0) - 1.0;
    float LightDis3 = (PREFIX(LightDistance3) * 0.01 - 1.0) * (1.0 + 0.7) + 1.0 ;
    float LightInt3 = (PREFIX(LightIntensity3) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float HighLig3 = (PREFIX(Highlight3) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float LightRad3 = (PREFIX(LightRadius3) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;

    lightEnable[2] = Enable3; //光源启用
    lightDir[2] = vec3(posx3,posy3,LightDis3);     //方向
    lightColor[2] = GetColor(PREFIX(LightColor3));                                       //颜色
    diffuseIntensity[2] = LightInt3;                                      //漫反射强度(0.0, 1.0)    （光源强度）
    specularIntensity[2] = HighLig3;                                          //镜面反射强度(0.0, 1.0) （高光）
    lightDecay[2] = LightRad3;                                               //光照衰减(0.0, 1.0) （光源半径）
    lightType[2] = PREFIX(LightType3);                                                 //0:Dir 1:Point

    // 光源4
    int Enable4 = PREFIX(LightEnable4);
    float posx4 = (PREFIX(PositionXX4) * 0.01 - 1.0) * (1.0 + 1.0) + 1.0;
    float posy4 = (PREFIX(PositionYY4) * 0.01 - 1.0) * (-1.0 - 1.0) - 1.0;
    float LightDis4 = (PREFIX(LightDistance4) * 0.01 - 1.0) * (1.0 + 0.7) + 1.0 ;
    float LightInt4 = (PREFIX(LightIntensity4) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float HighLig4 = (PREFIX(Highlight4) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float LightRad4 = (PREFIX(LightRadius4) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;

    lightEnable[3] = Enable4; //光源启用
    lightDir[3] = vec3(posx4,posy4,LightDis4);     //方向
    lightColor[3] = GetColor(PREFIX(LightColor4));                                       //颜色
    diffuseIntensity[3] = LightInt4;                                      //漫反射强度(0.0, 1.0)    （光源强度）
    specularIntensity[3] = HighLig4;                                          //镜面反射强度(0.0, 1.0) （高光）
    lightDecay[3] = LightRad4;                                               //光照衰减(0.0, 1.0) （光源半径）
    lightType[3] = PREFIX(LightType4);                                                 //0:Dir 1:Point

    // 光源5
    int Enable5 = PREFIX(LightEnable5);
    float posx5 = (PREFIX(PositionXX5) * 0.01 - 1.0) * (1.0 + 1.0) + 1.0;
    float posy5 = (PREFIX(PositionYY5) * 0.01 - 1.0) * (-1.0 - 1.0) - 1.0;
    float LightDis5 = (PREFIX(LightDistance5) * 0.01 - 1.0) * (1.0 + 0.7) + 1.0 ;
    float LightInt5 = (PREFIX(LightIntensity5) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float HighLig5 = (PREFIX(Highlight5) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float LightRad5 = (PREFIX(LightRadius5) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;

    lightEnable[4] = Enable5; //光源启用
    lightDir[4] = vec3(posx5,posy5,LightDis5);     //方向
    lightColor[4] = GetColor(PREFIX(LightColor5));                                       //颜色
    diffuseIntensity[4] = LightInt5;                                      //漫反射强度(0.0, 1.0)    （光源强度）
    specularIntensity[4] = HighLig5;                                          //镜面反射强度(0.0, 1.0) （高光）
    lightDecay[4] = LightRad5;                                               //光照衰减(0.0, 1.0) （光源半径）
    lightType[4] = PREFIX(LightType5);                                                 //0:Dir 1:Point

    // 光源6
    int Enable6 = PREFIX(LightEnable6);
    float posx6 = (PREFIX(PositionXX6) * 0.01 - 1.0) * (1.0 + 1.0) + 1.0;
    float posy6 = (PREFIX(PositionYY6) * 0.01 - 1.0) * (-1.0 - 1.0) - 1.0;
    float LightDis6 = (PREFIX(LightDistance6) * 0.01 - 1.0) * (1.0 + 0.7) + 1.0 ;
    float LightInt6 = (PREFIX(LightIntensity6) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float HighLig6 = (PREFIX(Highlight6) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float LightRad6 = (PREFIX(LightRadius6) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;

    lightEnable[5] = Enable6; //光源启用
    lightDir[5] = vec3(posx6,posy6,LightDis6);     //方向
    lightColor[5] = GetColor(PREFIX(LightColor6));                                       //颜色
    diffuseIntensity[5] = LightInt6;                                      //漫反射强度(0.0, 1.0)    （光源强度）
    specularIntensity[5] = HighLig6;                                          //镜面反射强度(0.0, 1.0) （高光）
    lightDecay[5] = LightRad6;                                               //光照衰减(0.0, 1.0) （光源半径）
    lightType[5] = PREFIX(LightType6);                                                 //0:Dir 1:Point

    // 光源7
    int Enable7 = PREFIX(LightEnable7);
    float posx7 = (PREFIX(PositionXX7) * 0.01 - 1.0) * (1.0 + 1.0) + 1.0;
    float posy7 = (PREFIX(PositionYY7) * 0.01 - 1.0) * (-1.0 - 1.0) - 1.0;
    float LightDis7 = (PREFIX(LightDistance7) * 0.01 - 1.0) * (1.0 + 0.7) + 1.0 ;
    float LightInt7 = (PREFIX(LightIntensity7) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float HighLig7 = (PREFIX(Highlight7) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float LightRad7 = (PREFIX(LightRadius7) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;

    lightEnable[6] = Enable7; //光源启用
    lightDir[6] = vec3(posx7,posy7,LightDis7);     //方向
    lightColor[6] = GetColor(PREFIX(LightColor7));                                       //颜色
    diffuseIntensity[6] = LightInt7;                                      //漫反射强度(0.0, 1.0)    （光源强度）
    specularIntensity[6] = HighLig7;                                          //镜面反射强度(0.0, 1.0) （高光）
    lightDecay[6] = LightRad7;                                               //光照衰减(0.0, 1.0) （光源半径）
    lightType[6] = PREFIX(LightType7);                                                 //0:Dir 1:Point

    // 光源8
    int Enable8 = PREFIX(LightEnable8);
    float posx8 = (PREFIX(PositionXX8) * 0.01 - 1.0) * (1.0 + 1.0) + 1.0;
    float posy8 = (PREFIX(PositionYY8) * 0.01 - 1.0) * (-1.0 - 1.0) - 1.0;
    float LightDis8 = (PREFIX(LightDistance8) * 0.01 - 1.0) * (1.0 + 0.7) + 1.0 ;
    float LightInt8 = (PREFIX(LightIntensity8) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float HighLig8 = (PREFIX(Highlight8) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;
    float LightRad8 = (PREFIX(LightRadius8) * 0.01 - 1.0) * (1.0 - 0.0) + 1.0 ;

    lightEnable[7] = Enable8; //光源启用
    lightDir[7] = vec3(posx8,posy8,LightDis8);     //方向
    lightColor[7] = GetColor(PREFIX(LightColor8));                                       //颜色
    diffuseIntensity[7] = LightInt8;                                      //漫反射强度(0.0, 1.0)    （光源强度）
    specularIntensity[7] = HighLig8;                                          //镜面反射强度(0.0, 1.0) （高光）
    lightDecay[7] = LightRad8;                                               //光照衰减(0.0, 1.0) （光源半径）
    lightType[7] = PREFIX(LightType8);                                                 //0:Dir 1:Point
    

    for(int i = 0; i < 8; i++){
      if(lightEnable[i] == 1){
        if (lightType[i] == 0){
          shading += CalcDirLight(oriCol.xyz, lightDir[i], lightColor[i], roughness, lightDecay[i], diffuseIntensity[i], specularIntensity[i], normalMap, viewDir, tc);
        }
        else if (lightType[i] == 1){
          shading += CalcPointLight(oriCol.xyz, lightDir[i], lightColor[i], roughness, lightDecay[i], diffuseIntensity[i], specularIntensity[i], normalMap, viewDir, tc);
        }
      }
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