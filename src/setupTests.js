import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';

const createStorageMock = () => {
  let store = {};

  const storage = {
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index) => Object.keys(store)[index] ?? null),
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };

  return new Proxy(storage, {
    get(target, property) {
      if (property in target) return target[property];
      return store[property];
    },
    set(target, property, value) {
      if (property in target) {
        target[property] = value;
      } else {
        store[property] = String(value);
      }
      return true;
    },
    deleteProperty(target, property) {
      if (property in target) {
        return delete target[property];
      }
      delete store[property];
      return true;
    },
  });
};

const installStorageMock = (name) => {
  const storage = createStorageMock();
  Object.defineProperty(window, name, {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: storage,
  });
};

installStorageMock('localStorage');
installStorageMock('sessionStorage');

vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => React.createElement('div', { 'data-testid': 'lottie-animation' }),
}));
