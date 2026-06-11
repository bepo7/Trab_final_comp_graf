// ============================================================
// sketch.js — Controlador Principal (Máquina de Estados)
// Gerencia as 6 cenas, transições, HUD e Color Picking
// ============================================================

let cenaAtual = 1;
let cenaAnterior = 0;

// Transição
let transicao = {
  ativa: false,
  destino: 0,
  progresso: 0,
  fase: 'none',       // 'fadeOut', 'fadeIn', 'none'
  velocidade: 0.04,
};

// HUD
let hudVisible = true;

function preload() {
  // Carregar shaders de arquivos externos
  // loadShader em p5.js não lança exceção — usa callback de erro
  cena3.normalMapShader = loadShader(
    'shaders/normalmap.vert',
    'shaders/normalmap.frag',
    function () { console.log('Normal Map shader carregado com sucesso.'); },
    function (err) { console.warn('Aviso: Shader de Normal Map não carregou:', err); }
  );

  cena5.shader = loadShader(
    'shaders/raymarching.vert',
    'shaders/raymarching.frag',
    function () { console.log('Ray Marching shader carregado com sucesso.'); },
    function (err) { console.warn('Aviso: Shader de Ray Marching não carregou:', err); }
  );
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);

  // Inicializar Color Picker
  initPickBuffer(width, height);

  // Inicializar todas as cenas
  setupCena1();
  setupCena2();
  setupCena3();
  setupCena4();
  setupCena5();
  setupCena6();

  // Prevenir menu de contexto no clique direito
  document.oncontextmenu = function () { return false; };

  // NÃO usar textFont() pois não usamos text() no canvas WebGL
  // Todo HUD é via DOM HTML
}

function draw() {
  background(15, 15, 25);

  // Processar transição
  if (transicao.ativa) {
    processarTransicao();
  }

  // Desenhar a cena atual
  push();
  switch (cenaAtual) {
    case 1: drawCena1(); break;
    case 2: drawCena2(); break;
    case 3: drawCena3(); break;
    case 4: drawCena4(); break;
    case 5: drawCena5(); break;
    case 6: drawCena6(); break;
  }
  pop();

  // Renderizar Color Picking (buffer oculto)
  renderPickBuffer();

  // Atualizar HUD overlay (via DOM)
  drawHUD();

  // Overlay de transição (fade)
  drawTransicaoOverlay();
}

// ============================================================
// TRANSIÇÃO ENTRE CENAS
// ============================================================

function iniciarTransicao(destino) {
  if (transicao.ativa) return;
  transicao.ativa = true;
  transicao.destino = destino;
  transicao.progresso = 0;
  transicao.fase = 'fadeOut';
}

function processarTransicao() {
  transicao.progresso += transicao.velocidade;

  if (transicao.fase === 'fadeOut' && transicao.progresso >= 1.0) {
    cenaAnterior = cenaAtual;
    cenaAtual = transicao.destino;
    transicao.fase = 'fadeIn';
    transicao.progresso = 0;
  }

  if (transicao.fase === 'fadeIn' && transicao.progresso >= 1.0) {
    transicao.ativa = false;
    transicao.fase = 'none';
    transicao.progresso = 0;
  }
}

function drawTransicaoOverlay() {
  if (!transicao.ativa) return;

  push();
  resetShader();
  ortho();
  noLights();
  noStroke();

  let alpha = 0;
  if (transicao.fase === 'fadeOut') {
    alpha = transicao.progresso;
  } else if (transicao.fase === 'fadeIn') {
    alpha = 1.0 - transicao.progresso;
  }

  fill(10, 10, 20, alpha * 255);
  rect(-width / 2, -height / 2, width, height);
  pop();

  // Texto de transição via DOM
  let transDiv = document.getElementById('hud-scene-indicator');
  if (transDiv && alpha > 0.5) {
    transDiv.textContent = "→ " + getNomeCena(transicao.destino);
    transDiv.style.color = 'rgba(220, 220, 255, ' + (alpha - 0.3) + ')';
    transDiv.style.fontSize = '16px';
  }
}

function getNomeCena(num) {
  switch (num) {
    case 1: return "Geometria e Câmera";
    case 2: return "Modelo de Phong";
    case 3: return "Texturização e Shaders";
    case 4: return "CSG e Ray Casting";
    case 5: return "Ray Marching & SDFs";
    case 6: return "Curvas e Superfícies";
    default: return "???";
  }
}

// ============================================================
// HUD OVERLAY (via DOM HTML — contorna limitação text() WebGL)
// ============================================================

