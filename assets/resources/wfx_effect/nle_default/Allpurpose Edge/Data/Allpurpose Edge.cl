#define vec2 float2
#define vec3 float3
#define vec4 float4
#define rgb xyz
#define rgba xyzw

const sampler_t sampler = CLK_NORMALIZED_COORDS_TRUE | CLK_ADDRESS_CLAMP_TO_EDGE | CLK_FILTER_LINEAR;

vec4 INPUTSRC(image2d_t src_data,__global FilterParam* param, vec2 tc)
{
    tc = (vec2)(tc.x, tc.y)*(vec2)(param->origROI[2], param->origROI[3]) + (vec2)(param->origROI[0], param->origROI[1]);
    return read_imagef(src_data, sampler, (vec2)(tc.x, 1.0f - tc.y));
}

__kernel void MAIN(
      __read_only image2d_t src_data,
      __write_only image2d_t dest_data,        //Data in global memory
      __global FilterParam* param,
      int color,
      float thickness,
      int opacity)
{    
    int W = get_global_size(0);
    int H = get_global_size(1);
    
    int w = get_global_id(0);
    int h = get_global_id(1);
    float2 resolution = (float2)(W,H);
    int2 gl_FragCoord = (int2)(get_global_id(0), get_global_id(1));
    vec2 fragCoord = (vec2)(get_global_id0( param), get_global_id1( param));
    vec2 tc = ((vec2)(fragCoord.x, fragCoord.y) + (vec2)(0.5f))/resolution.xy;

    vec3 inputCol = (vec3)((float)(color & 0xff), (float)((color >> 8) & 0xff), (float)((color >> 16) & 0xff)) / 255.0f;
    
    vec4 origCol = INPUTSRC(src_data, param, tc);
    vec4 retCol = origCol;
    
    float twoPI = 3.141592653f * 2.0f;
    int samples = 48;
    
    vec2 aspect = 1.0f / resolution.xy;
    float radius = 10.0f * thickness / 30.0f;
    float mask = 0.0f;
    
    float stepSize = twoPI / (float)(samples);
    for (int idx = 0; idx < samples; idx++) {
        float i = (float)(idx) * stepSize;
        vec2 offset = (vec2)(sin(i), cos(i)) * aspect * radius;
        vec4 col = INPUTSRC(src_data, param, tc + offset);
        float dis = smoothstep(0.0f, 1.0f, distance(col.w, origCol.w));
        mask = mix(mask, 1.0f, dis);
    }
    
    if(origCol.w > 0.0f){
        origCol.rgb /= origCol.w;
    }
    
    retCol.rgb = mix(inputCol.zyx * mask * (float)(opacity) / 100.0f, origCol.rgb, origCol.w);
    retCol.w = max(mask, origCol.w);
    
    write_imagef(dest_data, (int2)(w, H - h - 1), retCol);
}


    