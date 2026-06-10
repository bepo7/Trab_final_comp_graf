// ============================================================
// CENA 6: Curvas e Superfícies (Placeholder)
// Aguardando material da segunda parte do curso
// ============================================================

let cena6 = {
  particles: [],
  initialized: false,
};

function setupCena6() {
  // Criar partículas decorativas
  cena6.particles = [];
  for (let i = 0; i < 60; i++) {
    cena6.particles.push({
      x: random(-width / 2, width / 2),
      y: random(-height / 2, height / 2),
      z: random(-200, 200),
      size: random(2, 6),
      speed: random(0.002, 0.008),
      phase: random(TWO_PI),
      color: [
        random(100, 200),
        random(100, 200),
        random(150, 255)
      ]
    });
  }
  cena6.initialized = true;
}

function drawCena6() {
  perspective(PI / 3, width / height, 0.1, 2000);

  // Sem iluminação forte — ambiente escuro
  ambientLight(30, 30, 50);

  // Partículas flutuantes
  if (cena6.initialized) {
    let t = millis() / 1000.0;
    noStroke();

    for (let p of cena6.particles) {
      push();
      let px = p.x + sin(t * p.speed * 100 + p.phase) * 30;
      let py = p.y + cos(t * p.speed * 80 + p.phase * 1.3) * 20;
      let pz = p.z + sin(t * p.speed * 60 + p.phase * 0.7) * 40;

      translate(px, py, pz);
      let alpha = 0.3 + 0.3 * sin(t * 2 + p.phase);
      emissiveMaterial(
        p.color[0] * alpha,
        p.color[1] * alpha,
        p.color[2] * alpha
      );
      sphere(p.size);
      pop();
    }
  }

  // Linhas decorativas (sugerindo curvas futuras)
  push();
  stroke(80, 80, 120);
  strokeWeight(1);
  noFill();
  let t = millis() / 1000.0;

  // Curva sinusoidal 3D (preview visual)
  beginShape();
  for (let i = 0; i <= 100; i++) {
    let tt = map(i, 0, 100, -PI, PI);
    let x = tt * 80;
    let y = sin(tt * 2 + t * 0.5) * 40;
    let z = cos(tt * 3 + t * 0.3) * 30;
    vertex(x, y, z);
  }
  endShape();
  pop();
}

function drawCena6Pick() {
  // Nenhum objeto clicável nesta cena
}

function clickCena6(pickedID) {
  // Nenhuma interação
}

function getHUDCena6() {
  let lines = [];
  lines.push("CENA 6: Curvas e Superfícies");
  lines.push("");
  lines.push("⏳ Aguardando Geometria...");
  lines.push("");
  lines.push("Esta cena será implementada com o");
  lines.push("material da segunda parte do curso.");
  lines.push("");
  lines.push("Futuramente:");
  lines.push("  • Curvas de Bézier");
  lines.push("  • B-Splines");
  lines.push("  • Splines Cúbicas de Hermite");
  lines.push("  • Superfícies de Revolução");
  lines.push("  • Malhas poligonais de controle");
  return lines;
}
