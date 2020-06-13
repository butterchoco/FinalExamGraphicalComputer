precision mediump float;

uniform vec3 pointLightPosition;
uniform vec3 spotLightPosition;
uniform vec4 meshColor;

uniform samplerCube lightShadowMap;
uniform samplerCube spotLightShadowMap;
uniform vec2 shadowClipNearFar;
uniform vec2 shadowClipNearFarSpotLight;

uniform float bias;
uniform float biasSpotLight;

varying vec3 fPos;
varying vec3 fNorm;

void main()
{

	vec3 directionalLight = normalize(vec3(0.6, 1.0, 0.3));
	vec3 toLightNormal = normalize(pointLightPosition - fPos);
	vec3 toSpotLightNormal = normalize(spotLightPosition - fPos);

	float fromLightToFrag =
		(length(fPos - pointLightPosition) - shadowClipNearFar.x)
		/
		(shadowClipNearFar.y - shadowClipNearFar.x);

	float fromSpotLightToFrag =
		(length(fPos - spotLightPosition) - shadowClipNearFarSpotLight.x)
		/
		(shadowClipNearFarSpotLight.y - shadowClipNearFarSpotLight.x);

	float shadowMapValue = textureCube(lightShadowMap, -toLightNormal).r;
	float shadowMapValueSpotLight = textureCube(spotLightShadowMap, -toSpotLightNormal).r;

	float pointLightInt = 0.0;
	if ((shadowMapValue + bias) >= fromLightToFrag) {
		pointLightInt += 0.6 * max(dot(fNorm, toLightNormal), 0.0);
	}

	float spotLightInt = 0.0;
	if ((shadowMapValueSpotLight + biasSpotLight) >= fromSpotLightToFrag) {
		spotLightInt += 0.8 * max(dot(fNorm, toSpotLightNormal), 0.0);
	}

	float dirLightInt = 1.0 * max(dot(fNorm, directionalLight), 0.0);

	vec3 pointLightColor = vec3(1.0, 1.0, 1.0) * pointLightInt;
	vec3 spotLightColor = vec3(0.5, 0.5, 0.5) * spotLightInt;
	vec3 dirLightColor = vec3(1.0, 1.0, 0.5) * dirLightInt;

	vec3 finalLightColor = pointLightColor + dirLightColor + spotLightColor;

	vec3 finalColor = vec3(
		meshColor.r * finalLightColor.r,
		meshColor.g * finalLightColor.g,
		meshColor.b * finalLightColor.b
	);

	gl_FragColor = vec4(finalColor, meshColor.a);
}