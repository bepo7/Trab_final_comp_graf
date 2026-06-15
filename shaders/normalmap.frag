// Normal Mapping Fragment Shader (WebGL 1 / GLSL ES 1.0)
// Constrói a matriz TBN ANALITICAMENTE a partir da normal matrix —
// sem depender de dFdx/dFdy (GL_OES_standard_derivatives), que não
// está disponível em todos os contextos WebGL.
//
// Funciona perfeitamente para superfícies planas (plane()), que é o
// caso da parede de tijolos. Para meshes curvos precisaríamos de
// tangentes por vértice ou da extensão de derivadas.

precision highp float;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;

uniform sampler2D uNormalMap;
uniform sampler2D uColorMap;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform float uBumpStrength;
uniform float uShininess;
uniform float uSpecStrength;
uniform float uUseBump;       // 1.0 = ativo, 0.0 = desligado

// A normal matrix transforma vetores do object space para o view space.
// Para um plane() do p5.js, o objeto está no plano XY com UV mapeado
// ao longo de X (tangente) e Y (bitangente). Então:
//   T_view = normalize(uNormalMatrix * vec3(1,0,0))
//   B_view = normalize(uNormalMatrix * vec3(0,1,0))
//   N_view = normalize(vNormal)
uniform mat3 uNormalMatrix;

void main() {
  vec3 N = normalize(vNormal);

  if (uUseBump > 0.5) {
    // Tangente e bitangente analíticas (colunas da normal matrix)
    vec3 T = normalize(uNormalMatrix * vec3(1.0, 0.0, 0.0));
    vec3 B = normalize(uNormalMatrix * vec3(0.0, 1.0, 0.0));

    // Garantir ortonormalidade: re-ortogonalizar B em relação a N e T
    // (Gram-Schmidt) — robusto caso a matrix tenha escala não-uniforme
    T = normalize(T - dot(T, N) * N);
    B = cross(N, T);

    mat3 TBN = mat3(T, B, N);

    // Amostrar o normal map: valores em [0,1] → converter para [-1,1]
    vec3 normalMapSample = texture2D(uNormalMap, vTexCoord).rgb;
    vec3 tangentNormal = normalMapSample * 2.0 - 1.0;

    // Aplicar intensidade do bump
    tangentNormal.xy *= uBumpStrength;
    tangentNormal = normalize(tangentNormal);

    // Transformar do espaço tangente para view space
    N = normalize(TBN * tangentNormal);
  }

  // === Iluminação Blinn-Phong ===
  vec3 L = normalize(uLightPos - vPosition);
  vec3 V = normalize(-vPosition); // Em view space, câmera está na origem
  vec3 H = normalize(L + V);      // Half-vector (Blinn)

  // Componente ambiente
  vec3 ambient = uAmbientColor * 0.15;

  // Componente difusa (Lambert)
  float diff = max(dot(N, L), 0.0);
  vec3 diffuse = uLightColor * diff * 0.7;

  // Componente especular (Blinn-Phong)
  float spec = pow(max(dot(N, H), 0.0), uShininess);
  vec3 specular = uLightColor * spec * uSpecStrength;

  // Cor base do material: amostrada da textura de cor (albedo)
  vec3 baseColor = texture2D(uColorMap, vTexCoord).rgb;

  vec3 finalColor = (ambient + diffuse) * baseColor + specular;

  gl_FragColor = vec4(finalColor, 1.0);
}
