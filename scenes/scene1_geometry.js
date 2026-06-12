// ============================================================
// CENA 1: Fundamentos, Geometria e Câmera
// Conceitos: Transformações Afins, Arcball, Projeção Ortográfica/Perspectiva
// ============================================================

// Estado da Cena 1
let cena1 = {
  // O cubo demonstra transformações afins num CICLO: cada clique avança
  // um modo — um conceito por vez, e o último compõe os três.
  cuboModo: 0,               // 0=Estático · 1=T · 2=R · 3=S · 4=TRS
  cuboFase: 0,               // tempo acumulado das animações do cubo
  cuboModos: ['Estático', 'Translação T', 'Rotação Rx·Rz·Ry', 'Escala S', 'Composição T·R·S'],
  perspectiva: false,        // Projeção: false=ortho, true=perspective
  arcballAtivo: false,       // Rotação por Arcball ativa

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

/**
 * Transformações do modo atual do cubo, como DADOS (posição, ângulos de
 * Euler e escala). Draw e picking aplicam os mesmos valores — assim o
 * hit-test fica sempre alinhado ao desenho, em qualquer modo.
 * Base do cubo: (-120, 0, 0); a órbita da Translação gira ao redor dela.
 */
function c1_transformCubo() {
  let m = cena1.cuboModo, f = cena1.cuboFase;
  let t = { x: -120, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };
  if (m === 1 || m === 4) {
    t.x = -120 + Math.cos(f) * 60;
    t.y = Math.sin(f * 2) * 18;
    t.z = Math.sin(f) * 60;
  }
  if (m === 2 || m === 4) { t.rx = f * 0.7; t.rz = f * 1.3; t.ry = f; }
  if (m === 3 || m === 4) t.s = 1 + 0.45 * Math.sin(f * 2);
  return t;
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
  // OBJETO 1: CUBO (Transformações Afins — ciclo T → R → S → TRS)
  // Cada clique avança um modo; o material é SEMPRE o mesmo azul — o
  // que muda é só a transformação, e os guias visuais explicam qual.
  // =========================================
  if (cena1.cuboModo !== 0) cena1.cuboFase += 0.02;
  let tc = c1_transformCubo();

  // Trilha da órbita (modos com Translação): a curva paramétrica
  // COMPLETA do translate, desenhada fraca — o caminho a percorrer.
  if (cena1.cuboModo === 1 || cena1.cuboModo === 4) {
    push();
    noFill();
    stroke(255, 220, 70, 80);
    strokeWeight(1.5);
    beginShape();
    for (let i = 0; i <= 64; i++) {
      let a = (i / 64) * TWO_PI;
      vertex(-120 + Math.cos(a) * 60, Math.sin(a * 2) * 18, Math.sin(a) * 60);
    }
    endShape(CLOSE);
    pop();
  }

  // Fantasma do tamanho original (modo Escala): referência fixa que o
  // cubo pulsante atravessa — escala É em relação a algo.
  if (cena1.cuboModo === 3) {
    push();
    translate(-120, 0, 0);
    stroke(255, 255, 255, 90);
    noFill();
    box(60);
    pop();
  }

  // Eixos do MUNDO em cinza no centro do cubo (modos com Rotação):
  // ficam fixos enquanto os eixos locais coloridos giram — o contraste
  // mostra que rotacionar é girar o referencial LOCAL do objeto.
  if (cena1.cuboModo === 2 || cena1.cuboModo === 4) {
    push();
    translate(tc.x, tc.y, tc.z);
    stroke(140, 140, 150, 110);
    strokeWeight(1.2);
    line(0, 0, 0, 70, 0, 0);
    line(0, 0, 0, 0, 70, 0);
    line(0, 0, 0, 0, 0, 70);
    pop();
  }

  // O cubo em si, com as transformações do modo atual (T depois R depois S)
  push();
  translate(tc.x, tc.y, tc.z);
  rotateX(tc.rx);
  rotateZ(tc.rz);
  rotateY(tc.ry);
  scale(tc.s);
  ambientMaterial(80, 160, 255);
  if (cena1.wireframeAtivo) {
    stroke(255);
    noFill();
  } else {
    noStroke();
  }
  box(60);
  // Eixos LOCAIS RGB: desenhados DEPOIS das rotações, giram junto com o
  // cubo (+Y do p5 aponta para baixo na tela).
  if (cena1.cuboModo === 2 || cena1.cuboModo === 4) {
    strokeWeight(2.5);
    stroke(255, 80, 80); line(0, 0, 0, 70, 0, 0);   // +X local
    stroke(80, 255, 120); line(0, 0, 0, 0, 70, 0);  // +Y local
    stroke(90, 160, 255); line(0, 0, 0, 0, 0, 70);  // +Z local
    strokeWeight(1);
    noStroke();
    fill(255, 80, 80); push(); translate(70, 0, 0); sphere(4); pop();
    fill(80, 255, 120); push(); translate(0, 70, 0); sphere(4); pop();
    fill(90, 160, 255); push(); translate(0, 0, 70); sphere(4); pop();
  }
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

  // Cubo (ID 1) — espelha as transforms do modo atual via c1_transformCubo
  pickBuffer.push();
  let tc = c1_transformCubo();
  pickBuffer.translate(tc.x, tc.y, tc.z);
  pickBuffer.rotateX(tc.rx);
  pickBuffer.rotateZ(tc.rz);
  pickBuffer.rotateY(tc.ry);
  pickBuffer.scale(tc.s);
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
    // Avança o ciclo de transformações do cubo: T → R → S → TRS
    cena1.cuboModo = (cena1.cuboModo + 1) % 5;
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
  lines.push("Cubo: " + cena1.cuboModos[cena1.cuboModo] +
    (cena1.cuboModo === 0 ? " — clique!" : ""));
  if (cena1.cuboModo === 4) {
    lines.push("   M = T(órbita) · Rx·Rz·Ry · S(pulso) — a ordem importa");
  }
  lines.push("Arcball: " + (cena1.arcballAtivo ? "Ativo (arraste o mouse)" : "Inativo"));
  lines.push("Aparência: " + (cena1.wireframeAtivo ? "Wireframe" : "Sólido"));
  lines.push("");
  lines.push("▶ Clique no cubo: próxima transformação (T → R → S → TRS)");
  lines.push("▶ Clique no cone: perspectiva + arcball");
  lines.push("▶ Clique na esfera roxa: wireframe");
  lines.push("▶ Clique na seta verde (dir.): portal →");
  return lines;
}
