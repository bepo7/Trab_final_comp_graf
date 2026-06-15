// ============================================================
// CENA 3: Texturização e Shaders Customizados — "Sala de Galeria"
// Conceitos: Mapeamento UV, Texturas Procedurais (height map →
//            color map + normal map), Filtros de Textura
//            (LINEAR/NEAREST) e Normal Mapping com matriz TBN.
//
// Composição: uma sala de galeria coerente com o tema do trabalho —
//   • Parede de TIJOLOS ao fundo: cor e relevo derivados da MESMA
//     height map procedural; o normal map é aplicado pelo shader
//     customizado (clicável: liga/desliga o relevo).
//   • Piso de madeira procedural (tábuas com veio via noise).
//   • QUADRO pixel-art 16×16 emoldurado: a magnificação extrema
//     evidencia a diferença LINEAR × NEAREST (clicável).
//   • GLOBO TERRA procedural girando sobre um pedestal (clicável):
//     continentes de uma máscara equiretangular embutida + biomas
//     por latitude (sem nenhum asset de imagem externo).
//   • Luz pontual ORBITANDO: a incidência rasante↔frontal faz o
//     relevo do normal map "respirar" (com esfera-marcador).
// ============================================================

let cena3 = {
  bumpAtivo: false,           // Normal Mapping da parede (inicia desligado)
  filtroLinear: true,         // true=LINEAR, false=NEAREST (quadro)
  globoGira: true,            // Rotação do globo
  luzAng: 0,                  // Ângulo da luz orbital
  globoRot: 0,                // Ângulo acumulado do globo
  texParedeCor: null,         // Color map dos tijolos (1024×512)
  texParedeNormal: null,      // Normal map dos tijolos (1024×512)
  texPiso: null,              // Textura de madeira (512×256)
  texQuadro: null,            // Pixel-art 16×16
  texGlobo: null,             // Textura do globo Terra (512×256)
  normalMapShader: null,      // Preenchido pelo preload() do sketch.js
};

// Layout da cena (compartilhado entre drawCena3 e drawCena3Pick para
// que o picking fique sempre alinhado ao desenho).
const C3 = {
  paredeY: -40, paredeZ: -250, paredeFator: 1.5, // plane(width*f, height*f)
  pisoY: 150, pisoZ: -25, pisoProf: 560,
  quadroX: -95, quadroY: -75, quadroZMoldura: -243, quadroZTela: -236,
  molduraTam: 176, telaTam: 140,
  pedX: 120, pedY: 102, pedRaio: 34, pedAltura: 95,
  globoX: 120, globoY: 13, globoZ: 20, globoRaio: 42,
};

// ============================================================
// SETUP: geração das texturas procedurais (uma única vez).
// Todas usam createImage (p5.Image sobe à GPU uma vez; createGraphics
// seria re-enviada a cada frame).
// ============================================================
function setupCena3() {
  noiseSeed(1234); // determinístico; noise() só é usado nesta cena
  gerarTexturasParede();
  cena3.texPiso = gerarTexturaPiso();
  cena3.texQuadro = gerarTexturaQuadro();
  cena3.texGlobo = gerarTexturaGlobo();
}

/**
 * Deriva um normal map de uma height map por diferenças centrais:
 * n = normalize(-dh/dx * força, -dh/dy * força, 1), remapeada de
 * [-1,1] para [0,255]. É o método clássico de "height → normal".
 */
