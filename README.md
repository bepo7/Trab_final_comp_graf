# Trabalho Final de Computação Gráfica

Este projeto é uma galeria interativa 3D desenvolvida com a biblioteca **p5.js** (WebGL) para demonstrar diversos conceitos fundamentais da Computação Gráfica.

A aplicação é dividida em "cenas", cada uma focada em um tópico específico ensinado na disciplina:
1. **Transformações e Arcball:** Rotação, translação e visualização em malha (wireframe).
2. **Modelo de Iluminação de Phong:** Interações com luz ambiente, difusa (Lambert), especular (brilho) e materiais emissivos.
3. **Texturas e Normal Mapping:** Aplicação de texturas procedurais (Checkerboard) e simulação de relevo usando Normal Maps sobre superfícies com iluminação de Blinn-Phong.
4. **Ray Casting e CSG (Geometria Sólida Construtiva):** Demonstração visual de bounding boxes, lançamento de raios (interseção raio-esfera) e operações booleanas (União, Interseção e Diferença) usando recortes na GPU.
5. **Ray Marching e SDFs:** Renderização via Shaders customizados (GLSL) demonstrando fusão suave (Smooth Min) de funções de distância e reflexões complexas.
6. **Curvas Paramétricas (Bézier):** Traçado e movimentação temporal utilizando pontos de controle interativos de curvas de Bézier.

## Como rodar o projeto localmente

Como o projeto utiliza shaders customizados e carrega scripts de múltiplas pastas, é necessário rodar a aplicação através de um servidor local (para evitar bloqueios de segurança CORS do navegador).

Siga os passos abaixo no seu terminal (dentro da pasta do projeto):

1. **Inicie o servidor local:**
   Se você usa Node.js, execute:
   ```bash
   npx serve -l 3000
   ```
   *(Alternativamente, se preferir usar Python, execute: `python3 -m http.server 3000`)*

2. **Acesse no navegador:**
   Abra o seu navegador de preferência e acesse:
   [http://localhost:3000](http://localhost:3000)

**Dica:** Sempre que o servidor subir, clique nos portais de transição (Setas Verdes no canto direito) para navegar pelas cenas. Caso tenha feito atualizações de código, lembre-se de usar `Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows) para limpar o cache da página.
