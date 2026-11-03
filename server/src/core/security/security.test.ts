/**
 * AxBoT — güvenlik katmanı testleri
 * Developed by AxthrowA
 *
 * Bu testler denetimde bulunan token sızıntısını (CURRENT_SYSTEM_AUDIT §12,
 * S1-S5) kalıcı olarak kilitler.
 */
import { describe, it, expect } from 'vitest';
import { gizliMi, maskele, temizle, maskeDegeriMi, yeniSirDegeri } from './redact.js';
import {
  yerelKokenMi,
  yazmaYontemiMi,
  baglanmaAdresi,
  baglanmaUyarisi
} from './local-guard.js';

describe('gizliMi', () => {
  it('gerçek sır alanlarını yakalar', () => {
    for (const k of [
      'token',
      'refresh_token',
      'access_token',
      'kick_client_secret',
      'client_secret',
      'gemini_api_key',
      'apiKey',
      'password',
      'private_key'
    ]) {
      expect(gizliMi(k), k).toBe(true);
    }
  });

  it('zararsız alanları sır sanmaz', () => {
    for (const k of [
      'kick_client_id',
      'channel_name',
      'platform',
      'is_active',
      'points',
      'prefix',
      'currency_name',
      'username'
    ]) {
      expect(gizliMi(k), k).toBe(false);
    }
  });

  it('zaman damgası ve durum alanlarını gizlemez', () => {
    // `token_expires_at` sır değil; panel süresi dolmuş tokenı göstermeli.
    expect(gizliMi('token_expires_at')).toBe(false);
    expect(gizliMi('hasToken')).toBe(false);
  });
});

describe('maskele', () => {
  it('uzun değerin son 4 karakterini bırakır', () => {
    expect(maskele('abcdefghijklmnop')).toBe('••••mnop');
  });

  it('kısa değeri tamamen gizler', () => {
    expect(maskele('abc123')).toBe('••••••••');
  });

  it('boş değeri boş bırakır', () => {
    expect(maskele('')).toBe('');
    expect(maskele(null)).toBe('');
    expect(maskele(undefined)).toBe('');
  });
});

describe('temizle', () => {
  it('kanal kaydındaki tokenı maskeler ve varlık bayrağı ekler', () => {
    const kanal = {
      id: 'x',
      platform: 'kick',
      channel_name: 'axthrowa',
      token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1234',
      refresh_token: null,
      is_active: 1
    };
    const c = temizle(kanal) as any;

    expect(c.token).toBe('••••1234');
    expect(c.tokenVar).toBe(true);
    expect(c.refresh_token).toBe('');
    expect(c.refresh_tokenVar).toBe(false);
    // sır olmayan alanlar aynen korunur
    expect(c.channel_name).toBe('axthrowa');
    expect(c.is_active).toBe(1);
  });

  it('dizileri gezer', () => {
    const c = temizle([{ token: 'uzunbirtokendeger' }, { token: '' }]) as any[];
    expect(c[0].token).toBe('••••eger');
    expect(c[1].tokenVar).toBe(false);
  });

  it('ayar sözlüğündeki gizli anahtarları temizler', () => {
    const ayar = {
      prefix: '!',
      kick_client_id: 'ornek-kick-istemci',
      kick_client_secret: 'cok-gizli-bir-anahtar-degeri-1234',
      gemini_api_key: ''
    };
    const c = temizle(ayar) as any;

    expect(c.prefix).toBe('!');
    // client_id sır değil — panelin göstermesi gerekiyor
    expect(c.kick_client_id).toBe('ornek-kick-istemci');
    expect(c.kick_client_secret).toBe('••••1234');
    expect(c.gemini_api_keyVar).toBe(false);
  });

  it('hiçbir çıktıda ham sır bırakmaz', () => {
    const ham = 'SUPERGIZLITOKEN1234567890';
    const metin = JSON.stringify(temizle({ token: ham, nested: { refresh_token: ham } }));
    expect(metin).not.toContain(ham);
  });
});

describe('yeniSirDegeri — kaydetme koruması', () => {
  const mevcut = 'gercek-token-degeri';

  it('maskelenmiş değer gerçek tokenı EZMEZ', () => {
    // Panel maskeyi geri gönderiyor; bu diske yazılırsa token kaybolur.
    expect(yeniSirDegeri('••••1234', mevcut)).toBe(mevcut);
  });

  it('boş değer mevcut tokenı korur', () => {
    expect(yeniSirDegeri('', mevcut)).toBe(mevcut);
    expect(yeniSirDegeri(undefined, mevcut)).toBe(mevcut);
    expect(yeniSirDegeri(null, mevcut)).toBe(mevcut);
  });

  it('gerçek yeni değer yazılır', () => {
    expect(yeniSirDegeri('yeni-token', mevcut)).toBe('yeni-token');
  });

  it('mevcut yokken yeni değer yazılır', () => {
    expect(yeniSirDegeri('ilk-token', null)).toBe('ilk-token');
    expect(yeniSirDegeri('', null)).toBe(null);
  });
});

