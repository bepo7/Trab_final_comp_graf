// ============================================================
// CENA 2: O Modelo de Phong e Materiais
// Conceitos: Luz Ambiente, Difusa Lambertiana, Especular, Emissivo
// Cada objeto controla uma componente: esfera = difusa, torus =
// especular, cubo = ambiente/emissivo (interruptor da sala e lâmpada).
// ============================================================

let cena2 = {
  difusaAtiva: false,       // Luz direcional + reflexão difusa
  especularAtiva: false,    // Luz pontual + material especular
  shininessLevel: 0,        // Índice no array de shininess
  shininessValues: [2, 8, 32, 128, 512, 1024, 2048, 0], // 0 = especular desligado
  pontualAngulo: 0,         // Ângulo orbital da luz pontual
  cuboModo: 0,              // 0=ambiente acesa, 1=ambiente apagada, 2=cubo-lâmpada
  portalPulse: 0,
};

function setupCena2() {
  // Nada especial para inicializar
}

function drawCena2() {
  perspective(PI / 3, width / height, 0.1, 2000);

  // --- Iluminação ---

  // Luz ambiente fraca (baixa de propósito, para dramatizar o salto de
  // luminância quando a difusa é ligada). O CUBO é o interruptor dela:
  // nos modos 1 e 2 a componente ambiente some da equação de Phong e os
  // objetos sem luz direta ficam pretos.
  if (cena2.cuboModo === 0) {
    ambientLight(35, 35, 50);
  }

  // Se difusa ativa: luz direcional
  if (cena2.difusaAtiva) {
    directionalLight(220, 210, 200, -0.5, -1, -0.8);
  }

  // Especular: valor atual de shininess. O índice 0 é o estado "desligado"
  // (sem brilho especular e SEM o orbe da luz pontual).
  let shin = cena2.shininessValues[cena2.shininessLevel];
  let especularOn = cena2.especularAtiva && shin > 0;

  // Luz pontual orbitando — só quando o especular está realmente ligado.
  if (especularOn) {
    cena2.pontualAngulo += 0.02;
    let lx = cos(cena2.pontualAngulo) * 150;
    let ly = -60;
    let lz = sin(cena2.pontualAngulo) * 150;
    pointLight(255, 220, 180, lx, ly, lz);

    // Pequena esfera indicando posição da luz
    push();
    translate(lx, ly, lz);
    emissiveMaterial(255, 220, 150);
    noStroke();
    sphere(5);
    pop();
  }

  // Modo 2: o cubo vira uma LÂMPADA — material emissivo + pointLight REAL
  // na posição dele (140, 0, 0). Didática: no Phong, material emissivo
  // sozinho NÃO ilumina os vizinhos; quem ilumina é a luz pontual.
  let lampPulse = 0;
  if (cena2.cuboModo === 2) {
    lampPulse = 0.85 + 0.15 * sin(frameCount * 0.05);
    pointLight(255 * lampPulse, 190 * lampPulse, 110 * lampPulse, 140, 0, 0);
  }

  // =========================================
  // OBJETO 1: ESFERA (Reflexão Difusa)
  // =========================================
  push();
  translate(-140, 0, 0);
  if (cena2.difusaAtiva) {
    // Reflexão difusa (Lambert): specularMaterial define a cor e o
    // shininess baixo deixa o brilho especular desprezível.
    specularMaterial(100, 150, 220);
    shininess(1);
  } else {
    // Apenas ambiente: aparência "chapada". O fill define a refletância
    // DIFUSA (sem ele, ficaria branca sob a luz do cubo-lâmpada).
    fill(100, 150, 220);
    ambientMaterial(100, 150, 220);
  }
  noStroke();
  sphere(55, 32, 32);
  pop();

  // =========================================
  // OBJETO 2: TORUS (Especularidade)
  // =========================================
  push();
  translate(0, 0, 0);
  rotateX(PI / 4);
  rotateY(frameCount * 0.005);

  if (especularOn) {
    // Especular de Phong: o expoente (shininess) controla o tamanho do brilho.
    specularMaterial(220, 180, 100);
    shininess(shin);
  } else if (cena2.difusaAtiva) {
    // Especular desligado (shin=0) → cai para difuso, se houver luz direcional.
    specularMaterial(220, 180, 100);
    shininess(1);
  } else {
    fill(220, 180, 100); // refletância difusa (cor sob o cubo-lâmpada)
    ambientMaterial(220, 180, 100);
  }
  noStroke();
  torus(50, 20, 24, 16);
  pop();

  // =========================================
  // OBJETO 3: CUBO — interruptor da AMBIENTE / lâmpada EMISSIVA
  // =========================================
  push();
  translate(140, 0, 0);

  rotateY(frameCount * 0.01);
  rotateX(frameCount * 0.007);

  if (cena2.cuboModo === 2) {
    // Lâmpada: emissivo pulsante (brilha por si só, sem depender de luz).
    // A pointLight correspondente já foi declarada no bloco de luzes.
    emissiveMaterial(255 * lampPulse, 170 * lampPulse, 80 * lampPulse);
    noStroke();
  } else {
    // Material comum (ambiente + difusa + especular). No modo 1, sem a
    // luz ambiente, o cubo fica PRETO — o contorno sutil ajuda a achá-lo.
    fill(255, 140, 60);
    ambientMaterial(255, 140, 60);
    specularMaterial(255, 160, 80);
    shininess(40);
    if (cena2.cuboModo === 1) {
      stroke(70, 75, 100);
    } else {
      noStroke();
    }
  }
  box(50);
  pop();

  // =========================================
  // OBJETO PORTAL: SETA (ID 10)
  // =========================================
  push();
  translate(180, -80, 0); // Canto superior/direito
  cena2.portalPulse += 0.05;
  let pulseScale = 1.0 + 0.1 * sin(cena2.portalPulse);
  scale(pulseScale);
  
  rotateZ(-PI/2); // Apontar para direita
  rotateX(frameCount * 0.02);

  emissiveMaterial(50, 255, 150);
  specularMaterial(200, 255, 200);
  noStroke();

  push(); translate(0, -10, 0); cylinder(5, 20); pop(); // corpo
  push(); translate(0, 10, 0); cone(12, 20); pop();    // ponta
  pop();

  // --- Chão sutil ---
  push();
  translate(0, 100, 0);
  rotateX(PI / 2);
  fill(40, 40, 50); // refletância difusa (cor sob o cubo-lâmpada)
  ambientMaterial(40, 40, 50);
  noStroke();
  plane(600, 600);
  pop();
}

