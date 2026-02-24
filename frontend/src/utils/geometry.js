import * as THREE from 'three';

/**
 * Determina si una secuencia de puntos forma un polígono en sentido horario.
 * @param {Array<{x: number, y: number}>} pts - Puntos del polígono
 * @returns {boolean}
 */
export function isClockWise(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    sum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  return sum > 0;
}

/**
 * Parsea un SVG path d (comandos M, L, C, Z) y retorna un THREE.Shape.
 * Soporta curvas cúbicas Bézier (C) además de líneas (L).
 * Transforma Y con negación para alinear con el sistema de coordenadas Three.js.
 *
 * @param {string} d - Atributo d de un <path> SVG.
 * @param {string[]} agujerosPaths - Array de strings d para agujeros (holes).
 * @returns {THREE.Shape}
 */
export function parseSVGPathToThreeShape(d, agujerosPaths = []) {
  function buildPathFromD(pathStr, target) {
    const tokens = pathStr.match(/[MLCZmlcz][^MLCZmlcz]*/g) || [];
    for (const token of tokens) {
      const cmd  = token[0].toUpperCase();
      const nums = token.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (cmd === 'M') {
        target.moveTo(nums[0], -nums[1]);
      } else if (cmd === 'L') {
        target.lineTo(nums[0], -nums[1]);
      } else if (cmd === 'C') {
        for (let i = 0; i + 5 < nums.length; i += 6) {
          target.bezierCurveTo(
            nums[i],     -nums[i + 1],
            nums[i + 2], -nums[i + 3],
            nums[i + 4], -nums[i + 5]
          );
        }
      }
      // Z: Three.js cierra el path automáticamente al construir la geometría
    }
  }

  const shape = new THREE.Shape();
  buildPathFromD(d, shape);

  for (const holePath of agujerosPaths) {
    const hole = new THREE.Path();
    buildPathFromD(holePath, hole);
    shape.holes.push(hole);
  }

  return shape;
}
