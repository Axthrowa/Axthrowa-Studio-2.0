/**
 * AxBoT — düzenli izleyiciler (regulars)
 * Developed by AxthrowA
 *
 * "regular" kullanıcı düzeyinin karşılığı: yayıncı/mod'un elle
 * eklediği güvenilir izleyiciler. Komut yetkisi `regular` (regular + VIP + mod)
 * ve AutoMod muafiyeti için kullanılır. Bellekte önbellek; her mesajda DB'ye
 * gidilmez.
 */
import { db } from '../../db/index.js';

export interface DuzenliKayit {
  platform: string;
  username: string;
  added_by: string;
  created_at: number;
}

/** Kullanıcı adı: @ atılır, küçük harf; geçersizse null. */
export function duzenliAdi(ham: string): string | null {
  const ad = String(ham || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  return /^[\p{L}\p{N}_.-]{1,40}$/u.test(ad) ? ad : null;
}

class Duzenliler {
  private onbellek: Set<string> | null = null;

  private anahtar(platform: string, ad: string) {
    return `${platform}:${ad}`;
  }

  private yukle(): Set<string> {
    if (this.onbellek) return this.onbellek;
    const s = new Set<string>();
    try {
      for (const r of db.prepare('SELECT platform, username FROM regulars').all() as Array<{ platform: string; username: string }>) {
        s.add(this.anahtar(r.platform, r.username));
      }
    } catch {
      /* tablo henüz yoksa (göç uygulanmadı) boş say */
    }
    this.onbellek = s;
    return s;
  }

  mi(platform: string, username: string): boolean {
    const ad = duzenliAdi(username);
    if (!ad) return false;
    const s = this.yukle();
    return s.has(this.anahtar(platform, ad)) || s.has(this.anahtar('tum', ad));
  }

  ekle(platform: string, username: string, ekleyen: string): 'eklendi' | 'zaten' | 'gecersiz' {
    const ad = duzenliAdi(username);
    if (!ad) return 'gecersiz';
    if (this.yukle().has(this.anahtar(platform, ad))) return 'zaten';
    db.prepare('INSERT OR IGNORE INTO regulars (platform, username, added_by, created_at) VALUES (?, ?, ?, ?)').run(
      platform,
      ad,
      String(ekleyen || '').slice(0, 40),
      Date.now()
    );
    this.yukle().add(this.anahtar(platform, ad));
    return 'eklendi';
  }

  cikar(platform: string, username: string): boolean {
    const ad = duzenliAdi(username);
    if (!ad) return false;
    const r = db.prepare('DELETE FROM regulars WHERE platform = ? AND username = ?').run(platform, ad);
    this.yukle().delete(this.anahtar(platform, ad));
    return Number(r.changes) > 0;
  }

  listele(platform?: string): DuzenliKayit[] {
    try {
      const sql = platform
        ? 'SELECT * FROM regulars WHERE platform = ? ORDER BY created_at DESC'
        : 'SELECT * FROM regulars ORDER BY created_at DESC';
      return (platform ? db.prepare(sql).all(platform) : db.prepare(sql).all()) as unknown as DuzenliKayit[];
    } catch {
      return [];
    }
  }

  /** Sınama ve dışarıdan DB değişikliği için. */
  sifirla() {
    this.onbellek = null;
  }
}

export const duzenliler = new Duzenliler();
