// ============================================================
// CENA 4: Geometria Sólida Construtiva (CSG) e Ray Casting
// ------------------------------------------------------------
// MUDANÇA DE PARADIGMA: aqui o p5.js NÃO envia triângulos prontos
// para a GPU. Em vez disso, escrevemos um RAY CASTER de CPU em
// JavaScript que, para cada pixel de um buffer, lança um raio
// matemático e calcula a interseção com os sólidos.
//
// As operações booleanas (União, Interseção, Diferença) são
// CSG DE VERDADE: trabalhamos com os INTERVALOS [t_enter, t_exit]
// em que cada raio fica dentro de cada primitiva e combinamos
// esses intervalos. Nada de truques de blend/erase.
//
// Conceitos demonstrados:
//   • Bounding Volumes (AABB) como aceleradores do ray casting
//   • Interseção raio-esfera via raízes da equação quadrática
//   • Interseção raio-caixa via Slab Method
//   • CSG por operações em intervalos de raio
//   • Interseção raio-plano (chão) + SOMBRAS via shadow ray
//   • Reflexo de 1 salto no chão e céu em gradiente
//   • Diagrama esquemático (vista de cima) do raio lançado
// ============================================================

let cena4 = {
  // --- Câmera matemática FIXA (a câmera não se move, por design) ---
  cam: null,        // { ox,oy,oz (olho), fx..,rx..,ux.. (base), tan }

  // --- Primitivas (operandos do CSG) ---
  primA: null,      // esfera A
  primB: null,      // esfera OU caixa B (alternável)

  // --- Operação CSG ---
  csgMode: 1,       // 0=Nenhuma, 1=União, 2=Interseção, 3=Diferença
  csgModes: ['Nenhuma (operandos)', 'União (A ∪ B)', 'Interseção (A ∩ B)', 'Diferença (A − B)'],

  // --- Buffer do ray caster (baixa resolução, esticado para a tela) ---
  rcBuffer: null,
  rcW: 0, rcH: 0,
  cacheValido: false,
  scanY: 0,         // linha atual da varredura progressiva

  // --- Iluminação do ray caster ---
  light: null,

  // --- Chão (plano y = chao.y) e efeitos de realismo ---
  chao: { y: -78, tam: 56, corA: [56, 60, 72], corB: [70, 75, 89] },
  sombrasAtivas: true,    // sombras via shadow ray (tecla S)
  reflexoAtivo: true,     // reflexo de 1 salto no chão (tecla R)
  overlaysVisiveis: true, // diagrama/marcadores didáticos (tecla V)

  // --- Histórico de raios lançados pelo usuário ---
  rays: [],
  maxRays: 5,

  // --- UI (retângulos em coordenadas de TELA: 0..width, 0..height) ---
  ui: { csgBtns: [], btnB: null, portal: null, inset: null },
  _lastW: 0, _lastH: 0,

  // --- Scratch reutilizável (evita alocação no caminho quente) ---
  _spanA: { valid: false }, _spanB: { valid: false },
  // Scratch SECUNDÁRIO para raios de sombra/reflexo — nunca misturar
  // com _spanA/_spanB, que precisam sobreviver ao raio primário.
  _spanSA: { valid: false }, _spanSB: { valid: false },
  _hit: { t: 0, kind: 0, prim: null, ax: 0, s: 1 },
  _rgb: [0, 0, 0], _bg: [0, 0, 0], _tmp: [0, 0, 0], _scol: [0, 0, 0],
  _rcol: [0, 0, 0],
  portalPulse: 0,
};

// ============================================================
// SETUP
// ============================================================
function setupCena4() {
  // Câmera fixa olhando para a origem, ligeiramente de cima.
  let eye = createVector(0, -45, 330);
  let target = createVector(0, 0, 0);
  let worldUp = createVector(0, 1, 0);

  let forward = p5.Vector.sub(target, eye).normalize();
  let right = p5.Vector.cross(forward, worldUp).normalize();
  let up = p5.Vector.cross(right, forward); // base ortonormal

  cena4.cam = {
    ox: eye.x, oy: eye.y, oz: eye.z,
    fx: forward.x, fy: forward.y, fz: forward.z,
    rx: right.x, ry: right.y, rz: right.z,
    ux: up.x, uy: up.y, uz: up.z,
    tan: Math.tan((PI / 3) / 2), // FOV vertical de 60°
  };

  // Operandos: duas esferas sobrepostas (A azul, B laranja).
  // B guarda também 'half' para quando virar caixa (slab method).
  cena4.primA = {
    kind: 'sphere',
    center: createVector(-48, 0, 0), radius: 72,
    half: { x: 62, y: 62, z: 62 },
    color: [88, 156, 240], aabb: { min: {}, max: {} },
  };
  cena4.primB = {
    kind: 'sphere',
    center: createVector(48, 0, 0), radius: 72,
    half: { x: 62, y: 62, z: 62 },
    color: [240, 142, 78], aabb: { min: {}, max: {} },
  };
  c4_updateAABB(cena4.primA);
  c4_updateAABB(cena4.primB);

  // Luz: vinda de cima-esquerda-frente. L = direção PARA a luz.
  // (No referencial deste ray caster, +Y do mundo aparece no TOPO da
  // tela — a geração do raio nega o ndcY — então "de cima" é Ly > 0.)
  let L = createVector(-0.4, 0.62, 0.55).normalize();
  cena4.light = {
    Lx: L.x, Ly: L.y, Lz: L.z,
    color: [1.0, 0.97, 0.9],
    ambient: 0.30, specPow: 42, specStrength: 0.55,
    // Luz de preenchimento fria (direita/cima/fundo) — só difusa, sem
    // sombra nem especular: mantém legível o lado oposto à luz principal.
    fill: { dirx: 0.701, diry: 0.319, dirz: -0.638, int: 0.18, color: [0.78, 0.86, 1.0] },
  };

  c4_layoutUI();
}

// Recalcula o AABB (Bounding Volume) da primitiva a partir do tipo.
function c4_updateAABB(prim) {
  let c = prim.center;
  if (prim.kind === 'sphere') {
    let r = prim.radius;
    prim.aabb.min = { x: c.x - r, y: c.y - r, z: c.z - r };
    prim.aabb.max = { x: c.x + r, y: c.y + r, z: c.z + r };
  } else {
    let h = prim.half;
    prim.aabb.min = { x: c.x - h.x, y: c.y - h.y, z: c.z - h.z };
    prim.aabb.max = { x: c.x + h.x, y: c.y + h.y, z: c.z + h.z };
  }
}

