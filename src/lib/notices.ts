/**
 * Kalıcı hata bildirimleri.
 *
 * Panelde zaten 2,2 saniyelik bir "toast" var; kaybolduğu için "kaydedildi"
 * gibi geçici bilgiler için uygun ama yayını bozan şeyler için değil. OBS
 * bağlantısının kopması ya da arka plan videosunun açılamaması yayın boyunca
 * sürer, dolayısıyla bildirimi de sürmeli.
 *
 * Kayıtlar `id` ile tutuluyor: aynı sorun tekrar bildirilince liste büyümüyor,
 * mevcut kayıt güncelleniyor. Sorun düzelince çağıran taraf `clearNotice` ile
 * kaldırıyor.
 *
 * Depo modül düzeyinde: `OverlayShell` ve `YoutubeBg` hem panel önizlemesinde
 * hem OBS tarayıcı kaynağında çalıştığı için ikisi de buraya yazabiliyor.
 * Bildirimleri **yalnızca panel** gösteriyor — OBS çıktısına hata kutusu
 * düşmesi istenmeyen son şey olurdu.
 */

import { useSyncExternalStore } from "react";

export type NoticeLevel = "error" | "warn";

export type Notice = {
  /** Kararlı kimlik, ör. `"obs"` veya `"yt-video"`. */
  id: string;
  level: NoticeLevel;
  /** Ne oldu. */
  text: string;
  /** Ne yapılmalı. */
  hint?: string;
  at: number;
};

let notices: Notice[] = [];
const listeners = new Set<() => void>();

function yayinla() {
  for (const f of listeners) f();
}

export function pushNotice(n: Omit<Notice, "at">): void {
  const mevcut = notices.find((x) => x.id === n.id);
  // Aynı metinle tekrar bildirim gereksiz render tetiklemesin: yoklama
  // döngüleri aynı hatayı saniyede birkaç kez bildirebiliyor.
  if (mevcut && mevcut.text === n.text && mevcut.hint === n.hint) return;
  notices = [...notices.filter((x) => x.id !== n.id), { ...n, at: Date.now() }];
  yayinla();
}

export function clearNotice(id: string): void {
  if (!notices.some((x) => x.id === id)) return;
  notices = notices.filter((x) => x.id !== id);
  yayinla();
}

export function subscribeNotices(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Geçerli kayıtlar.
 *
 * Dönen referans yalnızca liste gerçekten değişince yenileniyor; her çağrıda
 * yeni bir dizi üretmek {@link useNotices} içindeki `useSyncExternalStore`'u
 * sonsuz render döngüsüne sokuyor.
 */
export function getNotices(): Notice[] {
  return notices;
}

export function useNotices(): Notice[] {
  return useSyncExternalStore(subscribeNotices, getNotices, getNotices);
}
