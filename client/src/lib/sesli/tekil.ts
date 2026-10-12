/**
 * StreamAxT — Panel içinde tek dinleyici (sekme değişse de sürer)
 * Developed by AxthrowA
 */
import { SesliDinleyici, sunucuyaGonder } from './dinleyici.js';

let dinleyici: SesliDinleyici | null = null;

/** Bu penceredeki dinleyici (ilk çağrıda oluşur). Sayfa bileşenleri kapansa da yaşar. */
export function panelDinleyicisi(): SesliDinleyici {
  if (!dinleyici) dinleyici = new SesliDinleyici(sunucuyaGonder);
  return dinleyici;
}

/** Tarayıcı ses bağlamını kullanıcı etkileşimi olmadan başlatmayabilir; ilk tık/tuşta yeniden dene */
export function etkilesimdeSur(f: () => void) {
  const bir = () => {
    window.removeEventListener('pointerdown', bir);
    window.removeEventListener('keydown', bir);
    f();
  };
  window.addEventListener('pointerdown', bir, { once: true });
  window.addEventListener('keydown', bir, { once: true });
}