// Cria o buffer de ray casting e posiciona a UI (em coords de tela).
function c4_layoutUI() {
  // Buffer limitado a ~700px de largura → performance estável em qualquer tela.
  cena4.rcW = Math.round(constrain(Math.floor(width / 2), 200, 700));
  cena4.rcH = Math.max(2, Math.round(cena4.rcW * height / width));
  if (cena4.rcBuffer) cena4.rcBuffer.remove();
  cena4.rcBuffer = createGraphics(cena4.rcW, cena4.rcH);
  cena4.rcBuffer.pixelDensity(1);
  cena4.cacheValido = false;
  cena4.scanY = 0;

  // Barra de botões CSG (centralizada, parte inferior).
  let bw = 132, bh = 42, gap = 10;
  let total = 4 * bw + 3 * gap;
  let x0 = width / 2 - total / 2;
  let y0 = height - bh - 24;
  cena4.ui.csgBtns = [];
  for (let i = 0; i < 4; i++) {
    cena4.ui.csgBtns.push({ x: x0 + i * (bw + gap), y: y0, w: bw, h: bh, mode: i });
  }
  // Botão [B]: alterna esfera/caixa (acima da barra, à direita).
  cena4.ui.btnB = { x: x0 + total - 150, y: y0 - bh - 12, w: 150, h: bh };

  // Portal (lado direito, meia altura).
  cena4.ui.portal = { x: width - 116, y: height / 2 - 48, w: 96, h: 96 };

  // Inset (diagrama de cima) no canto inferior esquerdo.
  let iw = Math.min(300, width * 0.26), ih = Math.min(210, height * 0.32);
  cena4.ui.inset = { x: 22, y: height - ih - 22, w: iw, h: ih };

  cena4._lastW = width; cena4._lastH = height;
}

function c4_ensureLayout() {
  if (width !== cena4._lastW || height !== cena4._lastH) c4_layoutUI();
}

// Invalida o buffer E reinicia a varredura do topo. (Sem o reset de
// scanY, invalidar no MEIO de um sweep deixava metade do buffer com a
// imagem antiga — e o buffer era marcado válido ao final.)
function c4_invalidar() {
  cena4.cacheValido = false;
  cena4.scanY = 0;
}

// ============================================================
// MATEMÁTICA DO RAY CASTING
// ============================================================

// Interseção raio-AABB (Slab Method) — usado como ACELERADOR.
// Retorna true se o raio cruza o bounding volume.
function c4_aabbHit(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity, inv, t1, t2, s;
  if (Math.abs(dx) > 1e-9) {
    inv = 1 / dx; t1 = (b.min.x - ox) * inv; t2 = (b.max.x - ox) * inv;
    if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
  } else if (ox < b.min.x || ox > b.max.x) return false;
  if (Math.abs(dy) > 1e-9) {
    inv = 1 / dy; t1 = (b.min.y - oy) * inv; t2 = (b.max.y - oy) * inv;
    if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
  } else if (oy < b.min.y || oy > b.max.y) return false;
  if (Math.abs(dz) > 1e-9) {
    inv = 1 / dz; t1 = (b.min.z - oz) * inv; t2 = (b.max.z - oz) * inv;
    if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
  } else if (oz < b.min.z || oz > b.max.z) return false;
  return tmax >= Math.max(tmin, 0);
}

// Interseção raio-esfera: resolve a (a t² + b t + c = 0), com a=1
// pois a direção do raio é normalizada. Guarda as DUAS raízes.
function c4_sphereSpanInto(ox, oy, oz, dx, dy, dz, prim, out) {
  let cx = prim.center.x, cy = prim.center.y, cz = prim.center.z, r = prim.radius;
  let ocx = ox - cx, ocy = oy - cy, ocz = oz - cz;
  let b = 2 * (ocx * dx + ocy * dy + ocz * dz);
  let c = ocx * ocx + ocy * ocy + ocz * ocz - r * r;
  let disc = b * b - 4 * c;
  if (disc < 0) { out.valid = false; return false; }
  let sq = Math.sqrt(disc);
  out.t0 = (-b - sq) * 0.5;
  out.t1 = (-b + sq) * 0.5;
  out.kind = 0; out.valid = true;
  return true;
}

// Interseção raio-caixa (Slab Method) guardando o eixo de cada face,
// para reconstruir a normal corretamente.
function c4_boxSpanInto(ox, oy, oz, dx, dy, dz, prim, out) {
  let b = prim.aabb;
  let tmin = -Infinity, tmax = Infinity;
  let axEnter = 0, sEnter = -1, axExit = 0, sExit = 1;
  // eixo X
  if (Math.abs(dx) > 1e-9) {
    let inv = 1 / dx, t1 = (b.min.x - ox) * inv, t2 = (b.max.x - ox) * inv, se = -1, sx = 1;
    if (t1 > t2) { let s = t1; t1 = t2; t2 = s; se = 1; sx = -1; }
    if (t1 > tmin) { tmin = t1; axEnter = 0; sEnter = se; }
    if (t2 < tmax) { tmax = t2; axExit = 0; sExit = sx; }
  } else if (ox < b.min.x || ox > b.max.x) { out.valid = false; return false; }
  // eixo Y
  if (Math.abs(dy) > 1e-9) {
    let inv = 1 / dy, t1 = (b.min.y - oy) * inv, t2 = (b.max.y - oy) * inv, se = -1, sx = 1;
    if (t1 > t2) { let s = t1; t1 = t2; t2 = s; se = 1; sx = -1; }
    if (t1 > tmin) { tmin = t1; axEnter = 1; sEnter = se; }
    if (t2 < tmax) { tmax = t2; axExit = 1; sExit = sx; }
  } else if (oy < b.min.y || oy > b.max.y) { out.valid = false; return false; }
  // eixo Z
  if (Math.abs(dz) > 1e-9) {
    let inv = 1 / dz, t1 = (b.min.z - oz) * inv, t2 = (b.max.z - oz) * inv, se = -1, sx = 1;
    if (t1 > t2) { let s = t1; t1 = t2; t2 = s; se = 1; sx = -1; }
    if (t1 > tmin) { tmin = t1; axEnter = 2; sEnter = se; }
    if (t2 < tmax) { tmax = t2; axExit = 2; sExit = sx; }
  } else if (oz < b.min.z || oz > b.max.z) { out.valid = false; return false; }

  if (tmax < tmin || tmax < 0) { out.valid = false; return false; }
  out.t0 = tmin; out.t1 = tmax; out.kind = 1;
  out.ax0 = axEnter; out.s0 = sEnter; out.ax1 = axExit; out.s1 = sExit;
  out.valid = true;
  return true;
}

