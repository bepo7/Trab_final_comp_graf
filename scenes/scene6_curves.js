// ============================================================
// CENA 6: Curvas Paramétricas (Bézier)
// ------------------------------------------------------------
// Editor interativo de uma curva de Bézier CÚBICA (4 pontos de
// controle arrastáveis). A curva é avaliada de duas formas, à mão
// (sem usar bezier()/bezierPoint() do p5):
//   • Base de Bernstein:  B(t) = Σ Bᵢ(t)·Pᵢ   (traça a curva)
//   • Algoritmo de De Casteljau: interpolações lineares sucessivas
//     (a "régua dobrando") — mostrado animado em t∈[0,1].
//
// Trabalha em um plano 2D frontal (ortho), então o mouse mapeia
// diretamente para o mundo: (mouseX-width/2, mouseY-height/2).
// ============================================================

let cena6 = {
  pontos: [],          // [{x,y}] em coords de mundo (origem no centro)
  arrastando: -1,      // índice do ponto sendo arrastado (-1 = nenhum)
  raioPonto: 12,       // raio dos handles (desenho e hit-test)
  mostrarCasteljau: true,
  tAtual: 0,           // t corrente da animação de De Casteljau
};

function setupCena6() {
  cena6.pontos = [
    { x: -260, y: 120 },
    { x: -90, y: -150 },
    { x: 110, y: 150 },
    { x: 280, y: -110 },
  ];
  cena6.arrastando = -1;
}

// ============================================================
// AVALIAÇÃO DA CURVA (implementada à mão)
// ============================================================

// Bézier cúbica via base de Bernstein.
function bezierCubica(p0, p1, p2, p3, t) {
  let u = 1 - t;
  let b0 = u * u * u;
  let b1 = 3 * u * u * t;
  let b2 = 3 * u * t * t;
  let b3 = t * t * t;
  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
  };
}

// De Casteljau: devolve TODOS os níveis de interpolação para um dado t.
// levels[0] = pontos de controle; levels[último] = [B(t)].
function deCasteljauLevels(pts, t) {
  let levels = [pts.map((p) => ({ x: p.x, y: p.y }))];
  let cur = levels[0];
  while (cur.length > 1) {
    let next = [];
    for (let i = 0; i < cur.length - 1; i++) {
      next.push({
        x: lerp(cur[i].x, cur[i + 1].x, t),
        y: lerp(cur[i].y, cur[i + 1].y, t),
      });
    }
    levels.push(next);
    cur = next;
  }
  return levels;
}

// ============================================================
// DRAW
// ============================================================
function drawCena6() {
  ortho();
  noLights();

  // --- Grid de fundo (referência) ---
  push();
  stroke(38, 42, 58);
  strokeWeight(1);
  let step = 80;
  for (let x = -Math.ceil(width / 2 / step) * step; x <= width / 2; x += step) {
    line(x, -height / 2, x, height / 2);
  }
  for (let y = -Math.ceil(height / 2 / step) * step; y <= height / 2; y += step) {
    line(-width / 2, y, width / 2, y);
  }
  pop();

  let P = cena6.pontos;

  // --- Polígono de controle ---
  push();
  stroke(120, 124, 170, 200);
  strokeWeight(1.5);
  noFill();
  beginShape();
  for (let p of P) vertex(p.x, p.y, 0);
  endShape();
  pop();

  // --- Curva de Bézier (Bernstein) ---
  push();
  stroke(110, 190, 255);
  strokeWeight(4);
  noFill();
  beginShape();
  let n = 64;
  for (let i = 0; i <= n; i++) {
    let b = bezierCubica(P[0], P[1], P[2], P[3], i / n);
    vertex(b.x, b.y, 0);
  }
  endShape();
  pop();

  // --- Construção de De Casteljau (animada) ---
  if (cena6.mostrarCasteljau) {
    let t = 0.5 + 0.5 * Math.sin(millis() * 0.00055);
    cena6.tAtual = t;
    let levels = deCasteljauLevels(P, t);
    let cores = [null, [120, 230, 160], [255, 200, 90]]; // níveis 1 e 2

    for (let lv = 1; lv < levels.length - 1; lv++) {
      let pts = levels[lv];
      let c = cores[lv];
      push();
      stroke(c[0], c[1], c[2], 210);
      strokeWeight(1.5);
      noFill();
      beginShape();
      for (let p of pts) vertex(p.x, p.y, 0);
      endShape();
      pop();
      noStroke();
      fill(c[0], c[1], c[2]);
      for (let p of pts) circle(p.x, p.y, 8);
    }

    // ponto B(t) sobre a curva
    let bt = levels[levels.length - 1][0];
    noStroke();
    fill(255, 255, 255, 60);
    circle(bt.x, bt.y, 24);
    fill(255, 90, 160);
    circle(bt.x, bt.y, 13);
  }

  // --- Handles (pontos de controle) ---
  for (let i = 0; i < P.length; i++) {
    let p = P[i];
    let arrast = (i === cena6.arrastando);
    noStroke();
    fill(arrast ? color(255, 220, 80) : color(255, 110, 110));
    circle(p.x, p.y, cena6.raioPonto * 2);
    noFill();
    stroke(255, 255, 255, 150);
    strokeWeight(1.5);
    circle(p.x, p.y, cena6.raioPonto * 2 + 7);
  }
}

function drawCena6Pick() {
  // Sem picking: a seleção de pontos usa hit-test 2D em mousePressedCena6.
}

// ============================================================
// INTERAÇÃO (arrastar pontos de controle)
// ============================================================
function mousePressedCena6() {
  let wx = mouseX - width / 2;
  let wy = mouseY - height / 2;
  cena6.arrastando = -1;
  for (let i = 0; i < cena6.pontos.length; i++) {
    if (dist(wx, wy, cena6.pontos[i].x, cena6.pontos[i].y) <= cena6.raioPonto + 8) {
      cena6.arrastando = i;
      break;
    }
  }
}

function mouseDraggedCena6() {
  if (cena6.arrastando >= 0) {
    cena6.pontos[cena6.arrastando].x = mouseX - width / 2;
    cena6.pontos[cena6.arrastando].y = mouseY - height / 2;
  }
}

function mouseReleasedCena6() {
  cena6.arrastando = -1;
}

// ============================================================
// HUD
// ============================================================
function getHUDCena6() {
  let lines = [];
  lines.push("CENA 6: Curvas de Bézier");
  lines.push("");
  lines.push("Pontos de controle: 4 (curva cúbica)");
  lines.push("Avaliação: Bernstein + De Casteljau");
  lines.push("t (De Casteljau): " + cena6.tAtual.toFixed(2));
  lines.push("");
  lines.push("▶ Arraste os pontos vermelhos (P0…P3)");
  lines.push("▶ Curva azul = B(t), t∈[0,1] (base de Bernstein)");
  lines.push("▶ Verde/amarelo = construção de De Casteljau");
  lines.push("▶ [←/→]: navegar entre as cenas");
  return lines;
}