function normalDaHeight(hgt, W, H, forca) {
  // Passo 1: preencher os pixels num createImage (endereçamento 1:1)
  let raw = createImage(W, H);
  raw.loadPixels();
  for (let y = 0; y < H; y++) {
    let ym = Math.max(y - 1, 0) * W, yp = Math.min(y + 1, H - 1) * W, yy = y * W;
    for (let x = 0; x < W; x++) {
      let xm = Math.max(x - 1, 0), xp = Math.min(x + 1, W - 1);
      let dx = (hgt[yy + xp] - hgt[yy + xm]) * forca;
      let dy = (hgt[yp + x] - hgt[ym + x]) * forca;
      let nx = -dx, ny = -dy, nz = 1.0;
      let inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      let i = 4 * (yy + x);
      raw.pixels[i]     = Math.round((nx * inv * 0.5 + 0.5) * 255);
      raw.pixels[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      raw.pixels[i + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      raw.pixels[i + 3] = 255;
    }
  }
  raw.updatePixels();

  // Passo 2: desenhar a imagem num createGraphics — o p5.js só promove
  // a textura GL de um canvas que foi "desenhado". Sem isso, setUniform
  // com shader customizado recebe uma textura vazia.
  let g = createGraphics(W, H);
  g.pixelDensity(1);
  g.image(raw, 0, 0, W, H);
  return g;
}

/**
 * Parede de tijolos: uma única passada constrói a HEIGHT MAP (rejunte
 * fundo, tijolo alto, chanfro suave nas bordas, grão fino) e o COLOR
 * MAP (tom variando por tijolo). O normal map é derivado da height map
 * — assim o relevo corresponde exatamente ao desenho dos tijolos.
 */
function gerarTexturasParede() {
  const W = 1024, H = 512;
  const BW = 128, BH = 64;   // tijolo 128×64 px (8 colunas × 8 fiadas)
  const MEIA_JUNTA = 5;      // metade do rejunte (10 px no total)
  const CHANFRO = 7;         // borda arredondada do tijolo

  // Variações por tijolo pré-computadas (evita noise() por pixel)
  let nRows = Math.ceil(H / BH) + 1, nCols = Math.ceil(W / BW) + 2;
  let tintH = [], tintC = [];
  for (let r = 0; r < nRows; r++) {
    tintH.push([]); tintC.push([]);
    for (let c = 0; c < nCols; c++) {
      tintH[r].push(noise(c * 7.31, r * 13.7));
      tintC[r].push(noise(c * 5.17 + 40, r * 3.91 + 40));
    }
  }

  let hgt = new Float32Array(W * H);
  // Passo 1: preencher pixels num createImage (endereçamento 1:1, sem pixel density)
  let rawCor = createImage(W, H);
  rawCor.loadPixels();

  for (let y = 0; y < H; y++) {
    let row = Math.floor(y / BH);
    let offsetX = (row % 2) * (BW / 2); // fiadas alternadas
    let by = y % BH;
    for (let x = 0; x < W; x++) {
      let bx = (x + offsetX) % BW;
      let col = Math.floor((x + offsetX) / BW);
      // distância até a junta mais próxima (em x e y)
      let dEdge = Math.min(bx, BW - bx, by, BH - by);

      // --- ALTURA: rejunte no fundo (0.18) subindo por chanfro
      //     suave (smoothstep) até o topo do tijolo (1.0) ---
      let t = constrain((dEdge - MEIA_JUNTA) / CHANFRO, 0, 1);
      let ts = t * t * (3 - 2 * t);
      let grao = (noise(x * 0.09, y * 0.09) - 0.5) * 0.06;
      let h = 0.18 + 0.82 * ts + (tintH[row][col] * 0.05 + grao) * (0.3 + 0.7 * ts);
      hgt[y * W + x] = constrain(h, 0, 1);

      // --- COR ---
      let r, g, b;
      if (dEdge < MEIA_JUNTA) {
        // rejunte/argamassa clara com grão
        let v = (noise(x * 0.3, y * 0.3) - 0.5) * 16;
        r = 198 + v; g = 192 + v; b = 182 + v;
      } else {
        // tijolo: tom variando por tijolo + grão + sombra de borda
        let tc = tintC[row][col];
        r = 146 + (188 - 146) * tc;
        g = 66 + (98 - 66) * tc;
        b = 50 + (66 - 50) * tc;
        let fator = 0.92 + 0.16 * noise(x * 0.15 + 100, y * 0.15);
        if (dEdge < MEIA_JUNTA + 4) fator *= 0.88;
        r *= fator; g *= fator; b *= fator;
      }
      let i = 4 * (y * W + x);
      rawCor.pixels[i]     = constrain(Math.round(r), 0, 255);
      rawCor.pixels[i + 1] = constrain(Math.round(g), 0, 255);
      rawCor.pixels[i + 2] = constrain(Math.round(b), 0, 255);
      rawCor.pixels[i + 3] = 255;
    }
  }
  rawCor.updatePixels();

  // Passo 2: transferir para createGraphics via draw (garante GL texture válida)
  let corGfx = createGraphics(W, H);
  corGfx.pixelDensity(1);
  corGfx.image(rawCor, 0, 0, W, H);
  cena3.texParedeCor = corGfx;
  cena3.texParedeNormal = normalDaHeight(hgt, W, H, 6.0);
}

/**
 * Piso de madeira: tábuas horizontais de 32 px com juntas escuras
 * escalonadas, tom por tábua e veio ondulado via noise.
 */
function gerarTexturaPiso() {
  const W = 512, H = 256;
  const TABUA = 32;
  let img = createImage(W, H);
  img.loadPixels();
  for (let y = 0; y < H; y++) {
    let row = Math.floor(y / TABUA);
    let tomTabua = noise(row * 11.7 + 3.1);
    for (let x = 0; x < W; x++) {
      let r, g, b;
      // juntas entre tábuas (horizontais) e topos escalonados (verticais)
      if (y % TABUA < 2 || (x + row * 167) % 256 < 3) {
        r = 58; g = 40; b = 26;
      } else {
        r = 92 + (150 - 92) * tomTabua;
        g = 62 + (104 - 62) * tomTabua;
        b = 38 + (64 - 38) * tomTabua;
        let veio = 0.80 + 0.35 * noise(x * 0.02, row * 40 + y * 0.35);
        let grao = 0.94 + 0.12 * noise(x * 0.5, y * 0.5);
        r *= veio * grao; g *= veio * grao; b *= veio * grao;
      }
      let i = 4 * (y * W + x);
      img.pixels[i] = constrain(Math.round(r), 0, 255);
      img.pixels[i + 1] = constrain(Math.round(g), 0, 255);
      img.pixels[i + 2] = constrain(Math.round(b), 0, 255);
      img.pixels[i + 3] = 255;
    }
  }
  img.updatePixels();
  return img;
}

/**
 * Quadro pixel-art 16×16: paisagem minimalista codificada à mão
 * (sol, montanhas, campo e árvore). Exibida com magnificação ~9×,
 * é a demonstração perfeita do filtro LINEAR (borra) × NEAREST
 * (preserva o pixel).
 */
function gerarTexturaQuadro() {
  const PALETA = {
    C: [135, 206, 235], c: [175, 226, 245], S: [255, 220, 80],
    M: [110, 90, 120], m: [140, 120, 150], G: [88, 160, 70],
    g: [60, 120, 50], T: [110, 70, 40], F: [40, 100, 45],
  };
  const SPRITE = [
    "CCCCCCCCCCCSSCCC",
    "CCCCCCCCCCSSSSCC",
    "CCCCCCCCCCCSSCCC",
    "CCCCCCCCCCCCCCCC",
    "CCCCCCCMCCCCCCCC",
    "CCCCCCMMMCCCCCCC",
    "cccccMMmMMcccccc",
    "ccccMMmmmMMccccc",
    "cccMMmmmmmMMcccc",
    "ccMMmmmmmmmMMccc",
    "GGGGGGGGGGGGGGGG",
    "GGgGGGFFFGGGGgGG",
    "GGGGGFFFFFGGGGGG",
    "GGGGGGFTFGGGgGGG",
    "GGgGGGGTGGGGGGGG",
    "GGGGGGGGGGGGGGGG",
  ];
  let img = createImage(16, 16);
  img.loadPixels();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let c = PALETA[SPRITE[y][x]];
      let i = 4 * (y * 16 + x);
      img.pixels[i] = c[0]; img.pixels[i + 1] = c[1];
      img.pixels[i + 2] = c[2]; img.pixels[i + 3] = 255;
    }
  }
  img.updatePixels();
  return img;
}