// Calcula o intervalo da primitiva, usando o AABB como acelerador:
// só resolve a equação implícita se o raio cruzar o bounding volume.
function c4_primSpanInto(ox, oy, oz, dx, dy, dz, prim, out) {
  if (!c4_aabbHit(ox, oy, oz, dx, dy, dz, prim.aabb)) { out.valid = false; return false; }
  if (prim.kind === 'sphere') return c4_sphereSpanInto(ox, oy, oz, dx, dy, dz, prim, out);
  return c4_boxSpanInto(ox, oy, oz, dx, dy, dz, prim, out);
}

// O ponto à distância t está DENTRO do sólido CSG resultante?
function c4_insideOf(t, A, B, mode) {
  let inA = A && A.valid && t >= A.t0 && t <= A.t1;
  let inB = B && B.valid && t >= B.t0 && t <= B.t1;
  if (mode === 2) return inA && inB;       // interseção
  if (mode === 3) return inA && !inB;      // diferença A − B
  return inA || inB;                       // união (e fallback)
}

// Primeira superfície visível do sólido CSG ao longo do raio.
// Varre as fronteiras (t0/t1 de A e B) e escolhe o menor t onde o
// raio TRANSITA de fora para dentro do sólido. Escreve em cena4._hit.
// (sem closures — esta função roda uma vez por pixel no caminho quente)
function c4_firstHit(A, B, mode) {
  const EPS = 0.04;
  let bestT = Infinity, bestWhich = -1, bestSpan = null, bestPrim = null;
  let t;
  if (A && A.valid) {
    t = A.t0;
    if (t > EPS && t < bestT && !c4_insideOf(t - EPS, A, B, mode) && c4_insideOf(t + EPS, A, B, mode)) { bestT = t; bestWhich = 0; bestSpan = A; bestPrim = cena4.primA; }
    t = A.t1;
    if (t > EPS && t < bestT && !c4_insideOf(t - EPS, A, B, mode) && c4_insideOf(t + EPS, A, B, mode)) { bestT = t; bestWhich = 1; bestSpan = A; bestPrim = cena4.primA; }
  }
  if (B && B.valid) {
    t = B.t0;
    if (t > EPS && t < bestT && !c4_insideOf(t - EPS, A, B, mode) && c4_insideOf(t + EPS, A, B, mode)) { bestT = t; bestWhich = 0; bestSpan = B; bestPrim = cena4.primB; }
    t = B.t1;
    if (t > EPS && t < bestT && !c4_insideOf(t - EPS, A, B, mode) && c4_insideOf(t + EPS, A, B, mode)) { bestT = t; bestWhich = 1; bestSpan = B; bestPrim = cena4.primB; }
  }
  if (bestWhich < 0) return null;
  let h = cena4._hit;
  h.t = bestT; h.prim = bestPrim; h.kind = bestSpan.kind;
  if (bestSpan.kind === 1) {
    h.ax = bestWhich === 0 ? bestSpan.ax0 : bestSpan.ax1;
    h.s = bestWhich === 0 ? bestSpan.s0 : bestSpan.s1;
  }
  return h;
}

// Sombreamento Blinn-Phong (Lambert + ambiente + especular + leve rim
// + luz de preenchimento). shadowK atenua difusa+especular quando o
// ponto está na sombra (a ambiente fica intacta). Escreve [0..255] em out.
function c4_shadeInto(Px, Py, Pz, nx, ny, nz, baseColor, dx, dy, dz, shadowK, out) {
  let lt = cena4.light;
  let diff = Math.max(nx * lt.Lx + ny * lt.Ly + nz * lt.Lz, 0) * shadowK;
  // V = -rd ; H = normalize(L + V)
  let vx = -dx, vy = -dy, vz = -dz;
  let hx = lt.Lx + vx, hy = lt.Ly + vy, hz = lt.Lz + vz;
  let hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
  hx /= hl; hy /= hl; hz /= hl;
  let spec = Math.pow(Math.max(nx * hx + ny * hy + nz * hz, 0), lt.specPow) * lt.specStrength * shadowK;
  // Rim light (Fresnel) para destacar a silhueta — "melhor de ver".
  let ndv = Math.max(nx * vx + ny * vy + nz * vz, 0);
  let rim = Math.pow(1 - ndv, 3) * 0.35;
  // Luz de preenchimento (fria, fixa, sem sombra)
  let fl = lt.fill;
  let fdiff = Math.max(nx * fl.dirx + ny * fl.diry + nz * fl.dirz, 0) * fl.int;

  let li = lt.ambient + diff * 0.82;
  out[0] = constrain(baseColor[0] * (li * lt.color[0] + fdiff * fl.color[0]) + 255 * spec * lt.color[0] + 90 * rim, 0, 255);
  out[1] = constrain(baseColor[1] * (li * lt.color[1] + fdiff * fl.color[1]) + 255 * spec * lt.color[1] + 110 * rim, 0, 255);
  out[2] = constrain(baseColor[2] * (li * lt.color[2] + fdiff * fl.color[2]) + 255 * spec * lt.color[2] + 150 * rim, 0, 255);
}

// Normal geométrica no ponto P, garantindo que aponte contra o raio
// (toda superfície de entrada vista de fora satisfaz N·rd < 0). Essa
// regra resolve automaticamente a normal invertida da "mordida" (A−B).
function c4_normalInto(hit, Px, Py, Pz, dx, dy, dz, out) {
  let nx, ny, nz;
  if (hit.kind === 0) {
    nx = Px - hit.prim.center.x; ny = Py - hit.prim.center.y; nz = Pz - hit.prim.center.z;
    let l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
  } else {
    nx = 0; ny = 0; nz = 0;
    if (hit.ax === 0) nx = hit.s; else if (hit.ax === 1) ny = hit.s; else nz = hit.s;
  }
  if (nx * dx + ny * dy + nz * dz > 0) { nx = -nx; ny = -ny; nz = -nz; }
  out[0] = nx; out[1] = ny; out[2] = nz;
}

