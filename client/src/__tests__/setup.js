import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

const memoryStorage = (() => {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
  writable: true,
});

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
  })),
  writable: true,
});

beforeEach(() => {
  globalThis.localStorage.clear();
});