/**
 * Máscara equiretangular 96×48 dos CONTINENTES DA TERRA ('#' = terra,
 * '.' = água), desenhada à mão — mesma técnica do pixel-art do quadro.
 * col 0 = lon −180°, col 95 = lon +180°; linha 0 = lat +90°, linha 47 = −90°.
 * A textura final NÃO mostra estes blocos: a máscara é amostrada com
 * interpolação bilinear + domain warp de noise (costas irregulares).
 */
const C3_TERRA = [
  '................................................................................................',
  '..........................#####..########.......................................................',
  '..................###..###.####.###########.........###.........................................',
  '.................###..###.####.############.........##..................###.....................',
  '................####.########...##########..............................#######......##.........',
  '#...#######.##################...########............#######....################################',
  '##.########.###########..######..########.###......########.####################################',
  '....###################.....####...##............####.##########################################',
  '....###################.....######............##.####..###############################....##....',
  '..............#########....#######...........###.######################################..##.....',
  '..............#################..##...........##########################################........',
  '..............##########...####..#.............#############..#######################.#.........',
  '..............################...............###########...#..######################..#.........',
  '...............##############................###...####.#####.#####################.##..........',
  '...............#############.................#######....###########################.##..........',
  '................###########..................######################################.............',
  '................######....##................#############.####.###################..............',
  '................#######...#................##############.####.#..################..............',
  '...................######.####.............###############.#####...#####.#####..#...............',
  '......................####................################..##.....####..####...##..............',
  '.......................###...###..........####################.....###...####...##..............',
  '.........................##########.......####################.......#....###...##..............',
  '...........................########........##################........#...####.##.#..............',
  '..........................##########..............###########.............##.###.#..............',
  '..........................###########..............########...............#####..#.######.......',
  '...........................############............########.................###.....######......',
  '...........................############............########....................###...####.......',
  '...........................###########.............########.##....................#####.........',
  '............................##########.............#######..##..................#####.#.........',
  '.............................########..............#######..#.................##########........',
  '..............................######................#####...#.................###########.......',
  '..............................######................#####.....................###########.......',
  '.............................#####..................####......................###########.......',
  '.............................####...................###........................#.....####.....#.',
  '.............................###......................................................#......##.',
  '............................###.......................................................##....##..',
  '............................###.............................................................#...',
  '............................##..................................................................',
  '............................###.................................................................',
  '................................................................................................',
  '................................................................................................',
  '...............................###..........................###############################.....',
  '..............................#####.............################################################',
  '......##########################.........##################################################.....',
  '........#######################..........#################################################......',
  '################################################################################################',
  '################################################################################################',
  '################################################################################################',
];

