// Normal Mapping Fragment Shader (WebGL 1 / GLSL ES 1.0)
// Constrói a matriz TBN usando derivadas e perturba as normais com um normal map
// para criar relevo visual sem alterar a geometria.

#extension GL_OES_standard_derivatives : enable
precision highp float;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;

uniform sampler2D uNormalMap;
uniform sampler2D uColorMap;  // Textura de cor (albedo) do material
uniform vec3 uLightPos;       // Posição da luz em view space
uniform vec3 uLightColor;     // Cor da luz
uniform vec3 uAmbientColor;   // Cor ambiente
uniform float uBumpStrength;  // Intensidade do bump (0.0 - 2.0)
uniform float uShininess;     // Expoente especular de Phong
uniform float uSpecStrength;  // Intensidade do especular (tijolo é fosco)
uniform bool uUseBump;        // Toggle: normal map ativo?

// Constrói a matriz TBN usando derivadas parciais da posição e UV
// Técnica que não requer atributos de tangente pré-calculados
mat3 computeTBN() {
  vec3 dp1 = dFdx(vPosition);
  vec3 dp2 = dFdy(vPosition);
  vec2 duv1 = dFdx(vTexCoord);
  vec2 duv2 = dFdy(vTexCoord);

  vec3 N = normalize(vNormal);

  // Resolver o sistema linear para T e B
  float det = duv1.x * duv2.y - duv1.y * duv2.x;
  // Evitar divisão por zero
  float invDet = abs(det) > 0.0001 ? 1.0 / det : 0.0;

  vec3 T = normalize((dp1 * duv2.y - dp2 * duv1.y) * invDet);
  vec3 B = normalize((dp2 * duv1.x - dp1 * duv2.x) * invDet);

  // Re-ortogonalizar com Gram-Schmidt
  T = normalize(T - dot(T, N) * N);
  B = cross(N, T);

  return mat3(T, B, N);
}

void main() {
  vec3 N = normalize(vNormal);

  if (uUseBump) {
    // Amostrar o normal map: valores em [0,1] → converter para [-1,1]
    vec3 normalMapSample = texture2D(uNormalMap, vTexCoord).rgb;
    vec3 tangentNormal = normalMapSample * 2.0 - 1.0;

    // Aplicar intensidade do bump
    tangentNormal.xy *= uBumpStrength;
    tangentNormal = normalize(tangentNormal);

    // Transformar do espaço tangente para view space
    mat3 TBN = computeTBN();
    N = normalize(TBN * tangentNormal);
  }

  // === Iluminação Phong ===
  vec3 L = normalize(uLightPos - vPosition);
  vec3 V = normalize(-vPosition); // Em view space, câmera está na origem
  vec3 R = reflect(-L, N);

  // Componente ambiente
  vec3 ambient = uAmbientColor * 0.15;

  // Componente difusa (Lambert)
  float diff = max(dot(N, L), 0.0);
  vec3 diffuse = uLightColor * diff * 0.7;

  // Componente especular (Phong)
  float spec = pow(max(dot(R, V), 0.0), uShininess);
  vec3 specular = uLightColor * spec * uSpecStrength;

  // Cor base do material: amostrada da textura de cor (albedo)
  vec3 baseColor = texture2D(uColorMap, vTexCoord).rgb;

  vec3 finalColor = (ambient + diffuse) * baseColor + specular;

  gl_FragColor = vec4(finalColor, 1.0);
}
