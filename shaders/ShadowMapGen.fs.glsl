precision mediump float;

uniform vec3 lightPosition;
uniform vec3 lightDirection;
uniform vec2 shadowClipNearFar;

uniform vec3 spotLightPosition;
uniform vec3 spotLightDirection;
uniform vec2 shadowClipNearFarSL;

varying vec3 fPos;

void main()
{
	vec3 fromLightToFrag = (fPos - lightPosition);
	vec3 fromSpotLightToFrag = (fPos - spotLightPosition);

	float lightFragDist = 0.0;
	float spotLightFragDist = 0.0;

	if (length(lightDirection) < 0.05) {
		lightFragDist = (length(fromLightToFrag) - shadowClipNearFar.x)
		/
		(shadowClipNearFar.y - shadowClipNearFar.x);
	} else {
		lightFragDist = 1.0;
	}

	if (length(spotLightDirection) < 0.05) {
		spotLightFragDist = (length(fromSpotLightToFrag) - shadowClipNearFarSL.x)
		/
		(shadowClipNearFarSL.y - shadowClipNearFarSL.x);
	} else {
		spotLightFragDist = 1.0;
	}
	
	gl_FragColor = vec4(lightFragDist + spotLightFragDist, lightFragDist + spotLightFragDist, lightFragDist + spotLightFragDist, 1.0);
}