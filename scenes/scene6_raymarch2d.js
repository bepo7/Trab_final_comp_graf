// ============================================================
// CENA 6: Ray Marching 2D — o ALGORITMO visto por dentro
// ------------------------------------------------------------
// A cena 5 mostra o RESULTADO do ray marching (shader GPU); esta
// cena mostra o ALGORITMO: um único raio, em 2D, marchando por
// SPHERE TRACING. Em cada passo desenha-se o CÍRCULO de raio
// d = SDF(p) — a "esfera de passo variável": é seguro avançar d
// porque, por definição da SDF, nada está mais perto que isso.
//   • d grande (longe de tudo) → passo gigante;
//   • d pequeno (perto de uma superfície) → passos curtos;
//   • d < EPS → HIT; t > MAX_DIST ou MAX_STEPS → MISS.
// [F] compara com a marcha de PASSO FIXO (amostras equiespaçadas):
// gasta mais amostras e ainda atravessa a superfície ao detectar.
// Obstáculos arrastáveis. O mouse mira o raio, [B] para ATIRAR.
// Tudo em coordenadas de PIXEL (EPS/MAX em px), num plano 2D frontal.
// ============================================================

const C6_EPS = 2.5;        // critério de HIT (px) — escala de pixels
const C6_MAX_STEPS = 40;   // limite de passos do sphere tracing
const C6_FIXO_DT = 28;     // espaçamento da marcha de passo fixo (px)

let cena6 = {
  origem: { x: 0, y: 0 },     // "câmera" do raio (esquerda, meia altura)
  dir: { x: 1, y: 0 },        // direção normalizada do raio
  mira: { x: 0, y: 0 },       // último alvo do mouse (coords centradas)
  maxDist: 0,                 // t máximo do raio (c6_layout)
  raioVisualMax: 0,           // clamp SÓ do desenho dos círculos de passo

  obstaculos: [],             // [{tipo:'circle'|'box', x,y, r|hx,hy, cor}]
  arrastando: -1,             // índice do obstáculo arrastado (-1 = nenhum)
  dragOff: { x: 0, y: 0 },    // offset centro−mouse no início do arrasto

  // Caminho do sphere tracing (cache — recomputado só quando algo muda)
  passos: [],                 // [{x, y, d, t}] um por passo
  resultado: 'miss-dist',     // 'hit' | 'miss-steps' | 'miss-dist'
  hitPonto: null,
  passosFixos: [],            // [{x, y, dentro}] marcha de passo fixo
  fixoHitIdx: -1,             // índice da 1ª amostra fixa dentro do sólido
  caminhoSujo: true,

  // Animação (revela 1 passo a cada framesPorPasso; segura e reinicia)
  passoVisivel: 0,
  animTimer: 0,
  framesPorPasso: 30,  // ~0.5s por passo a 60 fps
  holdFrames: 80,
  pausado: false,
  comparaFixo: false,
  atirou: false,

  ui: { portal: null },       // retângulo do portal em coords de TELA
  _lastW: 0, _lastH: 0,
  portalPulse: 0,
};

// ============================================================
// SETUP / LAYOUT
// ============================================================
function setupCena6() {
  cena6.obstaculos = [
    { tipo: 'circle', x: -width * 0.05, y: -height * 0.12, r: 64, cor: [88, 156, 240] },
    { tipo: 'circle', x: width * 0.16, y: height * 0.18, r: 46, cor: [170, 120, 255] },
    { tipo: 'box', x: width * 0.30, y: -height * 0.06, hx: 70, hy: 46, cor: [240, 142, 78] },
  ];
  c6_layout();
}

// Posições dependentes do tamanho da janela (origem do raio, portal).
function c6_layout() {
  cena6.origem = { x: -width / 2 + 90, y: 0 };
  cena6.maxDist = width * 1.2;
  cena6.raioVisualMax = Math.min(width, height) * 0.45;
  cena6.ui.portal = { x: width - 116, y: height / 2 - 48, w: 96, h: 96 };
  // obstáculos sempre dentro da tela
  for (let o of cena6.obstaculos) {
    o.x = constrain(o.x, -width / 2 + 20, width / 2 - 20);
    o.y = constrain(o.y, -height / 2 + 20, height / 2 - 20);
  }
  cena6._lastW = width; cena6._lastH = height;
  cena6.caminhoSujo = true;
}

