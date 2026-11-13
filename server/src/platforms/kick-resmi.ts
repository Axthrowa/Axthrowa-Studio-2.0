/**
 * Kick resmi API (`api.kick.com/public`) yanıtlarından gereken alanlar (T5). Saf: ağ yok, test edilebilir.
 * Belge: docs.kick.com (2026-11-13). `GET /public/v1/channels` şemasında yayın anahtarı (`stream.key`) da var;
 * o yanıttan yalnız kullanıcı kimliği alınır, yanıt saklanmaz ve günlüğe yazılmaz.
 */
import { kickZamani, type YayinBilgisi } from '../core/live-status-math.js';

/** Aynı yayın resmi uçtan ve kanal sayfasından okunduğunda aynı kimliği alsın (Discord duyurusu tekrarlanmasın) */
export function kickYayinKimligi(baslangic: number | null, yedek: unknown): string {
  return baslangic ? `kick-${Math.floor(baslangic / 1000)}` : String(yedek ?? '');
}

/** `GET /public/v1/users/livestreams?user_id=` → yayın durumu. Kayıt yoksa yayın kapalı. */
export function resmiYayinBilgisi(veri: any, kanal: string): YayinBilgisi | null {
  if (!Array.isArray(veri?.data)) return null; // beklenmeyen biçim: durumu değiştirme
  const ls = veri.data[0];
  if (!ls) return { canli: false, kanal };
  const baslangic = kickZamani(ls.started_at);
  return {
    canli: true,
    baslangic,
    izleyici: Number(ls.viewer_count) || 0,
    baslik: String(ls.title || ''),
    kategori: String(ls.category?.name || ''),
    yayinId: kickYayinKimligi(baslangic, ls.id),
    kanal
  };
}

/** `GET /public/v1/channels?slug=` → yayıncının kullanıcı kimliği */
export function resmiKullaniciKimligi(veri: any): number | undefined {
  const id = Number(veri?.data?.[0]?.broadcaster_user_id);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}
