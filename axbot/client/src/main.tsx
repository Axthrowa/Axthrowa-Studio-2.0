import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.js';
import { animasyonStiliniEkle } from './lib/animations.js';
import { kabukStiliniEkle } from './lib/kabuklar.js';
import { yaziTipleriniBaslat } from './lib/yaziTipleri.js';

animasyonStiliniEkle();
kabukStiliniEkle();
yaziTipleriniBaslat();

// UI-10: Studio İngilizce seçiliyse gömülü panel (?dil=en) Studio'nun sözlüğüyle çevrilir; OBS'e verilen widget sayfaları Türkçe kalır
if (new URLSearchParams(window.location.search).get('dil') === 'en' && !/^\/(widgets|overlay)/.test(window.location.pathname)) {
  void import('../../../src/i18n/domCeviri.js').then((m) => m.domCeviriBaslat());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
