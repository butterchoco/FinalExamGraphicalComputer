precision mediump float;

uniform vec3 pointLightPosition;
uniform vec3 spotLightPosition;
uniform vec3 dirLightDirection;

uniform vec3 pointLightColor;
uniform vec3 spotLightColor;
uniform vec3 dirLightColor;
uniform vec4 meshColor;

uniform float pointLightBase;
uniform float spotLightBase;
uniform float dirLightBase;

uniform samplerCube lightShadowMap;
uniform sampler2D dirLightShadowMap;
uniform samplerCube spotLightShadowMap;

uniform vec2 shadowClipNearFar;
uniform vec2 shadowClipNearFarSL;

uniform vec4 dirShadowMapView;

uniform float bias;

varying vec3 fPos;
varying vec3 fNorm;

varying vec2 v_texcoord;
uniform sampler2D u_texture;


void main()
{
	vec3 toLightNormal = normalize(pointLightPosition - fPos);
	vec3 toSpotLightNormal = normalize(spotLightPosition - fPos);

	float fromLightToFrag =
		(length(fPos - pointLightPosition) - shadowClipNearFar.x)
		/
		(shadowClipNearFar.y - shadowClipNearFar.x);

	float fromSpotLightToFrag =
		(length(fPos - spotLightPosition) - shadowClipNearFarSL.x)
		/
		(shadowClipNearFarSL.y - shadowClipNearFarSL.x);

	float shadowMapValue = textureCube(lightShadowMap, -toLightNormal).r;
	float shadowMapValueSL = textureCube(spotLightShadowMap, -toSpotLightNormal).r;

	float pointLightInt = 0.0;
	float dirLightInt = 0.0;
	float spotLightInt = 0.0;

	if ((shadowMapValue + bias) >= fromLightToFrag) {
		pointLightInt = pointLightBase * max(dot(fNorm, toLightNormal), 0.0);
	}

	if ((shadowMapValueSL + bias) >= fromSpotLightToFrag) {
		spotLightInt = spotLightBase * max(dot(fNorm, toSpotLightNormal), 0.0);
	}

	// 2D shadow map calculation
	vec3 texCoord = dirShadowMapView.xyz;
	bool inRange =
		texCoord.x >= 0.0 &&
		texCoord.x <= 1.0 &&
		texCoord.y >= 0.0 &&
		texCoord.y <= 1.0;

	//float dirShadowMapValue = texture2D(dirLightShadowMap, texCoord.xy).r;
	float dirShadowMapValue = 0.0;
	float dirShadowDepth = texCoord.z + bias;

	if (inRange && dirShadowDepth >= dirShadowMapValue) {
		dirLightInt = dirLightBase * max(dot(fNorm, dirLightDirection), 0.0);
	}

	vec3 finalLightColor = pointLightColor * pointLightInt + dirLightColor * dirLightInt + spotLightColor * spotLightInt;

	vec3 finalColor = vec3(
		meshColor.r * finalLightColor.r,
		meshColor.g * finalLightColor.g,
		meshColor.b * finalLightColor.b
	);

	// gl_FragColor = vec4(finalColor, meshColor.a);


	gl_FragColor = texture2D(u_texture, v_texcoord) * vec4(finalColor, meshColor.a);
}

//float calculateDistance()