// Interseção raio-plano do chão (y = cena4.chao.y, normal +Y).
// O chão NÃO participa do CSG: é testado à parte e o hit mais
// próximo (sólido × chão) vence.
function c4_floorHitT(oy, dy) {
  if (dy >= -1e-6) return Infinity; // raio não desce
  let t = (cena4.chao.y - oy) / dy;
  return t > 0 ? t : Infinity;
}

// O ponto está na sombra? Traça um raio NA DIREÇÃO DA LUZ (direcional
// → direção fixa) contra o sólido CSG, usando os scratch SECUNDÁRIOS.
// A sombra é do RESULTADO da operação CSG de graça: c4_insideOf já
// codifica o modo, então a "mordida" de A−B deixa a luz atravessar.
function c4_csgOccluded(ox, oy, oz, mode) {
  let lt = cena4.light;
  let A = cena4._spanSA, B = cena4._spanSB;
  c4_primSpanInto(ox, oy, oz, lt.Lx, lt.Ly, lt.Lz, cena4.primA, A);
  c4_primSpanInto(ox, oy, oz, lt.Lx, lt.Ly, lt.Lz, cena4.primB, B);
  return c4_firstHit(A, B, mode) !== null;
}

// Cor vista por um raio REFLETIDO no chão (1 salto): testa só o sólido
// CSG (scratch secundários); sem novo shadow ray (peso baixo do reflexo
// não justifica o custo). Miss → céu refletido.
function c4_reflectColorInto(ox, oy, oz, dx, dy, dz, mode, out) {
  let A = cena4._spanSA, B = cena4._spanSB;
  c4_primSpanInto(ox, oy, oz, dx, dy, dz, cena4.primA, A);
  c4_primSpanInto(ox, oy, oz, dx, dy, dz, cena4.primB, B);
  let hit = c4_firstHit(A, B, mode);
  if (!hit) { c4_skyInto(dy, out); return; }
  let t = hit.t;
  let Px = ox + dx * t, Py = oy + dy * t, Pz = oz + dz * t;
  let n = cena4._tmp;
  c4_normalInto(hit, Px, Py, Pz, dx, dy, dz, n);
  c4_shadeInto(Px, Py, Pz, n[0], n[1], n[2], hit.prim.color, dx, dy, dz, 1.0, out);
}

// Sombreia um ponto do CHÃO: xadrez, difusa (N = +Y), sombra projetada,
// reflexo de 1 salto e fog fundindo no horizonte. Escreve em out.
function c4_shadeFloorInto(ox, oy, oz, dx, dy, dz, t, modeSec, out) {
  let ch = cena4.chao;
  let Px = ox + dx * t, Py = ch.y, Pz = oz + dz * t;

  // Xadrez procedural no plano XZ
  let par = ((Math.floor(Px / ch.tam) + Math.floor(Pz / ch.tam)) & 1) === 0;
  let base = par ? ch.corA : ch.corB;

  let lt = cena4.light;
  let diff = Math.max(lt.Ly, 0); // N=(0,1,0) → N·L = Ly

  // Sombra do sólido CSG projetada no chão (o chão não se auto-oclui)
  let K = 1.0;
  if (cena4.sombrasAtivas && c4_csgOccluded(Px, Py + 0.5, Pz, modeSec)) {
    K = (cena4.csgMode === 0) ? 0.55 : 0.30;
  }

  // Luz de preenchimento na normal do chão: max(N·dir, 0) = diry
  let fl = lt.fill;
  let fdiff = Math.max(fl.diry, 0) * fl.int;

  let li = lt.ambient + diff * 0.82 * K;
  let r = base[0] * (li * lt.color[0] + fdiff * fl.color[0]);
  let g = base[1] * (li * lt.color[1] + fdiff * fl.color[1]);
  let b = base[2] * (li * lt.color[2] + fdiff * fl.color[2]);

  // Reflexo de 1 salto (piso polido), peso Fresnel-ish: mais forte
  // em incidência rasante (dy ~ 0) do que olhando de cima (dy ~ -1).
  if (cena4.reflexoAtivo) {
    let rc = cena4._rcol;
    c4_reflectColorInto(Px, Py + 0.5, Pz, dx, -dy, dz, modeSec, rc);
    let grz = 1 + dy;
    let kR = Math.min(0.16 + 0.30 * grz * grz * grz, 0.5);
    r = r * (1 - kR) + rc[0] * kR;
    g = g * (1 - kR) + rc[1] * kR;
    b = b * (1 - kR) + rc[2] * kR;
  }

  // Fog: contraste do xadrez some e o chão se funde na cor do horizonte
  let f = 1 - Math.exp(-Math.max(0, t - 240) / 520);
  r = r * (1 - f) + 64 * f;
  g = g * (1 - f) + 74 * f;
  b = b * (1 - f) + 98 * f;

  out[0] = constrain(r, 0, 255);
  out[1] = constrain(g, 0, 255);
  out[2] = constrain(b, 0, 255);
}

