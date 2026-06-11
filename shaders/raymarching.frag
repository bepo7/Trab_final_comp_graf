// Ray Marching Fragment Shader (WebGL 1 / GLSL ES 1.0)
// Renderiza um cenário 3D completo usando SDFs e Sphere Tracing.
// Inclui: primitivas SDF, operações booleanas, smooth min,
// repetição periódica, simetria, reflexões e environment procedural.

precision highp float;

varying vec2 vTexCoord;

uniform vec2 uResolution;
uniform float uTime;
uniform float uSmoothK;   // Constante para smooth minimum (0.0 = sharp)
uniform int uReflect;      // 0 = sem reflexão, 1 = com reflexão
uniform int uShadows;      // 0 = sem sombras, 1 = sombras suaves
uniform vec2 uMouse;       // Posição normalizada do mouse

// ============================================================
// CONSTANTES
// ============================================================
#define MAX_STEPS 100
#define MAX_DIST 50.0
#define EPSILON 0.001
#define PI 3.14159265359

// ============================================================
// FUNÇÕES SDF PRIMITIVAS
// ============================================================

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdPlane(vec3 p, float h) {
  return p.y - h;
}

// ============================================================
// OPERAÇÕES DE COMBINAÇÃO
// ============================================================

// Smooth minimum — polynomial (Inigo Quilez)
float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k * (1.0 / 6.0);
}

// Repetição periódica
vec3 opRepeat(vec3 p, vec3 c) {
  return mod(p + 0.5 * c, c) - 0.5 * c;
}

// Simetria no eixo X
vec3 opSymX(vec3 p) {
  p.x = abs(p.x);
  return p;
}

// Simetria nos eixos X e Z
vec3 opSymXZ(vec3 p) {
  p.x = abs(p.x);
  p.z = abs(p.z);
  return p;
}

// ============================================================
// ROTAÇÕES
// ============================================================

mat2 rot2D(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

// ============================================================
// CENA: Função de distância da cena completa
// ============================================================

// Retorna vec2(distância, materialID)
vec2 map(vec3 p) {
  // Chão
  float floor = sdPlane(p, -1.5);

  // Esferas repetidas (grid infinito)
  vec3 repP = opRepeat(p - vec3(0.0, 0.0, 0.0), vec3(4.0, 0.0, 4.0));
  float spheres = sdSphere(repP - vec3(0.0, -0.3, 0.0), 0.5);

  // Torus central girando
  vec3 torusP = p;
  torusP.xz *= rot2D(uTime * 0.5);
  torusP.xy *= rot2D(uTime * 0.3);
  float torus = sdTorus(torusP, vec2(1.2, 0.35));

  // Caixas com simetria
  vec3 symP = opSymXZ(p);
  float boxes = sdBox(symP - vec3(2.5, -0.5, 2.5), vec3(0.6, 1.0, 0.6));

  // Esfera central flutuante
  vec3 sphereP = p - vec3(0.0, sin(uTime * 0.8) * 0.5 + 0.5, 0.0);
  float centralSphere = sdSphere(sphereP, 0.8);

  // Combinar torus e esfera central com smooth min
  float merged = smin(torus, centralSphere, uSmoothK);

  // Cilindros decorativos com simetria
  vec3 cylP = opSymXZ(p);
  cylP -= vec3(5.0, -1.5, 0.0);
  float cyl = sdCylinder(cylP, 1.5, 0.2);

  // Combinar tudo
  vec2 result = vec2(floor, 1.0); // mat 1 = chão
  if (merged < result.x) result = vec2(merged, 2.0); // mat 2 = objetos centrais
  if (boxes < result.x) result = vec2(boxes, 3.0); // mat 3 = caixas
  if (spheres < result.x) result = vec2(spheres, 4.0); // mat 4 = esferas repetidas
  if (cyl < result.x) result = vec2(cyl, 5.0); // mat 5 = cilindros

  return result;
}

// ============================================================
// NORMAL: gradiente numérico da SDF
// ============================================================

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(EPSILON, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x
  ));
}

// ============================================================
// SOFT SHADOW (opcional, melhora visual)
// ============================================================

float softShadow(vec3 ro, vec3 rd, float tmin, float tmax, float k) {
  float res = 1.0;
  float t = tmin;
  for (int i = 0; i < 32; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.5);
    if (res < 0.001 || t > tmax) break;
  }
  return clamp(res, 0.0, 1.0);
}

// ============================================================
// ENVIRONMENT MAP PROCEDURAL (substitui CubeMap)
// ============================================================

vec3 envColor(vec3 rd) {
  // Gradiente do céu
  float t = 0.5 + 0.5 * rd.y;
  vec3 sky = mix(vec3(0.6, 0.35, 0.2), vec3(0.05, 0.05, 0.2), t);

  // Sol
  vec3 sunDir = normalize(vec3(0.8, 0.4, -0.6));
  float sun = pow(max(dot(rd, sunDir), 0.0), 128.0);
  sky += vec3(1.0, 0.9, 0.7) * sun * 2.0;

  // Brilho ao redor do sol
  float halo = pow(max(dot(rd, sunDir), 0.0), 8.0);
  sky += vec3(1.0, 0.6, 0.3) * halo * 0.3;

  // Chão (checkerboard refletido)
  if (rd.y < -0.01) {
    vec3 floorP = vec3(0.0, -1.5, 0.0) - rd * (1.5 + 0.0) / rd.y;
    float check = mod(floor(floorP.x) + floor(floorP.z), 2.0);
    sky = mix(vec3(0.15), vec3(0.35), check) * 0.5;
  }

  return sky;
}

