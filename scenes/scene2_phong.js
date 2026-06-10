// ============================================================
// CENA 2: O Modelo de Phong e Materiais
// Conceitos: Luz Ambiente, Difusa Lambertiana, Especular, Emissivo
// ============================================================

let cena2 = {
  difusaAtiva: false,       // Luz direcional + reflexão difusa
  especularAtiva: false,    // Luz pontual + material especular
  shininessLevel: 0,        // Índice no array de shininess
  shininessValues: [2, 8, 32, 128, 512, 1024, 2048, 0], // 0 = desligado
  pontualAngulo: 0,         // Ângulo orbital da luz pontual
  boxColorBlue: false,      // Toggle cor da caixa
  portalPulse: 0,
};

function setupCena2() {
  // Nada especial para inicializar
}

function drawCena2() {
  perspective(PI / 3, width / height, 0.1, 2000);

  // --- Iluminação ---

  // Sempre: luz ambiente fraca
  ambientLight(60, 60, 80);

  // Se difusa ativa: luz direcional
  if (cena2.difusaAtiva) {
    directionalLight(220, 210, 200, -0.5, -1, -0.8);
  }

  // Se especular ativa: luz pontual orbitando
  if (cena2.especularAtiva) {
    let shin = cena2.shininessValues[cena2.shininessLevel];
    if (shin > 0) { // Apenas desenha luz e orbe se não estiver "zerado"
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
  }

  // =========================================
  // OBJETO 1: ESFERA (Reflexão Difusa)
  // =========================================
  push();
  translate(-140, 0, 0);
  if (cena2.difusaAtiva) {
    // Material difuso: reage à luz direcional
    fill(100, 150, 220);
    specularMaterial(100, 150, 220);
    shininess(1); // Sem brilho especular notável
  } else {
    // Apenas ambiente: aparência "chapada"
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

  if (cena2.especularAtiva) {
    let shin = cena2.shininessValues[cena2.shininessLevel];
    if (shin > 0) {
      specularMaterial(220, 180, 100);
      shininess(shin);
    } else {
      // Quando shininess é 0, comporta-se apenas como material difuso ou ambiente
      if (cena2.difusaAtiva) {
        fill(220, 180, 100);
        specularMaterial(220, 180, 100);
        shininess(1);
      } else {
        ambientMaterial(220, 180, 100);
      }
    }
  } else if (cena2.difusaAtiva) {
    fill(220, 180, 100);
    specularMaterial(220, 180, 100);
    shininess(1);
  } else {
    ambientMaterial(220, 180, 100);
  }
  noStroke();
  torus(50, 20, 24, 16);
  pop();

  // =========================================
  // OBJETO 3: CAIXA EMISSIVA (Toggle Cor)
  // =========================================
  push();
  translate(140, 0, 0);

  rotateY(frameCount * 0.01);
  rotateX(frameCount * 0.007);

  // Material emissivo: brilha independente de iluminação
  if (cena2.boxColorBlue) {
    emissiveMaterial(50, 150, 255);
    specularMaterial(60, 160, 255);
  } else {
    emissiveMaterial(255, 100, 50);
    specularMaterial(255, 120, 60);
  }
  shininess(40);

  noStroke();
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
    cena2.boxColorBlue = !cena2.boxColorBlue;
  } else if (pickedID === 10) {
    iniciarTransicao(3);
  }
}

function getHUDCena2() {
  let lines = [];
  lines.push("CENA 2: Modelo de Phong");
  lines.push("");

  let componentes = ["Ambiente"];
  if (cena2.difusaAtiva) componentes.push("Difusa (Lambert)");
  if (cena2.especularAtiva) {
    let shin = cena2.shininessValues[cena2.shininessLevel];
    if (shin === 0) {
      componentes.push("Especular (Orbe Desligado)");
    } else {
      componentes.push("Especular (shininess: " + shin + ")");
    }
  }
  lines.push("Iluminação: " + componentes.join(" + "));
  lines.push("");
  lines.push("▶ Clique na esfera: luz direcional (difusa)");
  lines.push("▶ Clique no torus: luz pontual + especular");
  lines.push("   (cliques repetidos alteram shininess)");
  lines.push("▶ Clique na caixa: alternar cor emissiva");
  lines.push("▶ Clique na seta verde (dir.): portal →");
  return lines;
}
