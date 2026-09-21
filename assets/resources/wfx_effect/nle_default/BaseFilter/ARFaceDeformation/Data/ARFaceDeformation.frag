customize_in vec2 vUV;
customize_in vec2 vCenter;
customize_in float radius;

// Intersection point of ray and circle
vec2 ray_circle_point(vec2 p, vec2 center, vec2 dir, float r){
	dir = normalize(dir);
	vec2 pc = p-center;
	float b = dot(dir, pc);
	float delta = b*b-dot(pc, pc)+r*r;
	if(delta > 0.0){
		float t = (-b + sqrt(delta));
		return p+dir*t;
	}else{
		return p;
	}
}

vec2 myNormalize(vec2 v){
	if(v.x == 0.0 && v.y == 0.0){
		return vec2(0.0);
	}else{
		return normalize(v);
	}
}

vec4 FUNCNAME(vec2 tc) 
{
    int show = PREFIX(uIsShow);
    int transfer = PREFIX(uIsTransfer);
    int uIsBlend = PREFIX(uIsBlend);
    vec2 uv = vUV;
    if(uIsBlend == 0){
        float prop = iResolution.x/iResolution.y;
        float curRadius = radius;
        if(show == 1){
            vec4 fragColor = INPUT1(uv);
            vec2 center = vCenter;
            uv = (uv-0.5)*2.0;
            center = (center-0.5)*2.0;
            uv.x *= prop;
            center.x *= prop;
            float dis = length(uv-center);

            if(transfer == 1){
                vec2 centerOffset = PREFIX(uCenterOffset).xy;
                vec2 normOffset = abs(myNormalize(centerOffset));
                centerOffset *= normOffset*curRadius;
            
                if(dis < curRadius){
                    vec2 c = center;
                    vec2 m = c+centerOffset;
                    float d = length(m-c);
                    vec2 dir = m-c;
                    dir = myNormalize(dir);
                    float weight = 0.0;
                    if((uv.x != m.x) || (uv.y != m.y)){
                        vec2 lineDir = myNormalize(uv-m);
                        vec2 node = ray_circle_point(m, c, lineDir, curRadius);
                        weight = length(m-uv)/length(m-node);
                    }
                    weight = 1.0-weight;
                    uv = uv-dir*d*weight;
                    uv.x /= prop;
                    uv = uv*0.5+0.5;
                    fragColor = INPUT1(uv);
                }
                return fragColor;
            }

            if(dis < curRadius){
                float x = clamp(dis/curRadius, 0.0001,1.0);
                float y = INPUT2(vec2(x,.16666)).r;
                float k = y/x;
                uv = (uv-center)*k+center;		
                uv.x /= prop;
                uv = uv*0.5+0.5;		
                fragColor = INPUT1(uv);
            }
            return fragColor;
        }
        else{
            return vec4(0.0);
        }  
    }else if(uIsBlend == 1){       
        vec4 srcCol = INPUT1(uv);
        vec4 blendCol = INPUT2(uv);
        return srcCol*(1.0-blendCol.a)+blendCol;
    }else if(uIsBlend == 2){
        return INPUT1(uv);
    }
    
}