// ============================================================
// CENA 1: Fundamentos, Geometria e Câmera
// Conceitos: Transformações Afins, Arcball, Projeção Ortográfica/Perspectiva
// ============================================================

// Estado da Cena 1
let cena1 = {
  cuboAnimando: false,       // Cubo em animação de transformações
  perspectiva: false,        // Projeção: false=ortho, true=perspective
  arcballAtivo: false,       // Rotação por Arcball ativa
  cuboAngulo: 0,             // Ângulo de rotação do cubo
  cuboTranslacao: 0,         // Fase da translação orbital

  // Arcball state
  arcRotMatrix: null,        // Matriz de rotação acumulada
  arcLastVec: null,          // Último vetor projetado na esfera
  arcDragging: false,        // Está arrastando?

  // Wireframe
  wireframeAtivo: false,

  // Portal
  portalPulse: 0,
};

function setupCena1() {
  // Inicializar a matriz de rotação como identidade (4x4 array flat)
  cena1.arcRotMatrix = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

/**
 * Projeta coordenadas 2D do mouse numa esfera unitária 3D (Arcball).
 * Se o ponto está fora da esfera, projeta no plano tangente.
 */
function arcballProject(mx, my) {
  let x = (mx - width / 2) / (width / 2);
  let y = -(my - height / 2) / (height / 2);
  let r2 = x * x + y * y;

  let z;
  if (r2 <= 1.0) {
    z = Math.sqrt(1.0 - r2);
  } else {
    let r = Math.sqrt(r2);
    x /= r;
    y /= r;
    z = 0;
  }

  return createVector(x, y, z);
}

/**
 * Multiplica duas matrizes 4x4 representadas como arrays flat de 16 elementos.
 */
function mat4Multiply(a, b) {
  let r = new Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      r[i * 4 + j] = 0;
      for (let k = 0; k < 4; k++) {
        r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
      }
    }
  }
  return r;
}

/**
 * Constrói uma matriz de rotação a partir de um eixo e ângulo (Rodrigues).
 */
function mat4FromAxisAngle(axis, angle) {
  let c = Math.cos(angle);
  let s = Math.sin(angle);
  let t = 1 - c;
  let x = axis.x, y = axis.y, z = axis.z;

  return [
    t*x*x + c,   t*x*y - s*z, t*x*z + s*y, 0,
    t*x*y + s*z, t*y*y + c,   t*y*z - s*x, 0,
    t*x*z - s*y, t*y*z + s*x, t*z*z + c,   0,
    0,           0,           0,           1
  ];
}