function drawHUD() {
  let hudContent = document.getElementById('hud-content');
  let sceneIndicator = document.getElementById('hud-scene-indicator');
  let fpsDiv = document.getElementById('hud-fps');
  let hudOverlay = document.getElementById('hud-overlay');

  if (!hudContent || !sceneIndicator) return;

  // Toggle visibilidade
  hudOverlay.style.display = hudVisible ? 'block' : 'none';
  document.getElementById('hud-meta').style.display = hudVisible ? 'block' : 'none';

  if (!hudVisible) return;

  let hudLines = [];
  switch (cenaAtual) {
    case 1: hudLines = getHUDCena1(); break;
    case 2: hudLines = getHUDCena2(); break;
    case 3: hudLines = getHUDCena3(); break;
    case 4: hudLines = getHUDCena4(); break;
    case 5: hudLines = getHUDCena5(); break;
    case 6: hudLines = getHUDCena6(); break;
  }

  // Construir HTML do HUD
  let html = '';
  for (let i = 0; i < hudLines.length; i++) {
    let line = hudLines[i];
    if (i === 0) {
      html += '<div class="hud-title">' + escapeHtml(line) + '</div>';
    } else if (line === '') {
      html += '<div class="hud-line empty"></div>';
    } else if (line.startsWith('▶') || line.startsWith('>>') || line.startsWith('   ')) {
      html += '<div class="hud-line action">' + escapeHtml(line) + '</div>';
    } else {
      let parts = line.split(': ');
      if (parts.length > 1) {
        html += '<div class="hud-line">' + escapeHtml(parts[0]) + ': <span class="highlight">' + escapeHtml(parts.slice(1).join(': ')) + '</span></div>';
      } else {
        html += '<div class="hud-line">' + escapeHtml(line) + '</div>';
      }
    }
  }
  hudContent.innerHTML = html;

  // Meta info
  if (!transicao.ativa) {
    sceneIndicator.textContent = 'Cena ' + cenaAtual + ' / 6  ·  [←/→] Navegar  ·  [H] HUD  ·  [1-6] Pular';
    sceneIndicator.style.color = '';
    sceneIndicator.style.fontSize = '';
  }
  fpsDiv.textContent = 'FPS: ' + Math.round(frameRate());
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// COLOR PICKING
// ============================================================

function renderPickBuffer() {
  beginPick();

  switch (cenaAtual) {
    case 1: drawCena1Pick(); break;
    case 2: drawCena2Pick(); break;
    case 3: drawCena3Pick(); break;
    case 4: drawCena4Pick(); break;
    case 5: drawCena5Pick(); break;
    case 6: drawCena6Pick(); break;
  }

  endPick();
}

// ============================================================
// EVENTOS DE INPUT
// ============================================================

function mousePressed() {
  if (transicao.ativa) return;

  // Cena 4: ray caster próprio com hit-test 2D (não usa o pickBuffer).
  if (cenaAtual === 4) { clickCena4(); return; }

  // Cena 6: editor de Bézier com hit-test 2D próprio (seleção de ponto).
  if (cenaAtual === 6) { mousePressedCena6(); return; }

  // A cena 5 usa getPickedID para o portal Seta (ID 10) → não pular o picking.
  let pickedID = getPickedID(mouseX, mouseY);

  // Eventos de mouse que devem rodar independente de ter clicado em objeto
  if (cenaAtual === 1) {
    mousePressedCena1();
  }

  // Cena 5: o portal usa picking (ID 10), mas clicar em QUALQUER outro ponto
  // do cenário cicla o smooth-min — então não podemos abortar em pickedID 0.
  if (cenaAtual === 5) { clickCena5(pickedID); return; }

  // Interromper se não clicou em nenhum objeto interagível
  if (pickedID === 0) return;

  switch (cenaAtual) {
    case 1: clickCena1(pickedID); break;
    case 2: clickCena2(pickedID); break;
    case 3: clickCena3(pickedID); break;
  }
}

function mouseDragged() {
  if (cenaAtual === 1) {
    mouseDraggedCena1();
  } else if (cenaAtual === 6) {
    mouseDraggedCena6();
  }
}

function mouseReleased() {
  if (cenaAtual === 1) {
    mouseReleasedCena1();
  } else if (cenaAtual === 6) {
    mouseReleasedCena6();
  }
}

function keyPressed() {
  // Toggle HUD
  if (key === 'h' || key === 'H') {
    hudVisible = !hudVisible;
  }

  // Cena 5: teclas específicas (R = reflexão, S = sombras)
  if (cenaAtual === 5) {
    keyPressedCena5();
  }

  // Navegação sequencial por setas (← anterior, → próxima), com clamp [1,6].
  // iniciarTransicao já ignora chamadas durante uma transição em andamento.
  if (keyCode === RIGHT_ARROW) {
    let dest = Math.min(cenaAtual + 1, 6);
    if (dest !== cenaAtual) iniciarTransicao(dest);
    return false; // evita o scroll/comportamento default do navegador
  }
  if (keyCode === LEFT_ARROW) {
    let dest = Math.max(cenaAtual - 1, 1);
    if (dest !== cenaAtual) iniciarTransicao(dest);
    return false;
  }

  // Debug: pular cenas com números 1-6
  if (key >= '1' && key <= '6') {
    let dest = parseInt(key);
    if (dest !== cenaAtual) {
      iniciarTransicao(dest);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initPickBuffer(width, height);
}
