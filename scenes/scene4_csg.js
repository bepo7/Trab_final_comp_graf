// ============================================================
// CENA 4: Geometria Sólida Construtiva (CSG) e Ray Casting
// Conceitos: Bounding Volumes (AABB), Ray Casting,
//            Interseção Raio-Esfera, Operações CSG
// ============================================================

let cena4 = {
  // Raios lançados
  rays: [],                  // Array de {origin, dir, hitPoint, hitObj}
  maxRays: 15,

  // Objetos implícitos (definidos matematicamente)
  objects: [],

  // CSG
  csgMode: 0,               // 0=nenhuma, 1=união, 2=interseção, 3=diferença
  csgModes: ['Nenhuma', 'União (A∪B)', 'Interseção (A∩B)', 'Diferença (A-B)'],
  csgAnimAngle: 0,

  // Camera fixa
  camPos: null,
  camTarget: null,
};

function setupCena4() {
  cena4.camPos = createVector(0, -50, 350);
  cena4.camTarget = createVector(0, 0, 0);

  // Definir objetos implícitos com seus Bounding Volumes (AABBs)
  cena4.objects = [
    {
      type: 'sphere',
      center: createVector(-100, 0, 0),
      radius: 50,
      color: [100, 180, 255],
      aabb: { min: createVector(-155, -55, -55), max: createVector(-45, 55, 55) }
    },
    {
      type: 'sphere',
      center: createVector(100, 0, 0),
      radius: 45,
      color: [255, 160, 100],
      aabb: { min: createVector(50, -50, -50), max: createVector(150, 50, 50) }
    },
    {
      // CSG: duas esferas sobrepostas no centro
      type: 'sphere',
      center: createVector(-25, 0, 0),
      radius: 45,
      color: [180, 100, 255],
      aabb: { min: createVector(-75, -50, -50), max: createVector(25, 50, 50) }
    },
    {
      type: 'sphere',
      center: createVector(25, 0, 0),
      radius: 45,
      color: [100, 255, 180],
      aabb: { min: createVector(-25, -50, -50), max: createVector(75, 50, 50) }
    }
  ];
}

/**
 * Interseção raio-AABB usando o Slab Method
 * @returns {number} t de interseção, ou -1 se não intercepta
 */
function rayAABBIntersect(ro, rd, aabb) {
  let tmin = -Infinity;
  let tmax = Infinity;

  // Eixo X
  if (abs(rd.x) > 0.0001) {
    let t1 = (aabb.min.x - ro.x) / rd.x;
    let t2 = (aabb.max.x - ro.x) / rd.x;
    if (t1 > t2) { let tmp = t1; t1 = t2; t2 = tmp; }
    tmin = max(tmin, t1);
    tmax = min(tmax, t2);
  } else if (ro.x < aabb.min.x || ro.x > aabb.max.x) {
    return -1;
  }

  // Eixo Y
  if (abs(rd.y) > 0.0001) {
    let t1 = (aabb.min.y - ro.y) / rd.y;
    let t2 = (aabb.max.y - ro.y) / rd.y;
    if (t1 > t2) { let tmp = t1; t1 = t2; t2 = tmp; }
    tmin = max(tmin, t1);
    tmax = min(tmax, t2);
  } else if (ro.y < aabb.min.y || ro.y > aabb.max.y) {
    return -1;
  }

  // Eixo Z
  if (abs(rd.z) > 0.0001) {
    let t1 = (aabb.min.z - ro.z) / rd.z;
    let t2 = (aabb.max.z - ro.z) / rd.z;
    if (t1 > t2) { let tmp = t1; t1 = t2; t2 = tmp; }
    tmin = max(tmin, t1);
    tmax = min(tmax, t2);
  } else if (ro.z < aabb.min.z || ro.z > aabb.max.z) {
    return -1;
  }

  if (tmin > tmax || tmax < 0) return -1;
  return tmin > 0 ? tmin : tmax;
}

/**
 * Interseção raio-esfera (resolve equação quadrática)
 * Raio: P(t) = ro + rd*t
 * Esfera: |P - C|² = r²
 * → at² + bt + c = 0
 */
