precision mediump float;

uniform vec3 pointLightPosition;
uniform vec3 dirLightDirection;

uniform vec3 pointLightColor;
uniform vec3 dirLightColor;
uniform vec4 meshColor;

uniform float pointLightBase;
uniform float dirLightBase;

uniform samplerCube lightShadowMap;
uniform vec2 shadowClipNearFar;

uniform float bias;

varying vec3 fPos;
varying vec3 fNorm;

void main()
{

	vec3 toLightNormal = normalize(pointLightPosition - fPos);

	float fromLightToFrag =
		(length(fPos - pointLightPosition) - shadowClipNearFar.x)
		/
		(shadowClipNearFar.y - shadowClipNearFar.x);

	float shadowMapValue = textureCube(lightShadowMap, -toLightNormal).r;

	float pointLightInt = 0.0;
	if ((shadowMapValue + bias) >= fromLightToFrag) {
		pointLightInt += pointLightBase * max(dot(fNorm, toLightNormal), 0.0);
	}

	float dirLightInt = dirLightBase * max(dot(fNorm, dirLightDirection), 0.0);

	vec3 finalLightColor = pointLightColor * pointLightInt + dirLightColor * dirLightInt;

	vec3 finalColor = vec3(
		meshColor.r * finalLightColor.r,
		meshColor.g * finalLightColor.g,
		meshColor.b * finalLightColor.b
	);

	gl_FragColor = vec4(finalColor, meshColor.a);
}