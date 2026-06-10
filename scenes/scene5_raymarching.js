// ============================================================
// CENA 5: Ray Marching, SDFs e Reflexões
// Conceitos: Sphere Tracing, SDFs, Smooth Min, Reflexões,
//            Operações Procedurais, Environment Map
// ============================================================

let cena5 = {
  shader: null,              // Shader de ray marching
  smoothK: 0.0,              // Constante do smooth minimum
  smoothKValues: [0.0, 0.3, 0.8, 1.5],
  smoothKIndex: 0,
  reflectAtivo: false,       // Reflexão ativa
  portalPulse: 0,
};

function setupCena5() {
  // O shader é carregado no preload() global
}

function drawCena5() {
  // Resetar projeção para 2D (o shader faz tudo)
  ortho();
  noLights();

  if (cena5.shader) {
    shader(cena5.shader);
    cena5.shader.setUniform('uResolution', [width, height]);
    cena5.shader.setUniform('uTime', millis() / 1000.0);
    cena5.shader.setUniform('uSmoothK', cena5.smoothK);
    cena5.shader.setUniform('uReflect', cena5.reflectAtivo ? 1 : 0);
    cena5.shader.setUniform('uMouse', [mouseX / width, 1.0 - mouseY / height]);

    // Fullscreen quad
    noStroke();
    rect(-width / 2, -height / 2, width, height);

    resetShader();
  } else {
    // Fallback: mensagem de erro
    background(20);
    fill(255, 80, 80);
    textSize(20);
    textAlign(CENTER, CENTER);
    text("Erro: Shader de Ray Marching não carregou.", 0, 0);
  }

  // =========================================
  // OBJETO PORTAL: SETA (ID 10)
  // =========================================
  push();
  perspective(PI / 3, width / height, 0.1, 2000);
  // O rect do shader foi desenhado em Z=0 no ortho. 
  // Em perspective com camera default (Z=800), Z=200 ficará na frente.
  translate(250, -150, 400); 
  
  cena5.portalPulse += 0.05;
  let pulseScale = 1.0 + 0.1 * sin(cena5.portalPulse);
  scale(pulseScale);
  
  rotateZ(-PI/2); // Apontar para direita
  rotateX(frameCount * 0.02);

  ambientLight(150); // Shader tira luzes, então adiciono
  directionalLight(255, 255, 255, 0.5, 1, -1);
  emissiveMaterial(50, 255, 150);
  specularMaterial(200, 255, 200);
  shininess(80);
  noStroke();

  push(); translate(0, -10, 0); cylinder(5, 20); pop(); // corpo
  push(); translate(0, 10, 0); cone(12, 20); pop();    // ponta
  pop();
}

function drawCena5Pick() {
  // Na cena 5, detecção por posição do mouse na tela
  // Portal: centro da tela (SDF girando)
  // Smooth min: clique esquerdo em qualquer lugar
  // Reflexão: clique com tecla R pressionada

  pickBuffer.ortho();

  // O clique esquerdo na cena continua funcionando porque é pego em pickedID == 0
  // Portal Seta (ID 10)
  pickBuffer.push();
  pickBuffer.perspective(PI / 3, width / height, 0.1, 2000);
  pickBuffer.translate(250, -150, 400);
  pickBuffer.rotateZ(-PI/2);
  pickBuffer.rotateX(frameCount * 0.02);
  setPickID(10);
  pickBuffer.push(); pickBuffer.translate(0, -10, 0); pickBuffer.cylinder(5, 20); pickBuffer.pop();
  pickBuffer.push(); pickBuffer.translate(0, 10, 0); pickBuffer.cone(12, 20); pickBuffer.pop();
  pickBuffer.pop();
}

function clickCena5(pickedID) {
  if (pickedID === 10) {
    // Portal → Cena 6
    iniciarTransicao(6);
    return;
  }

  // Clique esquerdo (vazio ou shader): ciclar smooth minimum K
  cena5.smoothKIndex = (cena5.smoothKIndex + 1) % cena5.smoothKValues.length;
  cena5.smoothK = cena5.smoothKValues[cena5.smoothKIndex];
}

function keyPressedCena5() {
  // Tecla R: toggle reflexão
  if (key === 'r' || key === 'R') {
    cena5.reflectAtivo = !cena5.reflectAtivo;
  }
}

function getHUDCena5() {
  let lines = [];
  lines.push("CENA 5: Ray Marching & SDFs");
  lines.push("");
  lines.push("Smooth Min K: " + cena5.smoothK.toFixed(1) +
    (cena5.smoothK === 0 ? " (sharp)" : cena5.smoothK > 1.0 ? " (mercúrio)" : " (suave)"));
  lines.push("Reflexão: " + (cena5.reflectAtivo ? "ATIVA (2 bounces)" : "Desativada"));
  lines.push("");
  lines.push("▶ Clique no cenário: ciclar suavização (smin)");
  lines.push("▶ Tecla R: ativar/desativar reflexão");
  lines.push("▶ Clique na seta verde (dir.): portal →");
  return lines;
}