function drawCena1() {
  // --- Projeção ---
  if (cena1.perspectiva) {
    perspective(PI / 3, width / height, 0.1, 2000);
  } else {
    let aspect = width / height;
    let sz = 250;
    ortho(-sz * aspect, sz * aspect, -sz, sz, -2000, 2000);
  }

  // --- Iluminação básica ---
  ambientLight(60);
  directionalLight(200, 200, 200, 0.5, -1, -0.5);

  // --- Aplicar rotação do Arcball ---
  if (cena1.arcballAtivo) {
    applyMatrix(
      cena1.arcRotMatrix[0], cena1.arcRotMatrix[1], cena1.arcRotMatrix[2], cena1.arcRotMatrix[3],
      cena1.arcRotMatrix[4], cena1.arcRotMatrix[5], cena1.arcRotMatrix[6], cena1.arcRotMatrix[7],
      cena1.arcRotMatrix[8], cena1.arcRotMatrix[9], cena1.arcRotMatrix[10], cena1.arcRotMatrix[11],
      cena1.arcRotMatrix[12], cena1.arcRotMatrix[13], cena1.arcRotMatrix[14], cena1.arcRotMatrix[15]
    );
  }

  // =========================================
  // OBJETO 1: CUBO (Transformações Afins)
  // =========================================
  push();
  if (cena1.cuboAnimando) {
    cena1.cuboAngulo += 0.02;
    cena1.cuboTranslacao += 0.015;

    // Composição de transformações: TRS (Translate, Rotate, Scale)
    // A ordem importa! Primeiro translate (orbital), depois rotação local.
    let orbitRadius = 80;
    translate(
      Math.cos(cena1.cuboTranslacao) * orbitRadius,
      Math.sin(cena1.cuboTranslacao * 0.7) * 30,
      Math.sin(cena1.cuboTranslacao) * orbitRadius
    );

    // Composição de rotações de Euler. Em p5 (WebGL) cada rotateX/Z/Y
    // PÓS-multiplica a matriz de modelview corrente, logo a matriz final
    // é M = Rx · Rz · Ry e o cubo é transformado por M·v. A ORDEM importa
    // (rotações não comutam): trocar a ordem muda o resultado visual.
    rotateX(cena1.cuboAngulo * 0.7);
    rotateZ(cena1.cuboAngulo * 1.3);
    rotateY(cena1.cuboAngulo);

    normalMaterial();
  } else {
    translate(-120, 0, 0);
    ambientMaterial(80, 160, 255);
  }
  if (cena1.wireframeAtivo) {
    stroke(255);
    noFill();
  } else {
    noStroke();
  }
  box(60);
  pop();

  // =========================================
  // OBJETO 2: CONE (Arcball / Projeção)
  // =========================================
  push();
  translate(0, 0, 0);
  if (cena1.perspectiva) {
    specularMaterial(255, 180, 60);
    shininess(30);
  } else {
    ambientMaterial(255, 180, 60);
  }
  rotateX(PI);
  if (cena1.wireframeAtivo) {
    stroke(255);
    noFill();
  } else {
    noStroke();
  }
  cone(40, 80, 16);
  pop();

  // =========================================
  // OBJETO 3: ESFERA (Agora: Toggle Wireframe)
  // =========================================
  push();
  translate(120, 0, 0);

  // Efeito visual
  ambientMaterial(120, 50, 255);
  specularMaterial(200, 100, 255);
  shininess(30);

  if (cena1.wireframeAtivo) {
    stroke(255);
    noFill();
  } else {
    noStroke();
  }
  sphere(35, 24, 24);
  pop();

  // =========================================
  // OBJETO PORTAL: SETA (ID 10)
  // =========================================
  push();
  translate(180, -80, 0); // Canto superior/direito
  cena1.portalPulse += 0.05;
  let pulseScale = 1.0 + 0.1 * sin(cena1.portalPulse);
  scale(pulseScale);
  
  rotateZ(-PI/2); // Apontar para direita
  rotateX(frameCount * 0.02);

  emissiveMaterial(50, 255, 150);
  specularMaterial(200, 255, 200);
  noStroke();

  push(); translate(0, -10, 0); cylinder(5, 20); pop(); // corpo
  push(); translate(0, 10, 0); cone(12, 20); pop();    // ponta
  pop();

  // --- Grid do chão (referência visual) ---
  push();
  translate(0, 80, 0);
  rotateX(PI / 2);
  stroke(60);
  noFill();
  for (let i = -5; i <= 5; i++) {
    line(i * 40, -200, i * 40, 200);
    line(-200, i * 40, 200, i * 40);
  }
  noStroke();
  pop();
}

/**
 * Renderiza objetos clicáveis no buffer de picking.
 */