/**
 * GLOBO TERRA: em vez de noise puro (que dava um "planeta genérico"),
 * os continentes vêm da máscara C3_TERRA, amostrada com interpolação
 * BILINEAR + DOMAIN WARP por noise — as costas ficam irregulares e os
 * blocos da máscara somem. Biomas por latitude (tropical, deserto,
 * temperado, tundra, neve), oceano com profundidade perto da costa e
 * banquisa polar com borda ruidosa. As entradas de noise são amostradas
 * num círculo (cos/sin da longitude) para a textura FECHAR em u=0/u=1.
 */
function gerarTexturaGlobo() {
  const W = 512, H = 256; // equiretangular 2:1
  const MW = 96, MH = 48; // dimensões da máscara

  // terra=1/água=0, com wrap na longitude e clamp na latitude
  const land = (ix, iy) => {
    if (iy < 0) iy = 0; else if (iy > MH - 1) iy = MH - 1;
    ix = ((ix % MW) + MW) % MW;
    return C3_TERRA[iy].charCodeAt(ix) === 35 ? 1 : 0; // 35 = '#'
  };
  // fração de terra num ponto contínuo da máscara (bilinear)
  const landBi = (mx, my) => {
    let x0 = Math.floor(mx), y0 = Math.floor(my);
    let fx = mx - x0, fy = my - y0;
    let a = land(x0, y0) * (1 - fx) + land(x0 + 1, y0) * fx;
    let b = land(x0, y0 + 1) * (1 - fx) + land(x0 + 1, y0 + 1) * fx;
    return a * (1 - fy) + b * fy;
  };

  let img = createImage(W, H);
  img.loadPixels();
  for (let y = 0; y < H; y++) {
    let v = y / H;            // 0 = polo norte, 1 = polo sul
    let lat = 90 - v * 180;
    let absLat = Math.abs(lat);
    for (let x = 0; x < W; x++) {
      let th = (x / W) * TWO_PI;
      let nx = 2 + 2 * Math.cos(th); // círculo: noise periódico em x
      let ny = 2 + 2 * Math.sin(th);

      // costas irregulares: perturbar ONDE a máscara é lida (±1.2 célula)
      let wx = (noise(nx * 2.3, ny * 2.3, v * 5.0) - 0.5) * 2.4;
      let wy = (noise(nx * 2.3 + 9.7, ny * 2.3 + 3.1, v * 5.0) - 0.5) * 2.4;
      let cont = landBi((x / W) * MW - 0.5 + wx, v * MH - 0.5 + wy);

      let n1 = noise(nx * 3.0, ny * 3.0, v * 7.0);   // macro: deserto×floresta
      let n2 = noise(nx * 7.0, ny * 7.0, v * 16.0);  // grão fino: relevo

      let r, g, b;
      if (cont > 0.5) {
        // ---------- TERRA: bioma por latitude ----------
        if (absLat < 18) {           // tropical (Amazônia, Congo)
          r = 34 + 36 * n1; g = 92 + 36 * n2; b = 38 + 18 * n1;
        } else if (absLat < 38) {    // faixa subtropical: deserto × savana
          let faixa = 1 - constrain(Math.abs(absLat - 24) / 14, 0, 1);
          let d = constrain(faixa * 1.4 + (n1 - 0.5) * 1.6 - 0.25, 0, 1);
          r = 92 + (176 - 92) * d + 18 * n2;
          g = 116 + (150 - 116) * d + 14 * n2;
          b = 52 + (96 - 52) * d;
        } else if (absLat < 56) {    // temperado
          r = 64 + 38 * n2; g = 96 + 30 * n1; b = 46 + 18 * n2;
        } else {                     // boreal/tundra
          r = 96 + 40 * n2; g = 104 + 32 * n2; b = 88 + 26 * n1;
        }
        // neve progressiva em latitudes altas (Groenlândia, Antártida)
        let s = constrain((absLat - (60 + (n1 - 0.5) * 12)) / 9, 0, 1);
        r += (236 - r) * s; g += (240 - g) * s; b += (246 - b) * s;
      } else if (cont > 0.42) {
        // ---------- LITORAL: faixa estreita de areia ----------
        r = 176 + 18 * n2; g = 168 + 14 * n2; b = 128 + 12 * n2;
      } else {
        // ---------- OCEANO: raso perto da costa → profundo ----------
        let prof = constrain((0.42 - cont) / 0.42, 0, 1);
        let o = (n2 - 0.5) * 14;
        r = 40 + (12 - 40) * prof + o * 0.4;
        g = 106 + (44 - 106) * prof + o * 0.6;
        b = 150 + (98 - 150) * prof + o;
        // banquisa (gelo marinho) acima de ~72° com borda ruidosa
        let s = constrain((absLat - (72 + (n1 - 0.5) * 10)) / 5, 0, 1);
        r += (228 - r) * s; g += (236 - g) * s; b += (244 - b) * s;
      }
      let i = 4 * (y * W + x);
      img.pixels[i] = constrain(Math.round(r), 0, 255);
      img.pixels[i + 1] = constrain(Math.round(g), 0, 255);
      img.pixels[i + 2] = constrain(Math.round(b), 0, 255);
      img.pixels[i + 3] = 255;
    }
  }
  img.updatePixels();
  return img;
}