function raySphereIntersect(ro, rd, center, radius) {
  let oc = p5.Vector.sub(ro, center);
  let a = p5.Vector.dot(rd, rd);
  let b = 2.0 * p5.Vector.dot(oc, rd);
  let c = p5.Vector.dot(oc, oc) - radius * radius;

  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return -1;

  let sqrtD = Math.sqrt(discriminant);
  let t1 = (-b - sqrtD) / (2 * a);
  let t2 = (-b + sqrtD) / (2 * a);

  if (t1 > 0) return t1;
  if (t2 > 0) return t2;
  return -1;
}

/**
 * Converte coordenadas de tela (mouseX, mouseY) em um raio 3D.
 * Usa a projeção perspectiva e a posição fixa da câmera.
 */
function screenToRay(mx, my) {
  // NDC
  let ndcX = (mx / width) * 2 - 1;
  let ndcY = -((my / height) * 2 - 1);

  // FOV e aspect
  let fov = PI / 3;
  let aspect = width / height;
  let tanHalfFov = Math.tan(fov / 2);

  // Direção no espaço da câmera
  let dirCam = createVector(
    ndcX * aspect * tanHalfFov,
    ndcY * tanHalfFov,
    -1
  ).normalize();

  // Como a câmera está fixa olhando para a origem, construir a base
  let forward = p5.Vector.sub(cena4.camTarget, cena4.camPos).normalize();
  let right = p5.Vector.cross(forward, createVector(0, 1, 0)).normalize();
  let up = p5.Vector.cross(right, forward);

  // Transformar direção para world space
  let dirWorld = p5.Vector.add(
    p5.Vector.add(
      p5.Vector.mult(right, dirCam.x),
      p5.Vector.mult(up, dirCam.y)
    ),
    p5.Vector.mult(forward, -dirCam.z)
  ).normalize();

  return { origin: cena4.camPos.copy(), dir: dirWorld };
}