// Cor de um único raio. Caminho completo do pixel: 1º hit do sólido
// CSG vs chão vs céu (o mais próximo vence), sombra via shadow ray e
// reflexo nos pixels de chão. Escreve em out [0..255].
function c4_shadePixelInto(ox, oy, oz, dx, dy, dz, out) {
  let A = cena4._spanA, B = cena4._spanB;
  c4_primSpanInto(ox, oy, oz, dx, dy, dz, cena4.primA, A);
  c4_primSpanInto(ox, oy, oz, dx, dy, dz, cena4.primB, B);
  let mode = cena4.csgMode;
  // No modo 0 (operandos translúcidos) sombra e reflexo usam a UNIÃO.
  let modeSec = (mode === 0) ? 1 : mode;

  let tFloor = c4_floorHitT(oy, dy);
  let hit = (mode !== 0) ? c4_firstHit(A, B, mode) : null;

  if (hit && hit.t < tFloor) {
    // --- Sólido CSG ---
    // Extrair TUDO do hit ANTES de qualquer raio secundário: _hit e os
    // scratch secundários são compartilhados pelos traces de sombra.
    let t = hit.t;
    let Px = ox + dx * t, Py = oy + dy * t, Pz = oz + dz * t;
    let n = cena4._tmp;
    c4_normalInto(hit, Px, Py, Pz, dx, dy, dz, n);
    let nx = n[0], ny = n[1], nz = n[2];
    let baseColor = hit.prim.color;
    let K = 1.0;
    if (cena4.sombrasAtivas &&
        c4_csgOccluded(Px + nx * 0.5, Py + ny * 0.5, Pz + nz * 0.5, modeSec)) {
      K = 0.30;
    }
    c4_shadeInto(Px, Py, Pz, nx, ny, nz, baseColor, dx, dy, dz, K, out);
    return;
  }

  if (tFloor < Infinity) {
    c4_shadeFloorInto(ox, oy, oz, dx, dy, dz, tFloor, modeSec, out);
  } else {
    c4_skyInto(dy, out);
  }

  // Modo 0: compor os operandos translúcidos SOBRE a base (chão/céu).
  // _spanA/_spanB sobreviveram: os raios secundários usam _spanSA/_spanSB.
  if (mode === 0) {
    c4_composeNoneInto(ox, oy, oz, dx, dy, dz, A, B, out, out);
  }
}

// Modo "Nenhuma": A e B TRANSLÚCIDOS, compostos de trás para frente,
// para revelar os dois operandos e sua interpenetração.
function c4_composeNoneInto(ox, oy, oz, dx, dy, dz, A, B, bg, out) {
  let r = bg[0], g = bg[1], b = bg[2];
  // ordena as duas superfícies frontais por t (mais distante primeiro)
  let tA = (A && A.valid) ? A.t0 : Infinity;
  let tB = (B && B.valid) ? B.t0 : Infinity;
  let order = tA >= tB
    ? [[tA, cena4.primA], [tB, cena4.primB]]
    : [[tB, cena4.primB], [tA, cena4.primA]];
  let alpha = 0.62;
  for (let k = 0; k < 2; k++) {
    let t = order[k][0], prim = order[k][1];
    if (!isFinite(t) || t <= 0.04) continue;
    let Px = ox + dx * t, Py = oy + dy * t, Pz = oz + dz * t;
    let nx = Px - prim.center.x, ny = Py - prim.center.y, nz = Pz - prim.center.z;
    let l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nx * dx + ny * dy + nz * dz > 0) { nx = -nx; ny = -ny; nz = -nz; }
    c4_shadeInto(Px, Py, Pz, nx, ny, nz, prim.color, dx, dy, dz, 1.0, cena4._scol);
    r = cena4._scol[0] * alpha + r * (1 - alpha);
    g = cena4._scol[1] * alpha + g * (1 - alpha);
    b = cena4._scol[2] * alpha + b * (1 - alpha);
  }
  out[0] = r; out[1] = g; out[2] = b;
}

// Cor do CÉU em função da componente vertical da direção do raio
// (dy > 0 = olhando para cima): horizonte claro → zênite escuro.
// Direções abaixo do horizonte clampam na cor do horizonte.
function c4_skyInto(dy, out) {
  let u = Math.sqrt(constrain(dy / 0.6, 0, 1));
  out[0] = 64 + (9 - 64) * u;
  out[1] = 74 + (13 - 74) * u;
  out[2] = 98 + (28 - 98) * u;
}

// Cor de fundo de uma LINHA do buffer (pré-preenchimento durante a
// varredura progressiva): converte a linha em direção de raio (com
// dcx = 0) e delega ao gradiente de céu — coerente com o render final.
function c4_bgInto(y, out) {
  let cam = cena4.cam;
  let ndcY = -(((y + 0.5) / cena4.rcH) * 2 - 1);
  let dcy = ndcY * cam.tan;
  let dx = cam.ux * dcy + cam.fx;
  let dy = cam.uy * dcy + cam.fy;
  let dz = cam.uz * dcy + cam.fz;
  let l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  c4_skyInto(dy / l, out);
}

// ============================================================
// PROJEÇÃO (mundo → tela centrada), inverso do pixelRay.
// Usada para desenhar overlays alinhados ao buffer.
// ============================================================
function c4_project(x, y, z) {
  let cam = cena4.cam;
  let dx = x - cam.ox, dy = y - cam.oy, dz = z - cam.oz;
  let zc = dx * cam.fx + dy * cam.fy + dz * cam.fz;     // profundidade (forward)
  if (zc <= 0.1) return { visivel: false, x: 0, y: 0 };
  let xc = dx * cam.rx + dy * cam.ry + dz * cam.rz;     // right
  let yc = dx * cam.ux + dy * cam.uy + dz * cam.uz;     // up
  let aspect = width / height;
  let ndcX = (xc / zc) / (aspect * cam.tan);
  let ndcY = (yc / zc) / cam.tan;
  return { visivel: true, x: ndcX * (width / 2), y: -ndcY * (height / 2) };
}

// Raio a partir de coordenadas de tela (para o clique do usuário).
function c4_screenRay(sx, sy) {
  let cam = cena4.cam;
  let ndcX = (sx / width) * 2 - 1;
  let ndcY = -((sy / height) * 2 - 1);
  let aspect = width / height;
  let dcx = ndcX * aspect * cam.tan, dcy = ndcY * cam.tan, dcz = -1;
  // dirWorld = right*dcx + up*dcy + forward*(-dcz)
  let dx = cam.rx * dcx + cam.ux * dcy + cam.fx * (-dcz);
  let dy = cam.ry * dcx + cam.uy * dcy + cam.fy * (-dcz);
  let dz = cam.rz * dcx + cam.uz * dcy + cam.fz * (-dcz);
  let l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return { ox: cam.ox, oy: cam.oy, oz: cam.oz, dx: dx / l, dy: dy / l, dz: dz / l };
}