// ============================================================
// MATERIAL: cor baseada no ID do material
// ============================================================

vec3 getMaterialColor(float matID, vec3 p) {
  if (matID < 1.5) {
    // Chão — checkerboard
    float check = mod(floor(p.x) + floor(p.z), 2.0);
    return mix(vec3(0.15, 0.15, 0.18), vec3(0.35, 0.35, 0.4), check);
  } else if (matID < 2.5) {
    // Objetos centrais — azul metálico
    return vec3(0.2, 0.4, 0.8);
  } else if (matID < 3.5) {
    // Caixas — dourado
    return vec3(0.85, 0.65, 0.2);
  } else if (matID < 4.5) {
    // Esferas repetidas — verde escuro
    return vec3(0.15, 0.6, 0.3);
  } else {
    // Cilindros — vermelho
    return vec3(0.8, 0.2, 0.15);
  }
}

// ============================================================
// RAY MARCH (Sphere Tracing)
// ============================================================

vec2 rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  float matID = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    vec2 d = map(p);
    if (d.x < EPSILON) {
      matID = d.y;
      break;
    }
    t += d.x;
    if (t > MAX_DIST) break;
  }
  return vec2(t, matID);
}

// ============================================================
// SHADING
// ============================================================

vec3 shade(vec3 ro, vec3 rd) {
  vec2 hit = rayMarch(ro, rd);
  float t = hit.x;
  float matID = hit.y;

  if (t >= MAX_DIST) {
    return envColor(rd);
  }

  vec3 p = ro + rd * t;
  vec3 N = calcNormal(p);
  vec3 V = -rd;

  // Luz direcional (sol)
  vec3 lightDir = normalize(vec3(0.8, 0.4, -0.6));
  vec3 lightColor = vec3(1.0, 0.95, 0.85);

  // Cor do material
  vec3 matColor = getMaterialColor(matID, p);

  // Ambient
  float ao = 0.5 + 0.5 * N.y; // Ambient occlusion simples
  vec3 ambient = vec3(0.08, 0.08, 0.12) * ao;

  // Diffuse (Lambert)
  float diff = max(dot(N, lightDir), 0.0);

  // Shadow (suave) — pode ser desligada com a tecla S
  float shadow = (uShadows == 1) ? softShadow(p + N * 0.01, lightDir, 0.02, 10.0, 16.0) : 1.0;
  diff *= shadow;

  vec3 diffuse = lightColor * diff;

  // Specular (Blinn-Phong)
  vec3 H = normalize(lightDir + V);
  float spec = pow(max(dot(N, H), 0.0), 64.0);
  vec3 specular = lightColor * spec * shadow * 0.5;

  // Fresnel simples
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 fresnelColor = vec3(0.1, 0.15, 0.3) * fresnel;

  vec3 color = ambient + (diffuse * matColor) + specular + fresnelColor;

  // Reflexão (se ativa)
  if (uReflect == 1) {
    vec3 refDir = reflect(rd, N);
    // Primeiro bounce
    vec2 refHit = rayMarch(p + N * 0.02, refDir);
    vec3 refColor;
    if (refHit.x < MAX_DIST) {
      vec3 refP = p + N * 0.02 + refDir * refHit.x;
      vec3 refN = calcNormal(refP);
      vec3 refMat = getMaterialColor(refHit.y, refP);
      float refDiff = max(dot(refN, lightDir), 0.0);
      refColor = refMat * (vec3(0.1) + lightColor * refDiff * 0.6);

      // Segundo bounce (amostra o ambiente)
      vec3 refDir2 = reflect(refDir, refN);
      refColor += envColor(refDir2) * 0.15;
    } else {
      refColor = envColor(refDir);
    }

    // Mix baseado no Fresnel
    float reflAmount = 0.15 + 0.5 * fresnel;
    // Objetos centrais são mais refletivos
    if (matID > 1.5 && matID < 2.5) reflAmount += 0.25;
    color = mix(color, refColor, reflAmount);
  }

  // Fog exponencial
  float fog = exp(-t * 0.04);
  color = mix(vec3(0.05, 0.05, 0.1), color, fog);

  return color;
}

// ============================================================
// MAIN
// ============================================================

void main() {
  // Coordenadas UV normalizadas, aspect ratio corrigido
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  // Câmera orbital
  float camAngle = uTime * 0.15;
  float camDist = 8.0;
  float camHeight = 3.0;

  vec3 ro = vec3(
    sin(camAngle) * camDist,
    camHeight,
    cos(camAngle) * camDist
  );

  // Look-at
  vec3 target = vec3(0.0, 0.0, 0.0);
  vec3 forward = normalize(target - ro);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);

  // Direção do raio (FOV ~60°)
  vec3 rd = normalize(forward * 1.5 + right * uv.x + up * uv.y);

  // Shade
  vec3 color = shade(ro, rd);

  // Tone mapping (ACES approximation)
  color = color / (color + vec3(1.0));

  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));

  // Vignette
  vec2 vUV = vTexCoord;
  float vig = 1.0 - 0.3 * length(vUV - 0.5);
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