function drawCena2Pick() {
  pickBuffer.perspective(PI / 3, width / height, 0.1, 2000);

  // Esfera (ID 1)
  pickBuffer.push();
  pickBuffer.translate(-140, 0, 0);
  setPickID(1);
  pickBuffer.sphere(55, 32, 32);
  pickBuffer.pop();

  // Torus (ID 2)
  pickBuffer.push();
  pickBuffer.translate(0, 0, 0);
  pickBuffer.rotateX(PI / 4);
  pickBuffer.rotateY(frameCount * 0.005);
  setPickID(2);
  pickBuffer.torus(50, 20, 24, 16);
  pickBuffer.pop();

  // Caixa (ID 3)
  pickBuffer.push();
  pickBuffer.translate(140, 0, 0);
  pickBuffer.rotateY(frameCount * 0.01);
  pickBuffer.rotateX(frameCount * 0.007);
  setPickID(3);
  pickBuffer.box(50);
  pickBuffer.pop();

  // Portal Seta (ID 10)
  pickBuffer.push();
  pickBuffer.translate(180, -80, 0);
  pickBuffer.rotateZ(-PI/2);
  pickBuffer.rotateX(frameCount * 0.02);
  setPickID(10);
  pickBuffer.push(); pickBuffer.translate(0, -10, 0); pickBuffer.cylinder(5, 20); pickBuffer.pop();
  pickBuffer.push(); pickBuffer.translate(0, 10, 0); pickBuffer.cone(12, 20); pickBuffer.pop();
  pickBuffer.pop();
}

function clickCena2(pickedID) {
  if (pickedID === 1) {
    cena2.difusaAtiva = !cena2.difusaAtiva;
  } else if (pickedID === 2) {
    cena2.especularAtiva = true;
    // Ciclar shininess a cada clique
    cena2.shininessLevel = (cena2.shininessLevel + 1) % cena2.shininessValues.length;
  } else if (pickedID === 3) {
    // Cicla os 3 modos do cubo: ambiente acesa → apagada → lâmpada
    cena2.cuboModo = (cena2.cuboModo + 1) % 3;
  } else if (pickedID === 10) {
    iniciarTransicao(3);
  }
}

function getHUDCena2() {
  let lines = [];
  lines.push("CENA 2: Modelo de Phong");
  lines.push("");

  let shin = cena2.especularAtiva ? cena2.shininessValues[cena2.shininessLevel] : -1;
  let especularOn = cena2.especularAtiva && shin > 0;

  let componentes = [];
  if (cena2.cuboModo === 0) componentes.push("Ambiente");
  if (cena2.difusaAtiva) componentes.push("Difusa (Lambert)");
  if (especularOn) componentes.push("Especular");
  if (cena2.cuboModo === 2) componentes.push("Pontual (cubo-lâmpada)");
  lines.push("Iluminação: " + (componentes.length ? componentes.join(" + ") : "Nenhuma — tudo no escuro"));
  if (cena2.especularAtiva) {
    lines.push("Shininess atual: " + (shin === 0 ? "0 (especular desligado)" : shin));
  }

  let modosCubo = [
    "material comum (ambiente acesa)",
    "ambiente APAGADA — cubo comum fica preto",
    "LÂMPADA — emissivo + luz pontual real",
  ];
  lines.push("Cubo: " + modosCubo[cena2.cuboModo]);
  lines.push("");
  lines.push("▶ Clique na esfera: luz direcional (difusa)");
  lines.push("▶ Clique no torus: luz pontual + especular");
  lines.push("   (cliques repetidos alteram shininess)");
  lines.push("▶ Clique no cubo: ambiente → escuro → lâmpada");
  if (cena2.cuboModo === 1) {
    lines.push("   Sem ambiente, só sobra luz direta (difusa/especular)");
  } else if (cena2.cuboModo === 2) {
    lines.push("   Emissivo não ilumina vizinhos; a pointLight sim");
  }
  lines.push("▶ Clique na seta verde (dir.): portal →");
  return lines;
}