// ============================================================
// DRAW
// ============================================================
function drawCena3() {
  perspective(PI / 3, width / height, 0.1, 2000);

  // --- Iluminação: base fria de museu + luz quente ORBITAL ---
  ambientLight(70, 68, 80);
  directionalLight(60, 60, 70, 0.3, 1.0, -0.4); // fill fraco de cima

  // A luz orbita numa elipse inclinada: alterna entre incidência
  // RASANTE à parede (relevo dramático) e frontal (relevo some) —
  // a narrativa visual do normal mapping.
  cena3.luzAng += 0.012;
  let lx = 210 * Math.cos(cena3.luzAng);
  let ly = -70 + 30 * Math.sin(cena3.luzAng * 0.63);
  let lz = -80 + 75 * Math.sin(cena3.luzAng);
  pointLight(255, 232, 190, lx, ly, lz);

  // =========================================
  // OBJETO 1: PAREDE DE TIJOLOS (Normal Mapping no shader)
  // =========================================
  push();
  translate(0, C3.paredeY, C3.paredeZ);
  noStroke();
  if (cena3.normalMapShader && cena3.texParedeCor) {
    // A parede usa o shader SEMPRE; uUseBump alterna só a perturbação
    // da normal — a iluminação fica idêntica nos dois estados e a
    // comparação didática é honesta (cor igual, muda apenas o relevo).
    let s = cena3.normalMapShader;
    shader(s);
    // O shader ilumina em VIEW SPACE; com a câmera default do p5
    // (olho em (0,0,camZ), sem rotação) a conversão é só -camZ em z.
    let camZ = (height / 2) / Math.tan(PI / 6);
    s.setUniform('uColorMap', cena3.texParedeCor);
    s.setUniform('uNormalMap', cena3.texParedeNormal);
    s.setUniform('uLightPos', [lx, ly, lz - camZ]);
    s.setUniform('uLightColor', [1.0, 0.92, 0.78]);
    s.setUniform('uAmbientColor', [0.85, 0.85, 1.0]);
    s.setUniform('uBumpStrength', 1.0);
    s.setUniform('uShininess', 16.0);
    s.setUniform('uSpecStrength', 0.12);
    s.setUniform('uUseBump', cena3.bumpAtivo ? 1.0 : 0.0);
    plane(width * C3.paredeFator, height * C3.paredeFator);
    resetShader(); // obrigatório: os demais objetos usam o pipeline p5
  } else {
    // Fallback (shader não carregou): parede texturizada sem relevo
    texture(cena3.texParedeCor);
    plane(width * C3.paredeFator, height * C3.paredeFator);
  }
  pop();

  // =========================================
  // PISO DE MADEIRA (pipeline padrão do p5, contrasta com o shader)
  // =========================================
  push();
  translate(0, C3.pisoY, C3.pisoZ);
  rotateX(PI / 2);
  noStroke();
  texture(cena3.texPiso);
  plane(width * C3.paredeFator, C3.pisoProf);
  pop();

  // =========================================
  // OBJETO 2: QUADRO PIXEL-ART (filtro LINEAR × NEAREST)
  // =========================================
  // Moldura de madeira escura
  push();
  translate(C3.quadroX, C3.quadroY, C3.quadroZMoldura);
  noStroke();
  fill(82, 54, 32);
  ambientMaterial(82, 54, 32);
  box(C3.molduraTam, C3.molduraTam, 10);
  pop();

  // Tela 16×16 magnificada ~9× — o filtro fica gritante
  push();
  translate(C3.quadroX, C3.quadroY, C3.quadroZTela);
  noStroke();
  texture(cena3.texQuadro);
  // Configurar o filtro de interpolação da textura.
  // NOTA: p5.js não expõe API pública para trocar o filtro de uma textura
  // já criada; usamos o renderer interno (_renderer.getTexture), que é API
  // NÃO-oficial (mesmo padrão já usado na cena 4). O try-catch garante
  // que, se quebrar numa versão futura, o toggle apenas vira no-op.
  try {
    let p5tex = window._renderer.getTexture(cena3.texQuadro);
    if (p5tex && typeof p5tex.setInterpolation === 'function') {
      let modo = cena3.filtroLinear ? LINEAR : NEAREST;
      p5tex.setInterpolation(modo, modo);
    }
  } catch (e) {
    // Silencioso: roda a cada frame, não poluir o console.
  }
  plane(C3.telaTam, C3.telaTam);
  pop();

  // =========================================
  // OBJETO 3: GLOBO sobre PEDESTAL (peça da galeria)
  // =========================================
  // Pedestal de pedra
  push();
  translate(C3.pedX, C3.pedY, C3.globoZ);
  noStroke();
  fill(150, 148, 145);
  ambientMaterial(150, 148, 145);
  specularMaterial(60, 60, 60);
  shininess(8);
  cylinder(C3.pedRaio, C3.pedAltura);
  pop();

  // Globo (só textura + luzes; especular sobreporia a textura)
  push();
  translate(C3.globoX, C3.globoY, C3.globoZ);
  if (cena3.globoGira) cena3.globoRot += 0.008;
  rotateZ(0.41);           // inclinação do eixo da Terra (~23.5°)
  rotateY(cena3.globoRot); // rotação "diária" em torno do eixo inclinado
  noStroke();
  texture(cena3.texGlobo);
  sphere(C3.globoRaio, 48, 32);
  pop();

  // Esfera-marcador da luz orbital (emissiva, como na cena 2)
  push();
  translate(lx, ly, lz);
  emissiveMaterial(255, 235, 180);
  noStroke();
  sphere(6);
  pop();

  // =========================================
  // OBJETO PORTAL: SETA (ID 10)
  // =========================================
  push();
  translate(180, -80, 0); // Canto superior/direito
  let pulseScale = 1.0 + 0.1 * sin(frameCount * 0.05);
  scale(pulseScale);

  rotateZ(-PI / 2); // Apontar para direita
  rotateX(frameCount * 0.02);

  emissiveMaterial(50, 255, 150);
  specularMaterial(200, 255, 200);
  noStroke();

  push(); translate(0, -10, 0); cylinder(5, 20); pop(); // corpo
  push(); translate(0, 10, 0); cone(12, 20); pop();    // ponta
  pop();
}