function drawCena1Pick() {
  if (cena1.perspectiva) {
    pickBuffer.perspective(PI / 3, width / height, 0.1, 2000);
  } else {
    let aspect = width / height;
    let sz = 250;
    pickBuffer.ortho(-sz * aspect, sz * aspect, -sz, sz, -2000, 2000);
  }

  if (cena1.arcballAtivo) {
    pickBuffer.applyMatrix(
      cena1.arcRotMatrix[0], cena1.arcRotMatrix[1], cena1.arcRotMatrix[2], cena1.arcRotMatrix[3],
      cena1.arcRotMatrix[4], cena1.arcRotMatrix[5], cena1.arcRotMatrix[6], cena1.arcRotMatrix[7],
      cena1.arcRotMatrix[8], cena1.arcRotMatrix[9], cena1.arcRotMatrix[10], cena1.arcRotMatrix[11],
      cena1.arcRotMatrix[12], cena1.arcRotMatrix[13], cena1.arcRotMatrix[14], cena1.arcRotMatrix[15]
    );
  }

  // Cubo (ID 1)
  pickBuffer.push();
  if (cena1.cuboAnimando) {
    let orbitRadius = 80;
    pickBuffer.translate(
      Math.cos(cena1.cuboTranslacao) * orbitRadius,
      Math.sin(cena1.cuboTranslacao * 0.7) * 30,
      Math.sin(cena1.cuboTranslacao) * orbitRadius
    );
    pickBuffer.rotateX(cena1.cuboAngulo * 0.7);
    pickBuffer.rotateZ(cena1.cuboAngulo * 1.3);
    pickBuffer.rotateY(cena1.cuboAngulo);
  } else {
    pickBuffer.translate(-120, 0, 0);
  }
  setPickID(1);
  pickBuffer.box(60);
  pickBuffer.pop();

  // Cone (ID 2)
  pickBuffer.push();
  pickBuffer.translate(0, 0, 0);
  pickBuffer.rotateX(PI);
  setPickID(2);
  pickBuffer.cone(40, 80, 16);
  pickBuffer.pop();

  // Esfera (ID 3)
  pickBuffer.push();
  pickBuffer.translate(120, 0, 0);
  setPickID(3);
  pickBuffer.sphere(35, 24, 24);
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

function clickCena1(pickedID) {
  if (pickedID === 1) {
    // Toggle animação do cubo
    cena1.cuboAnimando = !cena1.cuboAnimando;
  } else if (pickedID === 2) {
    // Toggle perspectiva + ativar Arcball
    cena1.perspectiva = !cena1.perspectiva;
    cena1.arcballAtivo = cena1.perspectiva;
  } else if (pickedID === 3) {
    // Toggle Wireframe
    cena1.wireframeAtivo = !cena1.wireframeAtivo;
  } else if (pickedID === 10) {
    // Portal → Cena 2
    iniciarTransicao(2);
  }
}

function mouseDraggedCena1() {
  if (!cena1.arcballAtivo) return;

  let curVec = arcballProject(mouseX, mouseY);

  if (cena1.arcLastVec) {
    // Calcular eixo e ângulo de rotação
    let axis = p5.Vector.cross(cena1.arcLastVec, curVec);
    // Limiar para descartar micro-movimentos (evita jitter numérico).
    if (axis.mag() > 0.001) {
      axis.normalize();
      let angle = p5.Vector.angleBetween(cena1.arcLastVec, curVec) * 2;

      // Construir matriz de rotação incremental
      let rotMat = mat4FromAxisAngle(axis, angle);

      // Acumular: newRot = incremental * current
      cena1.arcRotMatrix = mat4Multiply(rotMat, cena1.arcRotMatrix);
    }
  }

  cena1.arcLastVec = curVec;
}

function mousePressedCena1() {
  if (cena1.arcballAtivo) {
    cena1.arcLastVec = arcballProject(mouseX, mouseY);
    cena1.arcDragging = true;
  }
}

function mouseReleasedCena1() {
  cena1.arcDragging = false;
  cena1.arcLastVec = null;
}

function getHUDCena1() {
  let lines = [];
  lines.push("CENA 1: Geometria e Câmera");
  lines.push("");
  lines.push("Projeção: " + (cena1.perspectiva ? "Perspectiva" : "Ortográfica"));
  lines.push("Cubo: " + (cena1.cuboAnimando ? "Animando (TRS)" : "Estático — clique!"));
  lines.push("Arcball: " + (cena1.arcballAtivo ? "Ativo (arraste o mouse)" : "Inativo"));
  lines.push("Aparência: " + (cena1.wireframeAtivo ? "Wireframe" : "Sólido"));
  lines.push("");
  lines.push("▶ Clique no cubo: transformações afins");
  lines.push("▶ Clique no cone: perspectiva + arcball");
  lines.push("▶ Clique na esfera roxa: wireframe");
  lines.push("▶ Clique na seta verde (dir.): portal →");
  return lines;
}
