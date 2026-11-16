import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.js';
import { animasyonStiliniEkle } from './lib/animations.js';
import { kabukStiliniEkle } from './lib/kabuklar.js';

animasyonStiliniEkle();
kabukStiliniEkle();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