// ============================================================
// PICK (espelha as transforms do draw via C3)
// ============================================================
function drawCena3Pick() {
  pickBuffer.perspective(PI / 3, width / height, 0.1, 2000);

  // Parede (ID 1)
  pickBuffer.push();
  pickBuffer.translate(0, C3.paredeY, C3.paredeZ);
  setPickID(1);
  pickBuffer.plane(width * C3.paredeFator, height * C3.paredeFator);
  pickBuffer.pop();

  // Piso — ID 0 (preto = "nenhum objeto"), mas OCLUI a parede no
  // depth buffer: clique no chão não dispara o toggle da parede.
  pickBuffer.push();
  pickBuffer.translate(0, C3.pisoY, C3.pisoZ);
  pickBuffer.rotateX(PI / 2);
  setPickID(0);
  pickBuffer.plane(width * C3.paredeFator, C3.pisoProf);
  pickBuffer.pop();

  // Quadro: moldura + tela como um único alvo generoso (ID 2)
  pickBuffer.push();
  pickBuffer.translate(C3.quadroX, C3.quadroY, C3.quadroZTela);
  setPickID(2);
  pickBuffer.plane(C3.molduraTam, C3.molduraTam);
  pickBuffer.pop();

  // Pedestal + globo (ID 3); a esfera é invariante à rotação
  pickBuffer.push();
  pickBuffer.translate(C3.pedX, C3.pedY, C3.globoZ);
  setPickID(3);
  pickBuffer.cylinder(C3.pedRaio, C3.pedAltura);
  pickBuffer.pop();
  pickBuffer.push();
  pickBuffer.translate(C3.globoX, C3.globoY, C3.globoZ);
  setPickID(3);
  pickBuffer.sphere(C3.globoRaio, 16, 12);
  pickBuffer.pop();

  // Portal Seta (ID 10)
  pickBuffer.push();
  pickBuffer.translate(180, -80, 0);
  pickBuffer.rotateZ(-PI / 2);
  pickBuffer.rotateX(frameCount * 0.02);
  setPickID(10);
  pickBuffer.push(); pickBuffer.translate(0, -10, 0); pickBuffer.cylinder(5, 20); pickBuffer.pop();
  pickBuffer.push(); pickBuffer.translate(0, 10, 0); pickBuffer.cone(12, 20); pickBuffer.pop();
  pickBuffer.pop();
}

