// Normal Mapping Vertex Shader (WebGL 1 / GLSL ES 1.0)
// Envia posição, normal e UV para o fragment shader

precision highp float;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;

void main() {
  // Posição no espaço de vista (eye space)
  vec4 viewPos = uModelViewMatrix * vec4(aPosition, 1.0);
  vPosition = viewPos.xyz;

  // Normal transformada para eye space
  vNormal = normalize(uNormalMatrix * aNormal);

  // Coordenadas de textura
  vTexCoord = aTexCoord;

  gl_Position = uProjectionMatrix * viewPos;
}