// ============================================================
// RAY CASTING DO BUFFER (varredura progressiva sob demanda)
// ============================================================
function c4_recomputeStep() {
  let buf = cena4.rcBuffer;
  if (!buf) return;
  let cam = cena4.cam;
  let aspect = width / height;
  let rcW = cena4.rcW, rcH = cena4.rcH;

  if (cena4.scanY === 0) {
    buf.loadPixels();
    // pré-preenche TODO o buffer com o gradiente de fundo (linhas ainda
    // não computadas aparecem como fundo durante a varredura).
    let bgc = cena4._bg, px0 = buf.pixels;
    for (let y = 0; y < rcH; y++) {
      c4_bgInto(y, bgc);
      let r = bgc[0] | 0, g = bgc[1] | 0, b = bgc[2] | 0;
      for (let x = 0; x < rcW; x++) {
        let idx = 4 * (y * rcW + x);
        px0[idx] = r; px0[idx + 1] = g; px0[idx + 2] = b; px0[idx + 3] = 255;
      }
    }
  }

  // Varredura adaptativa: com sombras/reflexo o custo por raio sobe,
  // então processamos menos linhas por frame (frame-time estável; o
  // sweep completo leva ~20 frames em vez de ~14).
  let divisor = (cena4.sombrasAtivas || cena4.reflexoAtivo) ? 20 : 14;
  let linhas = Math.max(1, Math.ceil(rcH / divisor));
  let yEnd = Math.min(cena4.scanY + linhas, rcH);
  let px = buf.pixels, rgb = cena4._rgb;

  for (let y = cena4.scanY; y < yEnd; y++) {
    let ndcY = -(((y + 0.5) / rcH) * 2 - 1);
    let dcy = ndcY * cam.tan;
    for (let x = 0; x < rcW; x++) {
      let ndcX = ((x + 0.5) / rcW) * 2 - 1;
      let dcx = ndcX * aspect * cam.tan;
      // dirWorld = right*dcx + up*dcy + forward*1
      let dx = cam.rx * dcx + cam.ux * dcy + cam.fx;
      let dy = cam.ry * dcx + cam.uy * dcy + cam.fy;
      let dz = cam.rz * dcx + cam.uz * dcy + cam.fz;
      let l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      dx /= l; dy /= l; dz /= l;

      c4_shadePixelInto(cam.ox, cam.oy, cam.oz, dx, dy, dz, rgb);
      let idx = 4 * (y * rcW + x);
      px[idx] = rgb[0]; px[idx + 1] = rgb[1]; px[idx + 2] = rgb[2]; px[idx + 3] = 255;
    }
  }
  buf.updatePixels();
  cena4.scanY = yEnd;
  if (cena4.scanY >= rcH) { cena4.cacheValido = true; cena4.scanY = 0; }
}

// ============================================================
// DRAW
// ============================================================
function drawCena4() {
  c4_ensureLayout();

  // Recalcula o buffer apenas quando algo muda (câmera é fixa).
  if (!cena4.cacheValido) c4_recomputeStep();

  // Tudo é 2D (overlay + buffer). Desabilita o teste de profundidade
  // para que a ordem de desenho (pintor) defina a sobreposição.
  let gl = drawingContext;
  push();
  resetShader();
  ortho();
  noLights();
  gl.disable(gl.DEPTH_TEST);

  // 1) Sólido CSG ray-casted (esticado para a tela).
  noStroke();
  image(cena4.rcBuffer, -width / 2, -height / 2, width, height);
  // Filtro linear para um upscale suave (aplica-se aos frames seguintes;
  // a textura interna do buffer só existe após o primeiro image()).
  try {
    let tex = window._renderer && window._renderer.getTexture
      ? window._renderer.getTexture(cena4.rcBuffer) : null;
    if (tex && tex.setInterpolation) tex.setInterpolation(LINEAR, LINEAR);
  } catch (e) { /* no-op */ }

  // 2) Overlays vetoriais (didáticos — a tecla [V] alterna a
  //    "visão limpa"; botões e portal são interação e ficam sempre)
  if (cena4.overlaysVisiveis) {
    c4_drawRayMarkers();
    c4_drawScanlineGuide();
    c4_drawInset();
  }
  c4_drawUI();

  gl.enable(gl.DEPTH_TEST);
  pop();
}

// Marcadores do último raio (na vista principal): ponto de impacto.
function c4_drawRayMarkers() {
  for (let i = 0; i < cena4.rays.length; i++) {
    let ray = cena4.rays[i];
    let recente = (i === cena4.rays.length - 1);
    if (ray.hitT == null) continue;
    let pr = c4_project(ray.hx, ray.hy, ray.hz);
    if (!pr.visivel) continue;
    let a = recente ? 255 : 90;
    noStroke();
    fill(60, 255, 120, a * 0.35); circle(pr.x, pr.y, recente ? 26 : 14);
    fill(80, 255, 140, a); circle(pr.x, pr.y, recente ? 12 : 7);
  }
}

// Linha-guia brilhante da varredura (enquanto computa).
function c4_drawScanlineGuide() {
  if (cena4.cacheValido) return;
  let yScreen = (cena4.scanY / cena4.rcH) * height - height / 2;
  stroke(120, 230, 255, 180);
  strokeWeight(2);
  line(-width / 2, yScreen, width / 2, yScreen);
}

// ============================================================
// INSET: diagrama esquemático (vista de cima, plano XZ) que mostra
// claramente o RAIO lançado, as AABBs e as interseções — resolve o
// problema de visualizar um raio que, na câmera principal, sairia do
// próprio olho (degenerado num ponto).
// ============================================================
function c4_insetScaleAndMap() {
  let ins = cena4.ui.inset;
  let xmin = -150, xmax = 150, zmin = -150, zmax = 360;
  let sc = Math.min(ins.w / (xmax - xmin), ins.h / (zmax - zmin));
  let cx = ins.x + ins.w / 2;
  let zc = (zmin + zmax) / 2;
  let cyMid = ins.y + ins.h / 2;
  return {
    sc,
    map: (wx, wz) => ({ x: cx + wx * sc, y: cyMid + (wz - zc) * sc }),
  };
}