function clickCena3(pickedID) {
  if (pickedID === 1) {
    // Toggle Normal Mapping da parede
    cena3.bumpAtivo = !cena3.bumpAtivo;
  } else if (pickedID === 2) {
    // Toggle filtro LINEAR/NEAREST do quadro
    cena3.filtroLinear = !cena3.filtroLinear;
  } else if (pickedID === 3) {
    cena3.globoGira = !cena3.globoGira;
  } else if (pickedID === 10) {
    iniciarTransicao(4);
  }
}

function getHUDCena3() {
  let lines = [];
  lines.push("CENA 3: Texturização e Shaders");
  lines.push("");
  lines.push("Normal Map (parede): " + (cena3.bumpAtivo ? "ATIVO — relevo via TBN" : "desligado (parede lisa)"));
  lines.push("Filtro do quadro: " + (cena3.filtroLinear ? "LINEAR (borrado)" : "NEAREST (pixel nítido)"));
  lines.push("Globo: Terra procedural — " + (cena3.globoGira ? "girando" : "parado"));
  lines.push("");
  lines.push("▶ Clique na parede de tijolos: liga/desliga o relevo");
  lines.push("▶ Clique no quadro pixel-art: filtro LINEAR ↔ NEAREST");
  lines.push("▶ Clique no globo: girar/parar");
  lines.push("▶ Clique na seta verde (dir.): portal →");
  return lines;
}
