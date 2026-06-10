// ============================================================
// CENA 3: Texturização e Shaders Customizados
// Conceitos: Mapeamento UV, Filtros de Textura (LINEAR/NEAREST),
//            Normal Mapping com construção da matriz TBN
// ============================================================

let cena3 = {
  filtroLinear: true,         // true=LINEAR, false=NEAREST
  bumpAtivo: false,           // Shader de Normal Mapping ativo
  checkerTex: null,           // Textura checkerboard gerada
  normalMapTex: null,         // Normal Map gerado proceduralmente
  normalMapShader: null,      // Shader de normal mapping carregado
  portalPulse: 0,
  esferaRot: 0,
  cuboAtivo: true,            // Toggle animação do cubo
};

function setupCena3() {
  // Gerar textura checkerboard procedural (resolução baixa para mostrar filtro)
  cena3.checkerTex = createGraphics(16, 16);
  let g = cena3.checkerTex;
  let tileSize = 8;
  for (let y = 0; y < 16; y += tileSize) {
    for (let x = 0; x < 16; x += tileSize) {
      let isWhite = ((x / tileSize + y / tileSize) % 2 === 0);
      if (isWhite) {
        g.fill(220, 215, 200);
      } else {
        g.fill(60, 55, 70);
      }
      g.noStroke();
      g.rect(x, y, tileSize, tileSize);
    }
  }

  // Gerar Normal Map procedural (512x512)
  // Simula uma superfície de pedra/tijolo com perturbações
  cena3.normalMapTex = createGraphics(512, 512);
  let nm = cena3.normalMapTex;
  nm.loadPixels();
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      // Usar ruído Perlin para gerar perturbação
      let scale = 0.02;
      let nx = noise(x * scale, y * scale, 0.0) * 2 - 1;
      let ny = noise(x * scale, y * scale, 1.0) * 2 - 1;
      let nz = 1.0;

      // Adicionar padrão de tijolos
      let brickX = (x % 64) < 3 ? 0.8 : 0.0;
      let brickY = (y % 32) < 3 ? 0.8 : 0.0;
      // Offset alternado para padrão de tijolo
      let row = Math.floor(y / 32);
      let offsetX = (row % 2 === 0) ? 0 : 32;
      let brickX2 = ((x + offsetX) % 64) < 3 ? 0.6 : 0.0;

      nx += brickX + brickX2;
      ny += brickY;

      // Normalizar
      let len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;

      // Converter de [-1,1] para [0,255]
      let r = Math.floor((nx * 0.5 + 0.5) * 255);
      let g2 = Math.floor((ny * 0.5 + 0.5) * 255);
      let b = Math.floor((nz * 0.5 + 0.5) * 255);

      let idx = 4 * (y * 512 + x);
      nm.pixels[idx] = r;
      nm.pixels[idx + 1] = g2;
      nm.pixels[idx + 2] = b;
      nm.pixels[idx + 3] = 255;
    }
  }
  nm.updatePixels();
}