function c4_drawInset() {
  let ins = cena4.ui.inset;
  let m = c4_insetScaleAndMap();
  let S = (p) => p.x - width / 2;   // tela → centrado X
  let T = (p) => p.y - height / 2;  // tela → centrado Y

  // fundo do painel
  noStroke();
  fill(6, 8, 18, 220);
  rect(ins.x - width / 2, ins.y - height / 2, ins.w, ins.h);
  stroke(90, 110, 170, 120); strokeWeight(1); noFill();
  rect(ins.x - width / 2, ins.y - height / 2, ins.w, ins.h);

  // título do diagrama (barrinha)
  noStroke(); fill(120, 160, 230, 90);
  rect(ins.x - width / 2, ins.y - height / 2, ins.w, 4);

  // AABBs (retângulos no plano XZ)
  let prims = [cena4.primA, cena4.primB];
  for (let p of prims) {
    let a = m.map(p.aabb.min.x, p.aabb.min.z);
    let b = m.map(p.aabb.max.x, p.aabb.max.z);
    stroke(0, 220, 255, 120); strokeWeight(1); noFill();
    rect(S(a), T(a), b.x - a.x, b.y - a.y);
  }

  // Primitivas (esfera = círculo; caixa = retângulo preenchido)
  for (let p of prims) {
    let c = m.map(p.center.x, p.center.z);
    noStroke(); fill(p.color[0], p.color[1], p.color[2], 90);
    if (p.kind === 'sphere') {
      circle(S(c), T(c), p.radius * 2 * m.sc);
    } else {
      let a = m.map(p.center.x - p.half.x, p.center.z - p.half.z);
      let b = m.map(p.center.x + p.half.x, p.center.z + p.half.z);
      rect(S(a), T(a), b.x - a.x, b.y - a.y);
    }
  }

  // Câmera (olho) + raio do último clique
  let camP = m.map(cena4.cam.ox, cena4.cam.oz);
  noStroke(); fill(255, 230, 120);
  circle(S(camP), T(camP), 9);

  let ray = cena4.rays.length ? cena4.rays[cena4.rays.length - 1] : null;
  if (ray) {
    // direção projetada no plano XZ
    let farT = ray.hitT != null ? ray.hitT : 600;
    let ex = ray.ox + ray.dx * farT, ez = ray.oz + ray.dz * farT;
    let e = m.map(ex, ez);
    stroke(255, 220, 70, 230); strokeWeight(2);
    line(S(camP), T(camP), S(e), T(e));

    // marcadores das interseções (entrada/saída) ao longo do raio
    c4_insetMark(ray.tEnterA, ray, m, S, T, [80, 170, 255]);
    c4_insetMark(ray.tExitA, ray, m, S, T, [80, 170, 255]);
    c4_insetMark(ray.tEnterB, ray, m, S, T, [255, 150, 80]);
    c4_insetMark(ray.tExitB, ray, m, S, T, [255, 150, 80]);
    // ponto de impacto no sólido CSG (verde, maior)
    if (ray.hitT != null) {
      let h = m.map(ray.ox + ray.dx * ray.hitT, ray.oz + ray.dz * ray.hitT);
      noStroke(); fill(60, 255, 120); circle(S(h), T(h), 8);
    }
  }
}

function c4_insetMark(t, ray, m, S, T, col) {
  if (t == null || t <= 0) return;
  let p = m.map(ray.ox + ray.dx * t, ray.oz + ray.dz * t);
  noStroke(); fill(col[0], col[1], col[2], 230);
  circle(S(p), T(p), 5.5);
}

// ============================================================
// UI: botões CSG, botão [B], portal (seta verde)
// ============================================================
function c4_drawUI() {
  // --- Barra de operações CSG ---
  for (let btn of cena4.ui.csgBtns) {
    let ativo = (btn.mode === cena4.csgMode);
    let x = btn.x - width / 2, y = btn.y - height / 2;
    noStroke();
    fill(ativo ? 50 : 24, ativo ? 80 : 32, ativo ? 140 : 52, 235);
    rect(x, y, btn.w, btn.h);
    stroke(ativo ? color(120, 220, 255) : color(80, 100, 150, 140));
    strokeWeight(ativo ? 2 : 1); noFill();
    rect(x, y, btn.w, btn.h);
    // ícone (dois círculos) ilustrando a operação
    c4_drawCsgIcon(x + 24, y + btn.h / 2, btn.mode, ativo);
  }

  // --- Botão [B]: alterna esfera/caixa ---
  let bb = cena4.ui.btnB;
  let bx = bb.x - width / 2, by = bb.y - height / 2;
  noStroke(); fill(28, 40, 64, 235); rect(bx, by, bb.w, bb.h);
  stroke(120, 200, 160, 180); strokeWeight(1.5); noFill(); rect(bx, by, bb.w, bb.h);
  // ícone do tipo atual de B
  noStroke(); fill(cena4.primB.color[0], cena4.primB.color[1], cena4.primB.color[2], 220);
  if (cena4.primB.kind === 'sphere') circle(bx + 26, by + bb.h / 2, 22);
  else rect(bx + 15, by + bb.h / 2 - 11, 22, 22);

  // --- Portal (seta verde) ---
  c4_drawPortal();
}

// Ícones aproximados das operações CSG (rótulos textuais ficam no HUD).
function c4_drawCsgIcon(cx, cy, mode, ativo) {
  let off = 9, r = 11;
  let cA = color(120, 170, 255, ativo ? 255 : 160);
  let cB = color(255, 160, 120, ativo ? 255 : 160);
  noFill(); strokeWeight(1.6);
  if (mode === 0) {
    // Nenhuma: dois círculos separados (contorno)
    stroke(cA); circle(cx - off, cy, r * 2);
    stroke(cB); circle(cx + off, cy, r * 2);
  } else if (mode === 1) {
    // União: dois círculos preenchidos sobrepostos
    noStroke(); fill(120, 170, 255, ativo ? 210 : 130); circle(cx - off, cy, r * 2);
    fill(255, 160, 120, ativo ? 210 : 130); circle(cx + off, cy, r * 2);
  } else if (mode === 2) {
    // Interseção: contornos + lente central preenchida
    stroke(cA); circle(cx - off, cy, r * 2);
    stroke(cB); circle(cx + off, cy, r * 2);
    noStroke(); fill(180, 230, 160, ativo ? 230 : 150); ellipse(cx, cy, off * 1.4, r * 1.7);
  } else {
    // Diferença: A preenchido, B só contorno (subtraído)
    noStroke(); fill(120, 170, 255, ativo ? 210 : 130); circle(cx - off, cy, r * 2);
    stroke(cB); noFill(); strokeWeight(1.6); circle(cx + off, cy, r * 2);
  }
  strokeWeight(1);
}

