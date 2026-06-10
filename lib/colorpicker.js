// ============================================================
// Color Picker — Detecção de clique em objetos 3D
// Usa um buffer oculto WebGL onde cada objeto é renderizado
// com uma cor ID única (emissiveMaterial para ignorar iluminação).
// Ao clicar, lemos o pixel sob o mouse.
// ============================================================

let pickBuffer = null;

/**
 * Inicializa (ou recria) o buffer de picking.
 * Deve ser chamado no setup() e windowResized().
 */
function initPickBuffer(w, h) {
  if (pickBuffer) pickBuffer.remove();
  pickBuffer = createGraphics(w, h, WEBGL);
  pickBuffer.noSmooth();
  pickBuffer.pixelDensity(1);
}

/**
 * Prepara o buffer para uma nova renderização de picking.
 * Chame antes de desenhar os objetos clicáveis.
 */
function beginPick() {
  // Resetar câmera e matriz a cada frame para evitar vazamento
  // de transformações (como o Arcball) de uma cena para outra
  pickBuffer.resetMatrix();
  pickBuffer.camera();
  
  pickBuffer.clear();
  pickBuffer.background(0, 0, 0);
  pickBuffer.noStroke();
  // Desabilitar iluminação — queremos cores exatas
  pickBuffer.noLights();
  pickBuffer.resetShader();
}

/**
 * Aplica a cor ID no buffer de picking usando emissiveMaterial
 * para que a cor não seja afetada por iluminação.
 * Cada objeto clicável deve ter um ID único (1-255).
 * @param {number} id — ID único do objeto (1-255)
 */
function setPickID(id) {
  // Usar emissiveMaterial garante que a cor é exata,
  // independente de luzes ou shaders ativos no buffer
  let r = id & 0xFF;
  let g = (id >> 8) & 0xFF;
  pickBuffer.noStroke();
  pickBuffer.fill(r, g, 0);
  // Também definir emissive para garantir visibilidade
  pickBuffer.emissiveMaterial(r, g, 0);
  pickBuffer.ambientMaterial(r, g, 0);
}

/**
 * Finaliza o ciclo de picking.
 */
function endPick() {
  // Nada a fazer
}

/**
 * Lê o pixel na posição do mouse e retorna o ID do objeto.
 * Usa get() que é mais confiável que loadPixels() em WebGL.
 * @param {number} mx — coordenada X do mouse
 * @param {number} my — coordenada Y do mouse
 * @returns {number} ID do objeto clicado, ou 0 se nenhum
 */
function getPickedID(mx, my) {
  // Clamp para dentro dos limites
  let px = constrain(Math.floor(mx), 0, pickBuffer.width - 1);
  let py = constrain(Math.floor(my), 0, pickBuffer.height - 1);

  // get() retorna um array [r, g, b, a] e é mais confiável em WebGL
  let c = pickBuffer.get(px, py);

  let r = c[0];
  let g = c[1];

  return r + (g << 8);
}
