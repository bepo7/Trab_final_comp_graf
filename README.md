# Trabalho Final de Computação Gráfica

Este projeto é uma galeria interativa 3D desenvolvida com a biblioteca **p5.js** (WebGL) para demonstrar diversos conceitos fundamentais da Computação Gráfica.

A aplicação é dividida em "cenas", cada uma focada em um tópico específico ensinado na disciplina:
1. **Transformações e Arcball:** Rotação, translação e visualização em malha (wireframe).
2. **Modelo de Iluminação de Phong:** cada objeto controla uma componente da equação: a esfera liga a luz difusa (Lambert), o torus cicla o expoente especular (shininess) e o cubo é o interruptor da luz ambiente — apaga a sala e depois vira uma *lâmpada* de verdade (material emissivo + luz pontual iluminando os vizinhos), mostrando que material emissivo, sozinho, não ilumina os outros objetos.
3. **Texturas e Normal Mapping:** sala de galeria com parede de tijolos em relevo — color map e normal map derivados da mesma height map procedural, aplicados por shader GLSL próprio (matriz TBN + Blinn-Phong) sob uma luz orbital — além de piso de madeira procedural, quadro pixel-art demonstrando os filtros de magnificação (LINEAR × NEAREST) e um globo procedural sobre pedestal.
4. **Ray Casting e CSG (Geometria Sólida Construtiva):** Ray caster implementado na CPU (sem usar o pipeline de triângulos): cada pixel lança um raio, testado primeiro contra os Bounding Volumes (AABB) e depois contra as primitivas implícitas (raízes da equação quadrática para esferas, *slab method* para caixas). As operações booleanas (União, Interseção, Diferença) são CSG de verdade, calculadas por interseção dos intervalos de raio — com chão, sombras (shadow rays) e reflexo de 1 salto calculados pelo próprio ray caster. Inclui um diagrama esquemático (vista de cima) do raio lançado.
5. **Ray Marching e SDFs:** Renderização via Shaders customizados (GLSL) demonstrando fusão suave (Smooth Min) de funções de distância, sombras suaves e reflexões complexas.
6. **Curvas Paramétricas (Bézier):** Editor interativo de curva de Bézier cúbica com 4 pontos de controle arrastáveis, avaliada pela base de Bernstein e pelo algoritmo de De Casteljau (construção animada).

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

**Navegação:** clique nos portais de transição (Setas Verdes no canto direito) **ou** use as teclas **← / →** para avançar/voltar entre as cenas. As teclas **1–6** pulam direto para uma cena e **H** alterna o HUD.

**Dica:** Caso tenha feito atualizações de código, lembre-se de usar `Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows) para limpar o cache da página.
