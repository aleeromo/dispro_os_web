import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver para jsdom (requerido por @react-three/fiber)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
