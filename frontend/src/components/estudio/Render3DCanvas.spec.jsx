import { describe, it, expect } from 'vitest';
import { getScaleForRender, Render3DCanvas } from './Render3DCanvas.jsx';

describe('getScaleForRender', () => {
  it('devuelve escala [1, -1, 1] cuando imageWidth está en metros (< 50)', () => {
    expect(getScaleForRender(1)).toEqual([1, -1, 1]);
    expect(getScaleForRender(2.4)).toEqual([1, -1, 1]);
    expect(getScaleForRender(49)).toEqual([1, -1, 1]);
  });

  it('devuelve escala [0.02, -0.02, 0.02] cuando imageWidth está en píxeles (>= 50)', () => {
    expect(getScaleForRender(50)).toEqual([0.02, -0.02, 0.02]);
    expect(getScaleForRender(800)).toEqual([0.02, -0.02, 0.02]);
  });

  it('trata imageWidth 0 como escala píxeles para evitar división rara', () => {
    expect(getScaleForRender(0)).toEqual([0.02, -0.02, 0.02]);
  });
});

describe('Render3DCanvas', () => {
  it('exporta componente y getScaleForRender', () => {
    expect(typeof Render3DCanvas).toBe('function');
    expect(typeof getScaleForRender).toBe('function');
  });
});