function c6_ensureLayout() {
  if (width !== cena6._lastW || height !== cena6._lastH) c6_layout();
}

// ============================================================
// SDFs 2D (mesmas funções do shader da cena 5, em JS e em pixels)
// ============================================================
function sdCircle2D(px, py, o) {
  return Math.hypot(px - o.x, py - o.y) - o.r;
}

// SDF exata de retângulo (espelha o sdBox do raymarching.frag em 2D)
function sdBox2D(px, py, o) {
  let dx = Math.abs(px - o.x) - o.hx;
  let dy = Math.abs(py - o.y) - o.hy;
  let ex = Math.max(dx, 0), ey = Math.max(dy, 0);
  return Math.hypot(ex, ey) + Math.min(Math.max(dx, dy), 0);
}

function c6_sdObstaculo(px, py, o) {
  return (o.tipo === 'circle') ? sdCircle2D(px, py, o) : sdBox2D(px, py, o);
}

// SDF da CENA: o mínimo entre todos os obstáculos — exatamente o
// "map(p)" do shader. É o coração do passo variável.
function c6_sdScene(px, py) {
  let d = Infinity;
  for (let o of cena6.obstaculos) {
    let di = c6_sdObstaculo(px, py, o);
    if (di < d) d = di;
  }
  return d;
}

// ============================================================
// SPHERE TRACING (caminho completo, guardando cada passo)
// ============================================================
function c6_recomputePath() {
  let o = cena6.origem, dir = cena6.dir;
  cena6.passos = [];
  cena6.hitPonto = null;
  cena6.resultado = 'miss-steps';
  let t = 0;
  for (let i = 0; i < C6_MAX_STEPS; i++) {
    let px = o.x + dir.x * t, py = o.y + dir.y * t;
    let d = c6_sdScene(px, py);
    cena6.passos.push({ x: px, y: py, d: d, t: t });
    if (d < C6_EPS) {
      // HIT: d está dentro da tolerância (inclui d ≤ 0, ou seja,
      // o raio já penetrou a superfície — overshoot do passo anterior).
      cena6.resultado = 'hit';
      cena6.hitPonto = { x: px, y: py };
      break;
    }
    t += d; // ← O PASSO VARIÁVEL: avança exatamente a distância segura
    if (t > cena6.maxDist) { cena6.resultado = 'miss-dist'; break; }
  }

  // Marcha de PASSO FIXO no mesmo raio (para o toggle [F]): amostras a
  // cada C6_FIXO_DT px; "hit" = primeira amostra DENTRO do sólido
  // (d < 0) — note que ela já ATRAVESSOU a superfície (overshoot).
  cena6.passosFixos = [];
  cena6.fixoHitIdx = -1;
  for (let tf = 0; tf <= cena6.maxDist; tf += C6_FIXO_DT) {
    let px = o.x + dir.x * tf, py = o.y + dir.y * tf;
    let dentro = c6_sdScene(px, py) < 0;
    cena6.passosFixos.push({ x: px, y: py, dentro: dentro });
    if (dentro) { cena6.fixoHitIdx = cena6.passosFixos.length - 1; break; }
  }

  if (cena6.passoVisivel > cena6.passos.length) {
    cena6.passoVisivel = cena6.passos.length; // caminho pode ter encolhido
  }
}