function drawCena3() {
  perspective(PI / 3, width / height, 0.1, 2000);

  ambientLight(80, 80, 100);
  directionalLight(200, 200, 200, 0.5, -1, -0.5);
  pointLight(255, 220, 180, 150, -100, 100);

  // =========================================
  // OBJETO 1: PLANO com textura checkerboard
  // =========================================
  push();
  translate(0, 60, -50);
  rotateX(-PI / 6);

  // Aplicar filtro de textura via GL direto
  let glCtx = drawingContext;
  let texObj = cena3.checkerTex;

  noStroke();
  texture(texObj);

  // Configurar filtro da textura
  // Em p5.js WebGL, a forma mais robusta é obter a textura interna e usar setInterpolation
  let p5tex = window._renderer.getTexture(texObj);
  if (p5tex) {
    if (!cena3.filtroLinear) {
      p5tex.setInterpolation(window.NEAREST, window.NEAREST);
    } else {
      p5tex.setInterpolation(window.LINEAR, window.LINEAR);
    }
  }

  plane(300, 300);
  pop();

  // =========================================
  // OBJETO 2: ESFERA com Normal Mapping
  // =========================================
  push();
  translate(-80, -30, 50);
  cena3.esferaRot += 0.005;
  rotateY(cena3.esferaRot);

  if (cena3.bumpAtivo && cena3.normalMapShader) {
    // Usar shader customizado
    shader(cena3.normalMapShader);
    cena3.normalMapShader.setUniform('uNormalMap', cena3.normalMapTex);
    cena3.normalMapShader.setUniform('uLightPos', [150.0, -100.0, 100.0]);
    cena3.normalMapShader.setUniform('uLightColor', [1.0, 0.95, 0.85]);
    cena3.normalMapShader.setUniform('uAmbientColor', [0.3, 0.3, 0.4]);
    cena3.normalMapShader.setUniform('uBumpStrength', 1.5);
    cena3.normalMapShader.setUniform('uUseBump', true);
  } else {
    // Sem shader: textura simples do normal map (só pra ver as cores)
    noStroke();
    texture(cena3.normalMapTex);
  }

  sphere(60, 32, 32);

  // Resetar shader
  if (cena3.bumpAtivo && cena3.normalMapShader) {
    resetShader();
  }
  pop();

  // =========================================
  // OBJETO 3: CUBO (Toggle Animação)
  // =========================================
  push();
  translate(140, -20, 30);
  
  let pulse = 1.0;
  if (cena3.cuboAtivo) {
    cena3.portalPulse += 0.03;
    pulse = 1.0 + 0.08 * sin(cena3.portalPulse);
    rotateY(frameCount * 0.012);
    rotateX(frameCount * 0.008);
  }

  emissiveMaterial(50, 200, 120);
  specularMaterial(80, 220, 150);
  shininess(40);

  noStroke();
  scale(pulse);
  box(45);
  pop();

  // =========================================
  // OBJETO PORTAL: SETA (ID 10)
  // =========================================
  push();
  translate(180, -80, 0); // Canto superior/direito
  let pulseScale = 1.0 + 0.1 * sin(frameCount * 0.05);
  scale(pulseScale);
  
  rotateZ(-PI/2); // Apontar para direita
  rotateX(frameCount * 0.02);

  emissiveMaterial(50, 255, 150);
  specularMaterial(200, 255, 200);
  noStroke();

  push(); translate(0, -10, 0); cylinder(5, 20); pop(); // corpo
  push(); translate(0, 10, 0); cone(12, 20); pop();    // ponta
  pop();
}

function drawCena3Pick() {
  pickBuffer.perspective(PI / 3, width / height, 0.1, 2000);

  // Plano (ID 1)
  pickBuffer.push();
  pickBuffer.translate(0, 60, -50);
  pickBuffer.rotateX(-PI / 6);
  setPickID(1);
  pickBuffer.plane(300, 300);
  pickBuffer.pop();

  // Esfera (ID 2)
  pickBuffer.push();
  pickBuffer.translate(-80, -30, 50);
  pickBuffer.rotateY(cena3.esferaRot);
  setPickID(2);
  pickBuffer.sphere(60, 32, 32);
  pickBuffer.pop();

  // Cubo (ID 3)
  pickBuffer.push();
  pickBuffer.translate(140, -20, 30);
  if (cena3.cuboAtivo) {
    pickBuffer.rotateY(frameCount * 0.012);
    pickBuffer.rotateX(frameCount * 0.008);
  }
  setPickID(3);
  pickBuffer.box(45);
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

function clickCena3(pickedID) {
  if (pickedID === 1) {
    // Toggle filtro LINEAR/NEAREST
    cena3.filtroLinear = !cena3.filtroLinear;
  } else if (pickedID === 2) {
    // Toggle Normal Mapping
    cena3.bumpAtivo = !cena3.bumpAtivo;
  } else if (pickedID === 3) {
    cena3.cuboAtivo = !cena3.cuboAtivo;
  } else if (pickedID === 10) {
    iniciarTransicao(4);
  }
}

function getHUDCena3() {
  let lines = [];
  lines.push("CENA 3: Texturização e Shaders");
  lines.push("");
  lines.push("Filtro de textura: " + (cena3.filtroLinear ? "LINEAR (suave)" : "NEAREST (pixelado)"));
  lines.push("Normal Mapping: " + (cena3.bumpAtivo ? "ATIVO (shader TBN)" : "Desativado"));
  lines.push("");
  lines.push("▶ Clique no plano: alternar filtro LINEAR/NEAREST");
  lines.push("▶ Clique na esfera: ativar/desativar Normal Map");
  lines.push("▶ Clique no cubo verde: alternar animação");
  lines.push("▶ Clique na seta verde (dir.): portal →");
  return lines;
}
