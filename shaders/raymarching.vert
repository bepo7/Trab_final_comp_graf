// Ray Marching Vertex Shader (WebGL 1 / GLSL ES 1.0)
// Shader passthrough: posiciona um quad fullscreen e passa UV

precision highp float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  // Mapear de [0,1] para [-1,1] (fullscreen quad)
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
