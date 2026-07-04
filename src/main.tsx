// Safeguard against sandbox/iframe environment read-only fetch TypeError
(function() {
  try {
    const target = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : self;
    if (target && target.fetch) {
      const originalFetch = target.fetch;
      let customFetch = originalFetch;
      Object.defineProperty(target, 'fetch', {
        get() {
          return customFetch;
        },
        set(value) {
          customFetch = value;
        },
        configurable: true,
        enumerable: true
      });
    }
  } catch (e) {
    console.warn("Could not redefine fetch with custom setter:", e);
  }
})();

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