function drawCena4() {
  // Câmera fixa
  camera(
    cena4.camPos.x, cena4.camPos.y, cena4.camPos.z,
    cena4.camTarget.x, cena4.camTarget.y, cena4.camTarget.z,
    0, 1, 0
  );
  perspective(PI / 3, width / height, 0.1, 2000);

  ambientLight(60, 60, 80);
  directionalLight(180, 180, 200, 0.5, -1, -0.5);

  // =========================================
  // Bounding Volumes (AABBs semitransparentes)
  // =========================================
  for (let i = 0; i < cena4.objects.length; i++) {
    let obj = cena4.objects[i];
    let aabb = obj.aabb;
    let cx = (aabb.min.x + aabb.max.x) / 2;
    let cy = (aabb.min.y + aabb.max.y) / 2;
    let cz = (aabb.min.z + aabb.max.z) / 2;
    let sx = aabb.max.x - aabb.min.x;
    let sy = aabb.max.y - aabb.min.y;
    let sz = aabb.max.z - aabb.min.z;

    push();
    translate(cx, cy, cz);
    stroke(0, 255, 255, 100); // Holographic Cyan
    strokeWeight(1);
    fill(0, 255, 255, 10);
    box(sx, sy, sz);
    pop();
  }

  // =========================================
  // Objetos implícitos (esferas sólidas)
  // =========================================
  noStroke();

  // Objetos laterais
  push();
  translate(cena4.objects[0].center.x, cena4.objects[0].center.y, cena4.objects[0].center.z);
  specularMaterial(cena4.objects[0].color[0], cena4.objects[0].color[1], cena4.objects[0].color[2]);
  shininess(30);
  sphere(cena4.objects[0].radius, 24, 24);
  pop();

  push();
  translate(cena4.objects[1].center.x, cena4.objects[1].center.y, cena4.objects[1].center.z);
  specularMaterial(cena4.objects[1].color[0], cena4.objects[1].color[1], cena4.objects[1].color[2]);
  shininess(30);
  sphere(cena4.objects[1].radius, 24, 24);
  pop();

  // Objetos centrais (CSG)
  cena4.csgAnimAngle += 0.005;
  drawCSGObjects();

  // =========================================
  // Raios lançados (visualização melhorada)
  // =========================================
  for (let ray of cena4.rays) {
    // Offset o início do raio para não cobrir a lente da câmera
    let startPoint = p5.Vector.add(ray.origin, p5.Vector.mult(ray.dir, 20));
    let endPoint = ray.hitPoint ? ray.hitPoint : p5.Vector.add(ray.origin, p5.Vector.mult(ray.dir, 500));
    let dist = p5.Vector.dist(startPoint, endPoint);
    let midPoint = p5.Vector.lerp(startPoint, endPoint, 0.5);

    push();
    translate(midPoint.x, midPoint.y, midPoint.z);
    
    // Alinhar cilindro com a direção do raio
    let up = createVector(0, 1, 0);
    let axis = p5.Vector.cross(up, ray.dir);
    let angle = acos(up.dot(ray.dir));
    if (axis.magSq() > 0.0001) {
      axis.normalize();
      rotate(angle, axis);
    } else if (up.dot(ray.dir) < 0) {
      rotateX(PI);
    }

    noStroke();
    emissiveMaterial(255, 220, 50); // Raio amarelo brilhante
    cylinder(1.5, dist, 12, 1);
    pop();

    // Ponto de interseção
    if (ray.hitPoint) {
      push();
      translate(ray.hitPoint.x, ray.hitPoint.y, ray.hitPoint.z);
      noStroke();
      emissiveMaterial(255, 50, 50);
      sphere(6);
      pop();
    }
  }

  // =========================================
  // OBJETO PORTAL: SETA (ID 10)
  // =========================================
  push();
  translate(160, -40, 50); // Canto direito
  cena4.portalPulse += 0.05;
  let pulseScale = 1.0 + 0.1 * sin(cena4.portalPulse);
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

function drawCSGObjects() {
  let objA = cena4.objects[2];
  let objB = cena4.objects[3];

  push();
  if (cena4.csgMode === 0) {
    // 0: Nenhuma (A e B transparentes)
    drawSphere(objA, 100);
    drawSphere(objB, 100);

  } else if (cena4.csgMode === 1) {
    // 1: União (A e B sólidos, mesma cor para parecerem fundidos)
    let mergedColor = [150, 150, 255];
    drawSphere({ ...objA, color: mergedColor }, 255);
    drawSphere({ ...objB, color: mergedColor }, 255);

  } else if (cena4.csgMode === 2) {
    // 2: Interseção (BlendMode ADD para destacar a sobreposição)
    blendMode(ADD);
    drawSphere(objA, 150);
    drawSphere(objB, 150);
    blendMode(BLEND); // Restaurar

  } else if (cena4.csgMode === 3) {
    // 3: Diferença (A - B) usando erase()
    drawSphere(objA, 255);
    
    // Usar erase para fazer um buraco perfeito no canvas usando a geometria de B
    erase(255, 255);
    push();
    translate(objB.center.x, objB.center.y, objB.center.z);
    sphere(objB.radius + 1, 32, 32); // Raio levemente maior para evitar z-fighting
    pop();
    noErase();
  }
  pop();
}

function drawSphere(obj, alpha) {
  push();
  translate(obj.center.x, obj.center.y, obj.center.z);
  fill(obj.color[0], obj.color[1], obj.color[2], alpha);
  specularMaterial(obj.color[0], obj.color[1], obj.color[2]);
  shininess(40);
  sphere(obj.radius, 32, 32); // Alta resolução
  pop();
}

function drawCena4Pick() {
  pickBuffer.camera(
    cena4.camPos.x, cena4.camPos.y, cena4.camPos.z,
    cena4.camTarget.x, cena4.camTarget.y, cena4.camTarget.z,
    0, 1, 0
  );
  pickBuffer.perspective(PI / 3, width / height, 0.1, 2000);

  // Objetos individuais
  for (let i = 0; i < cena4.objects.length; i++) {
    let obj = cena4.objects[i];
    pickBuffer.push();
    pickBuffer.translate(obj.center.x, obj.center.y, obj.center.z);
    setPickID(i + 1); // IDs 1-4
    pickBuffer.sphere(obj.radius, 24, 24);
    pickBuffer.pop();
  }

  // Portal Seta (ID 10)
  pickBuffer.push();
  pickBuffer.translate(160, -40, 50);
  pickBuffer.rotateZ(-PI/2);
  pickBuffer.rotateX(frameCount * 0.02);
  setPickID(10);
  pickBuffer.push(); pickBuffer.translate(0, -10, 0); pickBuffer.cylinder(5, 20); pickBuffer.pop();
  pickBuffer.push(); pickBuffer.translate(0, 10, 0); pickBuffer.cone(12, 20); pickBuffer.pop();
  pickBuffer.pop();
}

function clickCena4(pickedID) {
  if (pickedID >= 1 && pickedID <= 2) {
    // Lançar raio para os objetos laterais
    let ray = screenToRay(mouseX, mouseY);
    let obj = cena4.objects[pickedID - 1];

    // Testar AABB
    let tAABB = rayAABBIntersect(ray.origin, ray.dir, obj.aabb);

    let hitPoint = null;
    if (tAABB >= 0) {
      // Testar esfera
      let tSphere = raySphereIntersect(ray.origin, ray.dir, obj.center, obj.radius);
      if (tSphere >= 0) {
        hitPoint = p5.Vector.add(ray.origin, p5.Vector.mult(ray.dir, tSphere));
      }
    }

    cena4.rays.push({
      origin: ray.origin,
      dir: ray.dir,
      hitPoint: hitPoint,
      hitObj: pickedID - 1
    });

    // Limitar número de raios
    if (cena4.rays.length > cena4.maxRays) {
      cena4.rays.shift();
    }
  } else if (pickedID >= 3 && pickedID <= 4) {
    // Ciclar modo CSG para objetos centrais
    cena4.csgMode = (cena4.csgMode + 1) % 4;
  } else if (pickedID === 10) {
    // Portal → Cena 5
    iniciarTransicao(5);
  } else {
    // Clique no vazio: lançar raio que não acerta nada
    let ray = screenToRay(mouseX, mouseY);

    // Testar todos os objetos
    let closestHit = null;
    let closestT = Infinity;
    let hitIdx = -1;

    for (let i = 0; i < cena4.objects.length; i++) {
      let obj = cena4.objects[i];
      let tAABB = rayAABBIntersect(ray.origin, ray.dir, obj.aabb);
      if (tAABB >= 0) {
        let tSphere = raySphereIntersect(ray.origin, ray.dir, obj.center, obj.radius);
        if (tSphere >= 0 && tSphere < closestT) {
          closestT = tSphere;
          closestHit = p5.Vector.add(ray.origin, p5.Vector.mult(ray.dir, tSphere));
          hitIdx = i;
        }
      }
    }

    cena4.rays.push({
      origin: ray.origin,
      dir: ray.dir,
      hitPoint: closestHit,
      hitObj: hitIdx
    });

    if (cena4.rays.length > cena4.maxRays) {
      cena4.rays.shift();
    }
  }
}

function clickCena4Void() {
  // Chamado quando nenhum objeto foi clicado (pickedID === 0)
  let ray = screenToRay(mouseX, mouseY);

  let closestHit = null;
  let closestT = Infinity;
  let hitIdx = -1;

  for (let i = 0; i < cena4.objects.length; i++) {
    let obj = cena4.objects[i];
    let tAABB = rayAABBIntersect(ray.origin, ray.dir, obj.aabb);
    if (tAABB >= 0) {
      let tSphere = raySphereIntersect(ray.origin, ray.dir, obj.center, obj.radius);
      if (tSphere >= 0 && tSphere < closestT) {
        closestT = tSphere;
        closestHit = p5.Vector.add(ray.origin, p5.Vector.mult(ray.dir, tSphere));
        hitIdx = i;
      }
    }
  }

  cena4.rays.push({
    origin: ray.origin,
    dir: ray.dir,
    hitPoint: closestHit,
    hitObj: hitIdx
  });

  if (cena4.rays.length > cena4.maxRays) {
    cena4.rays.shift();
  }
}

function getHUDCena4() {
  let lines = [];
  lines.push("CENA 4: CSG e Ray Casting");
  lines.push("");
  lines.push("Raios lançados: " + cena4.rays.length);
  lines.push("Operação CSG: " + cena4.csgModes[cena4.csgMode]);
  lines.push("");
  lines.push("▶ Clique em qualquer lugar: lançar raio");
  lines.push("▶ Clique nas esferas centrais: ciclar CSG");
  lines.push("   (União → Interseção → Diferença)");
  lines.push("▶ Clique na seta verde (dir.): portal →");
  return lines;
}
