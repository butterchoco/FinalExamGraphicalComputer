precision mediump float;

uniform vec3 pointLightPosition;
uniform vec2 shadowClipNearFar;

varying vec3 fPos;

const int POINTLIGHT = 0;
const int DIRLIGHT = 1;
const int SPOTLIGHT = 2;

void main()
{
	int lightType = 0;

	vec3 fromLightToFrag = (fPos - pointLightPosition);

	float lightFragDist = 1.0;

	if (lightType == POINTLIGHT) {	
		lightFragDist =
			(length(fromLightToFrag) - shadowClipNearFar.x)
			/
			(shadowClipNearFar.y - shadowClipNearFar.x);
	}

	gl_FragColor = vec4(lightFragDist, lightFragDist, lightFragDist, 1.0);
}