function c4_drawPortal() {
  let p = cena4.ui.portal;
  let cx = p.x + p.w / 2 - width / 2;
  let cy = p.y + p.h / 2 - height / 2;
  cena4.portalPulse += 0.05;
  let s = 1.0 + 0.08 * Math.sin(cena4.portalPulse);

  push();
  translate(cx, cy);
  scale(s);
  // halo
  noStroke(); fill(50, 255, 150, 40); circle(0, 0, p.w * 0.95);
  // haste + ponta (seta apontando para a direita)
  fill(60, 255, 150);
  rectMode(CENTER);
  rect(-6, 0, 30, 16);
  triangle(6, -18, 6, 18, 30, 0);
  rectMode(CORNER);
  pop();
}

// ============================================================
// PICK — não usado nesta cena (input é hit-test 2D). Mantido vazio
// para não quebrar o switch de renderPickBuffer() no sketch.js.
// ============================================================
function drawCena4Pick() { /* intencionalmente vazio */ }

// ============================================================
// INPUT (hit-testing 2D em coordenadas de tela)
// ============================================================
function c4_pointInRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

function clickCena4() {
  // 1) Botões de operação CSG
  for (let btn of cena4.ui.csgBtns) {
    if (c4_pointInRect(mouseX, mouseY, btn)) {
      cena4.csgMode = btn.mode;
      c4_invalidar(); // re-varredura desde o topo
      return;
    }
  }
  // 2) Botão [B]: alterna esfera/caixa
  if (c4_pointInRect(mouseX, mouseY, cena4.ui.btnB)) {
    cena4.primB.kind = (cena4.primB.kind === 'sphere') ? 'box' : 'sphere';
    c4_updateAABB(cena4.primB);
    c4_invalidar();
    return;
  }
  // 3) Portal → Cena 5
  if (c4_pointInRect(mouseX, mouseY, cena4.ui.portal)) {
    iniciarTransicao(5);
    return;
  }
  // 4) Qualquer outro ponto: LANÇA UM RAIO (ray casting interativo)
  c4_launchRay(mouseX, mouseY);
}

function c4_launchRay(sx, sy) {
  let ray = c4_screenRay(sx, sy);
  let A = {}, B = {};
  let okA = c4_primSpanInto(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, cena4.primA, A);
  let okB = c4_primSpanInto(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, cena4.primB, B);
  let aabbA = c4_aabbHit(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, cena4.primA.aabb);
  let aabbB = c4_aabbHit(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, cena4.primB.aabb);
  let hit = c4_firstHit(A, B, cena4.csgMode);

  let rec = {
    ox: ray.ox, oy: ray.oy, oz: ray.oz, dx: ray.dx, dy: ray.dy, dz: ray.dz,
    aabbA, aabbB,
    tEnterA: okA ? A.t0 : null, tExitA: okA ? A.t1 : null,
    tEnterB: okB ? B.t0 : null, tExitB: okB ? B.t1 : null,
    hitT: hit ? hit.t : null, hx: 0, hy: 0, hz: 0,
  };
  if (hit) {
    rec.hx = ray.ox + ray.dx * hit.t;
    rec.hy = ray.oy + ray.dy * hit.t;
    rec.hz = ray.oz + ray.dz * hit.t;
  }
  cena4.rays.push(rec);
  if (cena4.rays.length > cena4.maxRays) cena4.rays.shift();
}

// ============================================================
// TECLADO: [S] sombras · [R] reflexo no chão · [V] visão limpa
// (despachado pelo keyPressed() do sketch.js quando cenaAtual === 4)
// ============================================================
function keyPressedCena4() {
  if (key === 's' || key === 'S') {
    cena4.sombrasAtivas = !cena4.sombrasAtivas;
    c4_invalidar();
  } else if (key === 'r' || key === 'R') {
    cena4.reflexoAtivo = !cena4.reflexoAtivo;
    c4_invalidar();
  } else if (key === 'v' || key === 'V') {
    // Só oculta overlays didáticos — não mexe no buffer
    cena4.overlaysVisiveis = !cena4.overlaysVisiveis;
  }
}

// ============================================================
// HUD
// ============================================================
function getHUDCena4() {
  let lines = [];
  lines.push("CENA 4: CSG e Ray Casting (CPU)");
  lines.push("");
  lines.push("Paradigma: sólido renderizado raio-a-raio (sem triângulos)");
  lines.push("Operação CSG: " + cena4.csgModes[cena4.csgMode]);
  lines.push("Operando B: " + (cena4.primB.kind === 'sphere'
    ? "Esfera — raiz quadrática" : "Caixa AABB — slab method"));
  lines.push("Buffer ray-cast: " + cena4.rcW + "×" + cena4.rcH +
    (cena4.cacheValido ? "" : " (computando…)"));
  lines.push("Sombras: " + (cena4.sombrasAtivas ? "ligadas" : "desligadas") +
    " · Reflexo no chão: " + (cena4.reflexoAtivo ? "ligado" : "desligado"));
  lines.push("");

  let ray = cena4.rays.length ? cena4.rays[cena4.rays.length - 1] : null;
  if (ray) {
    lines.push("Último raio — AABB A: " + (ray.aabbA ? "sim" : "não") +
      " · AABB B: " + (ray.aabbB ? "sim" : "não"));
    if (ray.tEnterA != null) lines.push("   A: t_enter=" + ray.tEnterA.toFixed(1) + " t_exit=" + ray.tExitA.toFixed(1));
    if (ray.tEnterB != null) lines.push("   B: t_enter=" + ray.tEnterB.toFixed(1) + " t_exit=" + ray.tExitB.toFixed(1));
    if (ray.hitT != null) lines.push("   Impacto no sólido: t=" + ray.hitT.toFixed(1));
    else lines.push("   Raio não interceptou o sólido");
    lines.push("");
  }

  lines.push("▶ Clique no cenário: lançar 1 raio (veja o diagrama)");
  lines.push("▶ Barra inferior: Nenhuma · União · Interseção · Diferença");
  lines.push("▶ Botão [B]: alternar Esfera/Caixa (quadrática vs slab)");
  lines.push("▶ Teclas: [S] sombras · [R] reflexo · [V] visão limpa");
  lines.push("▶ Seta verde (dir.) ou tecla [→]: portal → Cena 5");
  lines.push("   No diagrama (inset): retângulos ciano = AABBs (aceleradores)");
  return lines;
}
