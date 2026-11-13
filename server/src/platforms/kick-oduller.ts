/**
 * B8: Kick kanal ödülleri (docs.kick.com/apis/channel-rewards, 2026-11-13). Saf: doğrulama ve yanıt ayıklama.
 * Uçlar `/public/v1/channels/rewards`; izinler `channel:rewards:read` / `channel:rewards:write`.
 * Kick yalnız ödülü oluşturan uygulamanın onu düzenleyip silmesine izin verir.
 */

export interface KickOdulu {
  id: string;
  baslik: string;
  aciklama: string;
  bedel: number;
  renk: string;
  etkin: boolean;
  duraklatildi: boolean;
  girdiGerekli: boolean;
}

export function odulListesi(veri: any): KickOdulu[] {
  const d = Array.isArray(veri?.data) ? veri.data : [];
  return d.map((r: any) => ({
    id: String(r?.id || ''),
    baslik: String(r?.title || ''),
    aciklama: String(r?.description || ''),
    bedel: Number(r?.cost) || 0,
    renk: String(r?.background_color || ''),
    etkin: r?.is_enabled !== false,
    duraklatildi: r?.is_paused === true,
    girdiGerekli: r?.is_user_input_required === true
  }));
}

/** Panelden gelen alanları Kick gövdesine çevirir; yeni ödülde başlık ve bedel zorunlu. */
export function odulGovdesi(g: any, yeni: boolean): { ok: true; govde: Record<string, unknown> } | { ok: false; hata: string } {
  const govde: Record<string, unknown> = {};
  if (g?.baslik !== undefined) {
    const t = String(g.baslik).trim();
    if (!t || t.length > 50) return { ok: false, hata: 'Başlık 1-50 karakter olmalı' };
    govde.title = t;
  }
  if (g?.bedel !== undefined) {
    const c = Number(g.bedel);
    if (!Number.isInteger(c) || c < 1) return { ok: false, hata: 'Bedel 1 ya da daha büyük tam sayı olmalı' };
    govde.cost = c;
  }
  if (g?.aciklama !== undefined) {
    const a = String(g.aciklama).trim();
    if (a.length > 200) return { ok: false, hata: 'Açıklama en çok 200 karakter' };
    govde.description = a;
  }
  if (g?.renk !== undefined && g.renk !== '') {
    if (!/^#[0-9a-f]{6}$/i.test(String(g.renk))) return { ok: false, hata: 'Renk #rrggbb biçiminde olmalı' };
    govde.background_color = String(g.renk);
  }
  if (typeof g?.etkin === 'boolean') govde.is_enabled = g.etkin;
  if (typeof g?.duraklatildi === 'boolean') govde.is_paused = g.duraklatildi;
  if (typeof g?.girdiGerekli === 'boolean') govde.is_user_input_required = g.girdiGerekli;
  if (yeni && (!govde.title || !govde.cost)) return { ok: false, hata: 'Başlık ve bedel gerekli' };
  if (!Object.keys(govde).length) return { ok: false, hata: 'Değişecek alan yok' };
  return { ok: true, govde };
}

/** Kick ödül kimliği ULID: yol parçasına başka bir şey girmesin */
export const odulKimligiGecerli = (id: string) => /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(id);

/** Gerçek zamanlı `RewardRedeemedEvent` yükü → kim, hangi ödül, yazdığı metin. */
export function odulKullanimi(p: any): { kullanici: string; baslik: string; girdi: string } | null {
  const baslik = String(p?.reward_title ?? p?.reward?.title ?? p?.title ?? '').trim();
  const kullanici = String(p?.username ?? p?.redeemer?.username ?? p?.user?.username ?? '').trim();
  if (!baslik || !kullanici) return null;
  return { kullanici, baslik, girdi: String(p?.user_input ?? p?.input ?? '').slice(0, 500) };
}
