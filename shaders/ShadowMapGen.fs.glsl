precision mediump float;

uniform vec3 lightPosition;
uniform vec3 lightDirection;
uniform vec2 shadowClipNearFar;

varying vec3 fPos;

void main()
{
	vec3 fromLightToFrag = (fPos - lightPosition);

	float lightFragDist = 0.0;

	if (length(lightDirection) < 0.05) {
		lightFragDist = (length(fromLightToFrag) - shadowClipNearFar.x)
		/
		(shadowClipNearFar.y - shadowClipNearFar.x);
	} else {
		lightFragDist = 1.0;
	}
	
	gl_FragColor = vec4(lightFragDist, lightFragDist, lightFragDist, 1.0);
}