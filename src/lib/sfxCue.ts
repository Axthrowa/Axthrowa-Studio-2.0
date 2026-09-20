/**
 * Ses paneli — saf yardımcılar (test edilebilir, bağımlılıksız).
 *
 * ## Düzeltilen iki hata
 * 1. **Yapışan "durdur" bayrağı.** OBS `/sfx` sayfasına komut, `panel` ayarındaki
 *    `_sfxCue` üzerinden gidiyor ve sunucu ayarı *derin birleştiriyor*. `{stop:true}`
 *    yazıldıktan sonra gelen `{file,volume}` eski `stop:true` ile birleşiyor,
 *    her sonraki "çal" komutu OBS'te "durdur" gibi okunuyordu (kayıtlı değer:
 *    `{file, id, stop:true, t, volume}`). Artık iki komut da TÜM alanları açıkça
 *    yazar; `null` derin birleştirmede alanı ezer.
 * 2. **Durdurulamayan ses.** Aynı tuşa tekrar basmak hiçbir şey yapmıyor, uzun
 *    bir parça (ör. film müziği) başlayınca durdurmanın yolu yoktu; basılı
 *    tutulan tuş da otomatik tekrarla kuyruğa birden çok kopya ekleyebiliyordu.
 */

export type SfxCuePayload = {
  id: string;
  stop: boolean;
  file: string | null;
  volume: number | null;
  t: number;
};

export function buildPlayCue(id: string, file: string, volume: number, now: number): SfxCuePayload {
  return { id, stop: false, file, volume, t: now };
}

export function buildStopCue(id: string, now: number): SfxCuePayload {
  // file/volume null: önceki çal komutundan artakalan alanlar temizlensin.
  return { id, stop: true, file: null, volume: null, t: now };
}

/** Bir komutun bayat sayıldığı süre: OBS sayfası yeniden yüklenince eski komut tekrar çalmasın. */
export const CUE_MAX_AGE_MS = 8000;

export function isStaleCue(cue: { t?: unknown } | null | undefined, now: number): boolean {
  const t = Number(cue?.t);
  if (!Number.isFinite(t) || t <= 0) return false; // zaman damgası yoksa (mağaza komutu) yalnız kimlikle elenir
  return now - t > CUE_MAX_AGE_MS;
}

export type TriggerDecision = "ignore" | "stop" | "play";

/** Aynı ses tuşunun art arda tetiklenmesi bu süreden kısaysa otomatik tekrar sayılır. */
export const RETRIGGER_GUARD_MS = 350;

/**
 * Bir ses tuşuna basılınca ne yapılacağı.
 * - kısa süre önce aynı ses tetiklendiyse → `ignore` (basılı tutma / çift olay)
 * - o ses şu an çalıyor ya da kuyrukta → `stop` (aynı tuşla durdur)
 * - aksi halde → `play`
 */
export function decidePadTrigger(input: {
  padId: string;
  activePadId: string | null;
  queuedPadIds: string[];
  lastTriggerAt: number | undefined;
  now: number;
}): TriggerDecision {
  if (input.lastTriggerAt !== undefined && input.now - input.lastTriggerAt < RETRIGGER_GUARD_MS) {
    return "ignore";
  }
  if (input.activePadId === input.padId || input.queuedPadIds.includes(input.padId)) return "stop";
  return "play";
}
