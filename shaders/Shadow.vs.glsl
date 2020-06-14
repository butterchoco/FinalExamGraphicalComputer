precision mediump float;

uniform mat4 mProj;
uniform mat4 mView;
uniform mat4 mWorld;

attribute vec3 vPos;
attribute vec3 vNorm;

varying vec3 fPos;
varying vec3 fNorm;


attribute vec2 a_texcoord;
varying vec2 v_texcoord;

void main()
{
	fPos = (mWorld * vec4(vPos, 1.0)).xyz;
	fNorm = (mWorld * vec4(vNorm, 0.0)).xyz;

	gl_Position = mProj * mView * vec4(fPos, 1.0);

	v_texcoord = a_texcoord;
}