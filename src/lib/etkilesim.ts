/**
 * Etkileşim penceresi (OBS "Interact") için saf yardımcılar: ekrandaki işaretçi konumunu kaynak pikseline çevirme ve
 * tarayıcı klavye/fare olaylarını motorun etkileşim olayına dönüştürme.
 */

export type Kutu = { left: number; top: number; width: number; height: number };

/** İstemci koordinatı → kaynak pikseli (görüntü kutuya en-boy korunarak sığdırılmışsa boşluklar hesaba katılır) */
export function kaynakNoktasi(clientX: number, clientY: number, kutu: Kutu, boyut: [number, number]): [number, number] {
  const oran = Math.min(kutu.width / boyut[0], kutu.height / boyut[1]);
  const g = boyut[0] * oran;
  const h = boyut[1] * oran;
  const x0 = kutu.left + (kutu.width - g) / 2;
  const y0 = kutu.top + (kutu.height - h) / 2;
  const x = Math.round((clientX - x0) / oran);
  const y = Math.round((clientY - y0) / oran);
  return [Math.min(boyut[0] - 1, Math.max(0, x)), Math.min(boyut[1] - 1, Math.max(0, y))];
}

export type Degistiriciler = { shift: boolean; ctrl: boolean; alt: boolean };

export function degistiriciler(e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean }): Degistiriciler {
  return { shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey };
}

/** Fare düğmesi (DOM `button`) → motor adı */
export function dugmeAdi(button: number): "sol" | "orta" | "sag" | null {
  return button === 0 ? "sol" : button === 1 ? "orta" : button === 2 ? "sag" : null;
}

/**
 * Klavye olayı → motor `tus` olayı. `metin` yalnız basılabilir tek karakterde (Enter "\r", Backspace/Tab denetim
 * karakteri olarak); `vkey` Windows sanal tuş kodu (DOM `keyCode` Windows'ta aynı değerdir).
 */
export function tusOlayi(e: { key: string; keyCode: number; shiftKey: boolean; ctrlKey: boolean; altKey: boolean }, birak: boolean): Record<string, unknown> {
  let metin = "";
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey) metin = e.key;
  else if (e.key === "Enter") metin = "\r";
  else if (e.key === "Backspace") metin = "\b";
  else if (e.key === "Tab") metin = "\t";
  return { tur: "tus", metin: birak ? "" : metin, vkey: e.keyCode & 0xff, birak, ...degistiriciler(e) };
}