// ============================================================
// DRAW
// ============================================================
function drawCena6() {
  c6_ensureLayout();

  // Mira segue o mouse — exceto durante o arrasto de um obstáculo
  // (uma causa de mudança por vez: a marcha reage só ao obstáculo).
  if (cena6.arrastando < 0 && !(mouseX === 0 && mouseY === 0)) {
    let wx = mouseX - width / 2, wy = mouseY - height / 2;
    cena6.mira = { x: wx, y: wy };
  }

  if (cena6.caminhoSujo) {
    c6_recomputePath();
    cena6.caminhoSujo = false;
  }

  // Animação passo-a-passo em loop
  if (cena6.atirou && !cena6.pausado) {
    cena6.animTimer++;
    if (cena6.passoVisivel < cena6.passos.length) {
      if (cena6.animTimer >= cena6.framesPorPasso) {
        cena6.passoVisivel++;
        cena6.animTimer = 0;
      }
    } else if (cena6.animTimer >= cena6.holdFrames) {
      // Quando termina, ao invés de recomeçar em loop,
      // apaga o raio e espera o próximo tiro.
      cena6.atirou = false;
      cena6.passoVisivel = 0;
      cena6.animTimer = 0;
    }
  }

  // Cena 100% 2D: ordem do pintor define a sobreposição (como na cena 4)
  let gl = drawingContext;
  push();
  resetShader();
  ortho();
  noLights();
  gl.disable(gl.DEPTH_TEST);

  // --- Grid de fundo (mesma identidade visual da cena de curvas) ---
  stroke(38, 42, 58);
  strokeWeight(1);
  let step = 80;
  for (let x = -Math.ceil(width / 2 / step) * step; x <= width / 2; x += step) {
    line(x, -height / 2, x, height / 2);
  }
  for (let y = -Math.ceil(height / 2 / step) * step; y <= height / 2; y += step) {
    line(-width / 2, y, width / 2, y);
  }

  // --- Obstáculos (as "superfícies" da cena) ---
  for (let i = 0; i < cena6.obstaculos.length; i++) {
    let o = cena6.obstaculos[i];
    let arrast = (i === cena6.arrastando);
    fill(o.cor[0], o.cor[1], o.cor[2], 70);
    if (arrast) { stroke(255, 230, 120); strokeWeight(2.5); }
    else { stroke(o.cor[0], o.cor[1], o.cor[2], 220); strokeWeight(2); }
    if (o.tipo === 'circle') {
      circle(o.x, o.y, o.r * 2);
    } else {
      rectMode(CENTER);
      rect(o.x, o.y, o.hx * 2, o.hy * 2);
      rectMode(CORNER);
    }
  }

  // --- [F] Marcha de PASSO FIXO (contraste): pontinhos equiespaçados ---
  if (cena6.comparaFixo) {
    noStroke();
    for (let i = 0; i < cena6.passosFixos.length; i++) {
      let p = cena6.passosFixos[i];
      fill(150, 150, 165, 200);
      circle(p.x, p.y, 5);
    }
    if (cena6.fixoHitIdx >= 0) {
      let p = cena6.passosFixos[cena6.fixoHitIdx];
      noFill();
      stroke(255, 90, 90);
      strokeWeight(2);
      circle(p.x, p.y, 14); // a amostra que JÁ entrou no sólido
    }
  }

  // --- Raio-guia completo (fraco): a direção mirada pelo mouse ---
  let vx = cena6.mira.x - cena6.origem.x;
  let vy = cena6.mira.y - cena6.origem.y;
  let vl = Math.hypot(vx, vy);
  let fimX = cena6.origem.x + (vx / vl) * cena6.maxDist;
  let fimY = cena6.origem.y + (vy / vl) * cena6.maxDist;
  if (vl > 8) {
    stroke(255, 220, 70, 45);
    strokeWeight(1);
    line(cena6.origem.x, cena6.origem.y, fimX, fimY);
  }

  // --- Círculos de passo (as "esferas" do sphere tracing) ---
  if (cena6.atirou) {
    let k = cena6.passoVisivel;
  noFill();
  for (let i = 0; i < k; i++) {
    let p = cena6.passos[i];
    if (p.d <= 0) continue; // não desenha círculo p/ SDF negativa (overshoot)
    let raio = Math.min(p.d, cena6.raioVisualMax);
    let clampado = (p.d > cena6.raioVisualMax);
    // mais antigo apagado → mais recente brilhante
    let a = (k <= 1) ? 230 : 50 + 180 * (i / (k - 1));
    if (clampado) a = Math.min(a, 60);
    stroke(0, 200, 255, a);
    strokeWeight(1.5);
    circle(p.x, p.y, raio * 2);
  }
  // preenchimento suave só no círculo corrente
  if (k > 0) {
    let p = cena6.passos[k - 1];
    if (p.d > 0) {
      fill(0, 200, 255, 16);
      stroke(0, 200, 255, 230);
      strokeWeight(1.5);
      circle(p.x, p.y, Math.min(p.d, cena6.raioVisualMax) * 2);
      noFill();
    }
  }

  // --- Trecho do raio já percorrido + pontos de passo ---
  if (k > 0) {
    let pk = cena6.passos[k - 1];
    stroke(255, 220, 70, 230);
    strokeWeight(2);
    line(cena6.origem.x, cena6.origem.y, pk.x, pk.y);
    noStroke();
    for (let i = 0; i < k; i++) {
      let p = cena6.passos[i];
      if (i === k - 1) {
        fill(0, 200, 255, 60); circle(p.x, p.y, 20);
        fill(255); circle(p.x, p.y, 10);
      } else {
        fill(235); circle(p.x, p.y, 6);
      }
    }
  }

    // --- Resultado (quando a animação revelou o caminho inteiro) ---
    if (k === cena6.passos.length && cena6.passos.length > 0) {
      let ult = cena6.passos[cena6.passos.length - 1];
      if (cena6.resultado === 'hit') {
        let pulso = 1 + 0.18 * Math.sin(frameCount * 0.15);
        noStroke();
        fill(60, 255, 120, 90); circle(cena6.hitPonto.x, cena6.hitPonto.y, 30 * pulso);
        fill(80, 255, 140); circle(cena6.hitPonto.x, cena6.hitPonto.y, 12);
      } else {
        noFill();
        stroke(255, 90, 90, 230);
        strokeWeight(2);
        circle(ult.x, ult.y, 18);
      }
    }
  } // fim if (cena6.atirou)

  // --- Origem: a "câmera" que lança o raio ---
  push();
  translate(cena6.origem.x, cena6.origem.y);
  rotate(Math.atan2(cena6.dir.y, cena6.dir.x));
  noStroke();
  fill(255, 230, 120, 50); circle(0, 0, 30);
  fill(255, 230, 120); circle(0, 0, 12);
  triangle(8, -7, 8, 7, 22, 0);
  pop();

  // --- Portal (seta verde) → Cena 7 ---
  c6_drawPortal();

  gl.enable(gl.DEPTH_TEST);
  pop();
}

