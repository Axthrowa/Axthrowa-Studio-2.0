/**
 * AxBoT — panel teması seçimi
 * Developed by AxthrowA
 *
 * Renkler `panel-temalari.css`te; burada seçim listesi, önizleme renkleri ve tarayıcıda kalıcı seçim var.
 * Varsayılan temada kök öğeye öznitelik konmaz, panel bugünkü görünümüyle kalır.
 */
import { useSyncExternalStore } from 'react';

export interface PanelTemasi {
  id: string;
  ad: string;
  aciklama: string;
  /** Seçici kartındaki küçük önizleme; zemin ve yüzey CSS'teki --axt-zemin / --axt-yuzey ile aynı olmalı (test denetler). */
  onizleme: { zemin: string; yuzey: string; vurgu: string; metin: string };
}

export const VARSAYILAN_TEMA = 'varsayilan';

export const PANEL_TEMALARI: readonly PanelTemasi[] = [
  { id: VARSAYILAN_TEMA, ad: 'Varsayılan', aciklama: 'Bugünkü koyu görünüm, mor vurgu',
    onizleme: { zemin: '#0b0d12', yuzey: '#12151c', vurgu: '#9810fa', metin: '#e5e7eb' } },
  { id: 'gece-mavisi', ad: 'Gece Mavisi', aciklama: 'Lacivert yüzeyler, buz mavisi vurgu, tepede hafif ışıltı',
    onizleme: { zemin: '#0a0f1c', yuzey: '#101829', vurgu: '#0061da', metin: '#e2e8ef' } },
  { id: 'gun-isigi', ad: 'Gün Işığı', aciklama: 'Açık tema: beyaz kartlar, koyu yazı, yumuşak gölge',
    onizleme: { zemin: '#f4f5f8', yuzey: '#ffffff', vurgu: '#7017e7', metin: '#1f2839' } },
  { id: 'neon-arcade', ad: 'Neon Arcade', aciklama: 'Keskin köşeler, pembe neon kenar, tarama çizgileri',
    onizleme: { zemin: '#07060d', yuzey: '#0f0c1a', vurgu: '#b700a0', metin: '#e6e6ed' } },
  { id: 'murekkep', ad: 'Mürekkep & Kağıt', aciklama: 'Neredeyse tek renk, sepya vurgu, ince kağıt greni',
    onizleme: { zemin: '#0d0c0a', yuzey: '#161512', vurgu: '#7d5a3d', metin: '#e9e7e4' } },
  { id: 'gun-batimi', ad: 'Gün Batımı', aciklama: 'Sıcak yüzeyler, yanık turuncu vurgu, köşede akşam ışığı',
    onizleme: { zemin: '#120b0d', yuzey: '#1b1215', vurgu: '#ad3200', metin: '#eee5e4' } },
  { id: 'orman', ad: 'Orman', aciklama: 'Yosun tonlu yüzeyler, yeşim vurgu, yuvarlak köşeler',
    onizleme: { zemin: '#08100c', yuzey: '#0e1812', vurgu: '#007f49', metin: '#e2e9e5' } },
];

const ANAHTAR = 'axt-panel-tema';

/** Bilinmeyen ya da bozuk kayıt varsayılana düşer. */
export function temaKimligi(id: unknown): string {
  return PANEL_TEMALARI.some((t) => t.id === id) ? (id as string) : VARSAYILAN_TEMA;
}

function oku(): string {
  try { return temaKimligi(localStorage.getItem(ANAHTAR)); } catch { return VARSAYILAN_TEMA; }
}

let secili = oku();
/** Studio'dan gelen tema (gömülüyken): kullanıcının bot seçimini ezmez, yalnız bu oturumda geçerli */
let disTema: string | null = null;
const dinleyiciler = new Set<() => void>();

export function disTemaUygula(id: string | null): void {
  disTema = id;
  dinleyiciler.forEach((f) => f());
}

export function panelTemasiSec(id: string): void {
  secili = temaKimligi(id);
  // Depolama kapalıysa seçim yalnız bu oturumda geçerli
  try { localStorage.setItem(ANAHTAR, secili); } catch { /* yok say */ }
  dinleyiciler.forEach((f) => f());
}

function abone(f: () => void): () => void {
  // Başka sekmede değişen seçim buraya da yansır
  const depo = (e: StorageEvent) => { if (e.key === ANAHTAR) { secili = oku(); f(); } };
  dinleyiciler.add(f);
  window.addEventListener('storage', depo);
  return () => { dinleyiciler.delete(f); window.removeEventListener('storage', depo); };
}

export function usePanelTemasi(): string {
  return useSyncExternalStore(abone, () => disTema ?? secili, () => VARSAYILAN_TEMA);
}
