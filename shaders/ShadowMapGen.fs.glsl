precision mediump float;

uniform vec3 pointLightPosition;
uniform vec2 shadowClipNearFar;

uniform vec3 spotLightPosition;
uniform vec2 shadowClipNearFarSpotLight;

varying vec3 fPos;

void main()
{
	vec3 fromLightToFrag = (fPos - pointLightPosition);
	vec3 fromSpotLightToFrag = (fPos - spotLightPosition);

	float lightFragDist =
		(length(fromLightToFrag) - shadowClipNearFar.x)
		/
		(shadowClipNearFar.y - shadowClipNearFar.x);

	float spotLightFragDist =
		(length(fromSpotLightToFrag) - shadowClipNearFarSpotLight.x)
		/
		(shadowClipNearFarSpotLight.y - shadowClipNearFarSpotLight.x);

	gl_FragColor = vec4(lightFragDist, lightFragDist, lightFragDist, 1.0);
}