function c6_drawPortal() {
  let p = cena6.ui.portal;
  let cx = p.x + p.w / 2 - width / 2;
  let cy = p.y + p.h / 2 - height / 2;
  cena6.portalPulse += 0.05;
  let s = 1.0 + 0.08 * Math.sin(cena6.portalPulse);

  push();
  translate(cx, cy);
  scale(s);
  noStroke();
  fill(50, 255, 150, 40); circle(0, 0, p.w * 0.95);
  fill(60, 255, 150);
  rectMode(CENTER);
  rect(-6, 0, 30, 16);
  triangle(6, -18, 6, 18, 30, 0);
  rectMode(CORNER);
  pop();
}

// ============================================================
// PICK — não usado: a interação é hit-test 2D (como na cena 4).
// ============================================================
function drawCena6Pick() { /* intencionalmente vazio */ }

// ============================================================
// INPUT
// ============================================================
function c6_pointInRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

function mousePressedCena6() {
  // 1) Portal → Cena 7
  if (c6_pointInRect(mouseX, mouseY, cena6.ui.portal)) {
    iniciarTransicao(7);
    return;
  }
  // 2) Obstáculo (prioridade sobre mirar; do desenhado por cima para baixo)
  let wx = mouseX - width / 2, wy = mouseY - height / 2;
  for (let i = cena6.obstaculos.length - 1; i >= 0; i--) {
    let o = cena6.obstaculos[i];
    if (c6_sdObstaculo(wx, wy, o) <= 8) {
      cena6.arrastando = i;
      cena6.dragOff = { x: o.x - wx, y: o.y - wy };
      return;
    }
  }
  // 3) Clique no fundo: sem ação (o raio é atirado pela tecla B)
}