describe('maskeDegeriMi', () => {
  it('maskeyi tanır', () => {
    expect(maskeDegeriMi('••••1234')).toBe(true);
    expect(maskeDegeriMi('••••••••')).toBe(true);
  });
  it('gerçek değeri maske sanmaz', () => {
    expect(maskeDegeriMi('abc1234')).toBe(false);
    expect(maskeDegeriMi('')).toBe(false);
  });
});

describe('yerelKokenMi', () => {
  it('yerel kökenlere izin verir', () => {
    for (const o of [
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:8843',
      'https://localhost:3001',
      'tauri://localhost'
    ]) {
      expect(yerelKokenMi(o), o).toBe(true);
    }
  });

  it('Origin başlığı yoksa izin verir (aynı köken / OBS / curl)', () => {
    expect(yerelKokenMi(undefined)).toBe(true);
    expect(yerelKokenMi('')).toBe(true);
  });

  it('yabancı kökenleri reddeder', () => {
    for (const o of [
      'https://evil.example',
      'http://evil.example',
      'https://botrix.live',
      'http://192.168.1.50:3001',
      'http://localhost.evil.example'
    ]) {
      expect(yerelKokenMi(o), o).toBe(false);
    }
  });

  it("sandbox iframe'in 'null' kökenini reddeder", () => {
    // Kötü niyetli bir sayfa sandbox iframe ile bunu üretebilir.
    expect(yerelKokenMi('null')).toBe(false);
  });

  it('bozuk köken değerini reddeder', () => {
    expect(yerelKokenMi('not a url')).toBe(false);
    expect(yerelKokenMi('javascript:alert(1)')).toBe(false);
  });
});

describe('yazmaYontemiMi', () => {
  it('yan etkili yöntemleri ayırt eder', () => {
    expect(yazmaYontemiMi('post')).toBe(true);
    expect(yazmaYontemiMi('GET')).toBe(false);
  });
});

describe('baglanmaAdresi', () => {
  it('varsayılan yalnız bu makine', () => {
    expect(baglanmaAdresi({})).toBe('127.0.0.1');
    expect(baglanmaAdresi({ STREAMAXT_HOST: '' })).toBe('127.0.0.1');
  });

  it('kullanıcı açıkça seçerse ağa açılır', () => {
    expect(baglanmaAdresi({ STREAMAXT_HOST: '0.0.0.0' })).toBe('0.0.0.0');
  });

  it('ağa açık bağlamada uyarı verir', () => {
    expect(baglanmaUyarisi('127.0.0.1')).toBeNull();
    expect(baglanmaUyarisi('0.0.0.0')).toContain('UYARI');
    expect(baglanmaUyarisi('192.168.1.5')).toContain('UYARI');
  });
});

describe('webhook adresleri sır sayılır', () => {
  it('Discord webhook adresi maskelenir', () => {
    // Adresi bilen herkes o kanala mesaj atabilir: taşıyıcı kimlik bilgisi.
    expect(gizliMi('webhook')).toBe(true);
    expect(gizliMi('webhookUrl')).toBe(true);
    expect(gizliMi('webhook_url')).toBe(true);
  });

  it('temizle() iç içe webhook alanını da maskeler', () => {
    const c: any = temizle({ kick: { aktif: true, webhook: 'https://discord.com/api/webhooks/1/GIZLI_TOKEN' } });
    expect(c.kick.webhook).not.toContain('GIZLI_TOKEN');
    expect(c.kick.webhook).toBe('••••OKEN');
    expect(c.kick.webhookVar).toBe(true);
    expect(c.kick.aktif).toBe(true);
  });

  it('boş webhook "ayarlı" görünmez', () => {
    const c: any = temizle({ kick: { webhook: '' } });
    expect(c.kick.webhook).toBe('');
    expect(c.kick.webhookVar).toBe(false);
  });

  it('maskeli adres geri gönderilince mevcut değer korunur', () => {
    const mevcut = 'https://discord.com/api/webhooks/1/GIZLI_TOKEN';
    expect(yeniSirDegeri('••••OKEN', mevcut)).toBe(mevcut);
    expect(yeniSirDegeri('', mevcut)).toBe(mevcut);
    expect(yeniSirDegeri('https://discord.com/api/webhooks/2/YENI', mevcut)).toBe(
      'https://discord.com/api/webhooks/2/YENI'
    );
  });
});
