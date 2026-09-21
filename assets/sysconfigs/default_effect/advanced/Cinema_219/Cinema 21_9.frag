vec2 resolution= iResolution;
vec4 outFragColor;
vec4 FUNCNAME(vec2 tc) 
{

	vec4 orig = INPUT(tc);
	vec3 borderColor = vec3(0.0);
    float Gap21To9 = 0.5*(resolution.y - 0.42857142857*resolution.x)/resolution.y;//PREFIX(borderH)/2.0;
	float borderH = PREFIX(borderH);
	float borderHeight = 0.0;
	if(borderH<0.0)
		borderHeight = Gap21To9*(borderH + 1.0);
	else
		borderHeight = (0.5 - Gap21To9)*borderH + Gap21To9;
	float alpha = PREFIX(alpha);
	
	if( tc.y > 1.0 - borderHeight||tc.y < borderHeight)
		return vec4(mix( orig.rgb, borderColor,alpha), orig.a);
    else return orig;
	
}