function mouseDraggedCena6() {
  if (cena6.arrastando < 0) return;
  let o = cena6.obstaculos[cena6.arrastando];
  o.x = constrain(mouseX - width / 2 + cena6.dragOff.x, -width / 2 + 20, width / 2 - 20);
  o.y = constrain(mouseY - height / 2 + cena6.dragOff.y, -height / 2 + 20, height / 2 - 20);
  cena6.caminhoSujo = true;
}

function mouseReleasedCena6() {
  cena6.arrastando = -1;
}

// [B] atira o raio · [Espaço] pausa/retoma · [N] avança 1 passo (pausado) · [F] passo fixo
function keyPressedCena6() {
  if (key === 'b' || key === 'B') {
    // ATIRAR o raio na direção da mira atual
    let wx = cena6.mira.x, wy = cena6.mira.y;
    let vx = wx - cena6.origem.x, vy = wy - cena6.origem.y;
    let l = Math.hypot(vx, vy);
    if (l > 8) {
      cena6.dir = { x: vx / l, y: vy / l };
      cena6.caminhoSujo = true;
      cena6.passoVisivel = 0;
      cena6.animTimer = 0;
      cena6.atirou = true;
    }
  } else if (key === ' ') {
    cena6.pausado = !cena6.pausado;
  } else if (key === 'n' || key === 'N') {
    if (cena6.pausado) {
      cena6.passoVisivel = (cena6.passoVisivel >= cena6.passos.length)
        ? 0 : cena6.passoVisivel + 1;
      cena6.animTimer = 0;
    }
  } else if (key === 'f' || key === 'F') {
    cena6.comparaFixo = !cena6.comparaFixo;
  }
}

// ============================================================
// HUD
// ============================================================
function getHUDCena6() {
  let lines = [];
  lines.push("CENA 6: Ray Marching 2D — Sphere Tracing");
  lines.push("");

  let k = cena6.passoVisivel, n = cena6.passos.length;
  lines.push("Passo: " + k + " / " + n + (cena6.pausado ? " (pausado)" : ""));
  if (k > 0) {
    let p = cena6.passos[Math.min(k, n) - 1];
    lines.push("t (avanço no raio): " + p.t.toFixed(1) + " px");
    lines.push("d = SDF(p): " + p.d.toFixed(1) + " px → próximo passo");
  }
  lines.push("EPS: " + C6_EPS + " px · MAX_STEPS: " + C6_MAX_STEPS +
    " · MAX_DIST: " + Math.round(cena6.maxDist) + " px");

  let status;
  if (!cena6.atirou) {
    status = "Aguardando — pressione [B] para atirar";
  } else if (k < n) {
    status = "marchando…";
  } else if (cena6.resultado === 'hit') {
    let ult = cena6.passos[n - 1];
    status = "HIT em t=" + ult.t.toFixed(1) + " px (" + n + " passos)";
  } else if (cena6.resultado === 'miss-dist') {
    status = "MISS — passou de MAX_DIST";
  } else {
    status = "MISS — MAX_STEPS esgotado";
  }
  lines.push("Status: " + status);

  if (cena6.comparaFixo) {
    let m = cena6.passosFixos.length;
    lines.push("Passo fixo: Δ=" + C6_FIXO_DT + " px → " + m + " amostras" +
      (cena6.fixoHitIdx >= 0 ? " (entrou no sólido!)" : " (sem hit)") +
      " vs " + n + " passos adaptativos");
  }

  lines.push("");
  lines.push("▶ Mouse: mira o raio · [B] ATIRA o raio na direção da mira");
  lines.push("▶ Arraste um obstáculo para movê-lo");
  lines.push("▶ [Espaço] pausa · [N] passo a passo (pausado) · [F] passo fixo");
  lines.push("▶ Círculo ciano = distância segura dada pela SDF (passo variável)");
  lines.push("▶ Clique na seta verde (dir.) ou [→]: portal → Cena 7");
  return lines;
}
