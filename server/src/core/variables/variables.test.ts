/**
 * AxBoT — değişken motoru testleri
 * Developed by AxthrowA
 *
 * Yalnız saf modüller test edilir (resolve / pure / net / store ifadesi):
 * `registry.ts` veritabanını açtığı için buradan yüklenmez — testler
 * geliştirme veritabanına dokunmamalı.
 */
import { describe, it, expect } from 'vitest';
import dns from 'node:dns';
import {
  enIcteki,
  adVeArguman,
  noktaliBol,
  platformKosullari,
  gizliMetniSil,
  bosluklariTopla,
  coz,
  kacisiGeriAl,
  veriKacisla,
  type Kayit
} from './resolve.js';
import { matematik, jsonYolu, jsonYoluYaz, jsonYoluSil, jsonDegeri, sureMetni, sayacIfadesi } from './pure.js';
import { adresGuvenliMi, guvenliGetir, guvenliLookup, ozelIpMi, yasakIpMi } from './net.js';
import http from 'node:http';
import type { DegiskenBaglam, DegiskenTanimi } from './types.js';

// ---- Yardımcılar ------------------------------------------------------------

function baglam(ek: Partial<DegiskenBaglam> = {}): DegiskenBaglam {
  return {
    user: { username: 'axthrowa', displayName: 'AxthrowA', isMod: true },
    platform: 'kick',
    channel: 'axthrowa',
    args: [],
    rawArgs: '',
    yerel: new Map(),
    ...ek
  };
}

function sahteKayit(tanimlar: Record<string, DegiskenTanimi['isleyici']>): Kayit {
  const m: Kayit = new Map();
  for (const [ad, isleyici] of Object.entries(tanimlar)) {
    m.set(ad, { ad, grup: 'text', aciklama: '', isleyici });
  }
  return m;
}

// ---- Ayrıştırma -------------------------------------------------------------

describe('enIcteki', () => {
  it('tek değişkeni bulur', () => {
    expect(enIcteki('Merhaba $(sender)!')).toEqual({ bas: 8, bit: 16, ic: 'sender' });
  });

  it('İÇ İÇE ifadede en içtekini bulur', () => {
    const r = enIcteki('$(upper $(sender))');
    expect(r?.ic).toBe('sender');
  });

  it('değişken yoksa null döner', () => {
    expect(enIcteki('düz metin')).toBeNull();
    expect(enIcteki('')).toBeNull();
  });

  it('kapanmamış parantezi yok sayar', () => {
    expect(enIcteki('$(bozuk')).toBeNull();
  });

  it('DÜZ parantez içeren ifadeyi erken kesmez', () => {
    // Regresyon: `$(math 12 * (3 + 4))` ilk `)` işaretinde kesiliyordu ve
    // matematik "(math geçersiz))" döndürüyordu.
    const r = enIcteki('$(math 12 * (3 + 4))');
    expect(r?.ic).toBe('math 12 * (3 + 4)');
  });

  it('iç içe değişken + düz parantez birlikte', () => {
    const r = enIcteki('$(upper $(math (2+3)))');
    expect(r?.ic).toBe('math (2+3)');
  });
});

describe('adVeArguman', () => {
  it('argümansız', () => {
    expect(adVeArguman('sender')).toEqual({ ad: 'sender', ham: '' });
  });
  it('argümanlı', () => {
    expect(adVeArguman('random 0 10')).toEqual({ ad: 'random', ham: '0 10' });
  });
  it('adı küçük harfe çevirir (örnek alınan bot şablonları karışık yazıyor)', () => {
    expect(adVeArguman('addPoints 100').ad).toBe('addpoints');
  });
});

describe('noktaliBol', () => {
  it('noktalı virgülle böler ve kırpar', () => {
    expect(noktaliBol('a; b ;c')).toEqual(['a', 'b', 'c']);
  });
});

// ---- Platform koşulları -----------------------------------------------------

describe('platformKosullari', () => {
  it('eşleşen platformun içeriğini bırakır', () => {
    const s = 'Selam!<ifKick> kick özel</ifKick><ifTwitch> twitch özel</ifTwitch>';
    expect(platformKosullari(s, 'kick')).toBe('Selam! kick özel');
    expect(platformKosullari(s, 'twitch')).toBe('Selam! twitch özel');
    expect(platformKosullari(s, 'youtube')).toBe('Selam!');
  });

  it('büyük/küçük harf duyarsız', () => {
    expect(platformKosullari('<ifkick>x</ifkick>', 'KICK')).toBe('x');
  });

  it('çok satırlı içeriği taşır', () => {
    expect(platformKosullari('<ifKick>a\nb</ifKick>', 'kick')).toBe('a\nb');
  });
});

describe('gizliMetniSil', () => {
  it('hideText içeriğini çıktıdan siler', () => {
    expect(gizliMetniSil('Başlık değişti. <hideText>$(settitle Yeni)</hideText>')).toBe(
      'Başlık değişti. '
    );
  });
});

describe('bosluklariTopla', () => {
  it('silinen etiketlerden kalan boşluğu toparlar', () => {
    expect(bosluklariTopla('a    b  ')).toBe('a b');
  });
});

// ---- Çözümleme --------------------------------------------------------------

describe('coz', () => {
  const kayit = sahteKayit({
    sender: (_h, c) => c.user.displayName,
    upper: (h) => h.toLocaleUpperCase('tr-TR'),
    echo: (h) => h,
    sayi: () => '42',
    patlar: () => {
      throw new Error('bilerek');
    }
  });

  it('basit değişkeni çözer', async () => {
    expect(await coz('Merhaba $(sender)!', kayit, baglam())).toBe('Merhaba AxthrowA!');
  });

  it('birden çok değişkeni çözer', async () => {
    expect(await coz('$(sender) - $(sayi)', kayit, baglam())).toBe('AxthrowA - 42');
  });

  it('İÇ İÇE değişkeni içten dışa çözer', async () => {
    expect(await coz('$(upper $(sender))', kayit, baglam())).toBe('AXTHROWA');
  });

  it('tanımsız değişkeni işaretler, sonsuz döngüye girmez', async () => {
    expect(await coz('$(olmayan)', kayit, baglam())).toBe('(olmayan?)');
  });

  it('patlayan değişken komutu çökertmez', async () => {
    expect(await coz('x $(patlar) y', kayit, baglam())).toBe('x (patlar hata) y');
  });

  it('eski biçim Rand[] çalışır', async () => {
    const s = await coz('Rand[5,5]', kayit, baglam());
    expect(s).toBe('5');
  });

  it('RandomList[] listeden seçer', async () => {
    const s = await coz('RandomList[tek]', kayit, baglam());
    expect(s).toBe('tek');
  });

  it('platform koşulunu uygular', async () => {
    const s = await coz('<ifKick>K</ifKick><ifTwitch>T</ifTwitch>', kayit, baglam({ platform: 'kick' }));
    expect(s).toBe('K');
  });

  it('hideText yan etkisi çalışır ama çıktıya yazılmaz', async () => {
    const s = await coz('Tamam. <hideText>$(echo gizli)</hideText>', kayit, baglam());
    expect(s).toBe('Tamam.');
    expect(s).not.toContain('gizli');
  });

  it('parantezli matematik doğru çözülür', async () => {
    const k = sahteKayit({ math: (h) => String(h) });
    expect(await coz('$(math 12 * (3 + 4))', k, baglam())).toBe('12 * (3 + 4)');
  });

  it('boş şablon boş döner', async () => {
    expect(await coz('', kayit, baglam())).toBe('');
  });

  it('değişken içermeyen metni değiştirmez', async () => {
    expect(await coz('sadece düz metin', kayit, baglam())).toBe('sadece düz metin');
  });
});

describe('coz — sınırlar', () => {
  it('çıktı üst sınırı aşamaz', async () => {
    const kayit = sahteKayit({ uzun: () => 'x'.repeat(5000) });
    const s = await coz('$(uzun)', kayit, baglam());
    expect(s.length).toBeLessThanOrEqual(4000);
  });

  it('çok sayıda değişkende sınıra takılır ama döner', async () => {
    const kayit = sahteKayit({ a: () => 'x' });
    const sablon = '$(a)'.repeat(60);
    const s = await coz(sablon, kayit, baglam());
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
  });
});

describe('coz — test kipi', () => {
  it('yazan değişkenleri test kipinde ATLAR', async () => {
    let yazildi = false;
    const kayit: Kayit = new Map([
      [
        'addpoints',
        {
          ad: 'addpoints',
          grup: 'loyalty' as const,
          aciklama: '',
          yazar: true,
          isleyici: () => {
            yazildi = true;
            return '100';
          }
        }
      ]
    ]);

    await coz('$(addPoints 100)', kayit, baglam({ isTest: true }));
    expect(yazildi).toBe(false);

    await coz('$(addPoints 100)', kayit, baglam({ isTest: false }));
    expect(yazildi).toBe(true);
  });
});

describe('coz — şablon enjeksiyonu (güvenlik, 4. tur)', () => {
  function kayitVeCagrilar() {
    const cagrilar: string[] = [];
    const kayit = sahteKayit({
      query: (_h, c) => c.rawArgs,
      urlfetch: (h) => {
        cagrilar.push(h);
        return 'getirildi';
      },
      upper: (h) => h.toUpperCase(),
      urlencode: (h) => encodeURIComponent(h),
      yabanci: () => '$(urlfetch http://saldirgan) fetch[http://x] <hideText>gizli</hideText>'
    });
    return { kayit, cagrilar };
  }

  it('izleyici metnindeki $(...) ÇALIŞMAZ, aynen görünür', async () => {
    const { kayit, cagrilar } = kayitVeCagrilar();
    const s = await coz('Yazdın: $(query)', kayit, baglam({ rawArgs: '$(urlfetch http://saldirgan/x)' }));
    expect(s).toBe('Yazdın: $(urlfetch http://saldirgan/x)');
    expect(cagrilar).toEqual([]);
  });

  it('eski biçimler (fetch[...], <hideText>, <ifKick>) izleyici metninde çalışmaz', async () => {
    const { kayit, cagrilar } = kayitVeCagrilar();
    const s = await coz('$(query)', kayit, baglam({ rawArgs: 'fetch[http://x] <hideText>a</hideText> <ifTwitch>b</ifTwitch>' }));
    expect(s).toBe('fetch[http://x] <hideText>a</hideText> <ifTwitch>b</ifTwitch>');
    expect(cagrilar).toEqual([]);
  });

  it('bir değişkenin ÇIKTISI da kod olarak çalışmaz (getirilen sayfa, saklanan değer)', async () => {
    const { kayit, cagrilar } = kayitVeCagrilar();
    const s = await coz('$(yabanci)', kayit, baglam());
    expect(s).toContain('$(urlfetch http://saldirgan)');
    expect(s).toContain('<hideText>gizli</hideText>');
    expect(cagrilar).toEqual([]);
  });

  it('izleyici parantezi dış değişkenin argümanını kesemez', async () => {
    const { kayit } = kayitVeCagrilar();
    expect(await coz('$(upper $(query))', kayit, baglam({ rawArgs: 'a) b $(x' }))).toBe('A) B $(X');
  });

  it('işleyici gerçek metni görür (urlencode bozulmaz)', async () => {
    const { kayit } = kayitVeCagrilar();
    expect(await coz('$(urlencode $(query))', kayit, baglam({ rawArgs: 'a<b>[c]{d}$e' }))).toBe(
      encodeURIComponent('a<b>[c]{d}$e')
    );
  });

  it('şablon yazarının kendi fetch[...] ve etiketleri çalışmaya devam eder', async () => {
    const { kayit, cagrilar } = kayitVeCagrilar();
    const s = await coz('fetch[https://ornek.com] <ifKick>kick</ifKick>', kayit, baglam());
    expect(s).toBe('getirildi kick');
    expect(cagrilar).toEqual(['https://ornek.com']);
  });

  it('yerine koyma kalıpları ($&, $1) metni bozmaz', async () => {
    const { kayit } = kayitVeCagrilar();
    expect(await coz('[$(query)]', kayit, baglam({ rawArgs: "$& $1 $' $`" }))).toBe("[$& $1 $' $`]");
  });
});

describe('veriKacisla / kacisiGeriAl', () => {
  it('gidiş-dönüş kayıpsız', () => {
    const s = 'a $(b) {c} <d> [e] $& ;';
    expect(kacisiGeriAl(veriKacisla(s))).toBe(s);
    expect(veriKacisla(s)).not.toMatch(/[$(){}<>[\]]/);
  });
});

// ---- Saf yardımcılar --------------------------------------------------------

describe('matematik', () => {
  it('işlem yapar', () => {
    expect(matematik('5 * 5')).toBe('25');
    expect(matematik('10 / 4')).toBe('2.5');
    expect(matematik('(2 + 3) * 4')).toBe('20');
  });

  it('kod yürütmeyi engeller', () => {
    // Beyaz liste harf içeren her şeyi reddeder — enjeksiyon kapısı kapalı.
    expect(matematik('process.exit(1)')).toBe('(math geçersiz)');
    expect(matematik('require("fs")')).toBe('(math geçersiz)');
    expect(matematik('globalThis')).toBe('(math geçersiz)');
    expect(matematik('1;console.log(1)')).toBe('(math geçersiz)');
  });

  it('bozuk ifadeyi yakalar', () => {
    expect(matematik('1 +')).toBe('(math geçersiz)');
    expect(matematik('1/0')).toBe('(math geçersiz)');
  });

  it('boş girdide 0 döner', () => {
    expect(matematik('')).toBe('0');
  });
});

describe('jsonYolu', () => {
  const veri = { profile: { coins: 5 }, stats: { wins: 2 }, items: [{ name: 'kılıç' }, { name: 'kalkan' }] };

  it('noktalı yolu okur', () => {
    expect(jsonYolu(veri, 'stats.wins')).toBe(2);
    expect(jsonYolu(veri, 'profile.coins')).toBe(5);
  });

  it('dizi indeksini okur', () => {
    expect(jsonYolu(veri, 'items[0].name')).toBe('kılıç');
    expect(jsonYolu(veri, 'items[1].name')).toBe('kalkan');
  });

  it('olmayan yolda undefined döner', () => {
    expect(jsonYolu(veri, 'yok.bir.yer')).toBeUndefined();
  });
});

describe('sureMetni', () => {
  it('dakika ve saati yazar', () => {
    expect(sureMetni(90 * 60 * 1000)).toContain('saat');
    expect(sureMetni(5 * 60 * 1000)).toBe('5 dakika');
  });
  it('geçmiş kipinde "önce" ekler', () => {
    expect(sureMetni(5 * 60 * 1000, true)).toBe('5 dakika önce');
  });
  it('çok kısa süreyi yuvarlar', () => {
    expect(sureMetni(500)).toBe('birkaç saniye');
  });
});

describe('sayacIfadesi', () => {
  it('göreli artış', () => {
    expect(sayacIfadesi('+1')).toEqual({ tur: 'fark', deger: 1 });
    expect(sayacIfadesi('-10')).toEqual({ tur: 'fark', deger: -10 });
  });
  it('mutlak değer', () => {
    expect(sayacIfadesi('50')).toEqual({ tur: 'mutlak', deger: 50 });
  });
  it('boş girdi okuma', () => {
    expect(sayacIfadesi('').tur).toBe('oku');
    expect(sayacIfadesi('abc').tur).toBe('oku');
  });
});

// ---- Ağ güvenliği (SSRF) ----------------------------------------------------

describe('ozelIpMi', () => {
  it('özel aralıkları tanır', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.1.1', '0.0.0.0']) {
      expect(ozelIpMi(ip), ip).toBe(true);
    }
  });
  it('genel adresleri geçirir', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      expect(ozelIpMi(ip), ip).toBe(false);
    }
  });
});

describe('adresGuvenliMi', () => {
  it('kendi API adresimizi ENGELLER', () => {
    // Bu olmasaydı bir izleyici fetch[http://127.0.0.1:3001/api/platforms]
    // yazıp OAuth tokenını sohbete bastırabilirdi.
    expect(adresGuvenliMi('http://127.0.0.1:3001/api/platforms').ok).toBe(false);
    expect(adresGuvenliMi('http://localhost:3001/api/settings').ok).toBe(false);
  });

  it('özel ağ adreslerini engeller', () => {
    expect(adresGuvenliMi('http://192.168.1.50/').ok).toBe(false);
    expect(adresGuvenliMi('http://169.254.169.254/latest/meta-data/').ok).toBe(false);
  });

  it('http olmayan şemaları engeller', () => {
    expect(adresGuvenliMi('file:///etc/passwd').ok).toBe(false);
    expect(adresGuvenliMi('ftp://example.com').ok).toBe(false);
  });

  it('bozuk adresi engeller', () => {
    expect(adresGuvenliMi('şey değil').ok).toBe(false);
  });

  it('normal dış adrese izin verir', () => {
    expect(adresGuvenliMi('https://api.example.com/data').ok).toBe(true);
    expect(adresGuvenliMi('http://example.com').ok).toBe(true);
  });
});

describe('SSRF — IPv6 ve alan adı çözümlemesi (4. tur)', () => {
  it('IPv4 eşlemeli / gömülü IPv6 biçimleri yerel sayılır', () => {
    for (const ip of ['::ffff:127.0.0.1', '::ffff:7f00:1', '::1', '::', 'fd00::1', 'fe80::1', '64:ff9b::7f00:1', '2002:c0a8:101::1', 'ff02::1']) {
      expect(yasakIpMi(ip), ip).toBe(true);
    }
    for (const ip of ['2606:4700:4700::1111', '8.8.8.8']) {
      expect(yasakIpMi(ip), ip).toBe(false);
    }
    expect(yasakIpMi('bozuk')).toBe(true);
  });

  it('metin biçiminde gizlenmiş yerel adresleri engeller', () => {
    // Eskiden ::ffff:127.0.0.1 doğrudan kendi API'mize gidiyordu
    expect(adresGuvenliMi('http://[::ffff:127.0.0.1]:3001/api/platforms').ok).toBe(false);
    expect(adresGuvenliMi('http://2130706433:3001/').ok).toBe(false);
    expect(adresGuvenliMi('http://0x7f.1/').ok).toBe(false);
    expect(adresGuvenliMi('http://api.localhost/').ok).toBe(false);
    expect(adresGuvenliMi('https://example.com/').ok).toBe(true);
  });

  it('çözümleme yerel adrese çıkarsa bağlantı kurulmaz', async () => {
    const hata = await new Promise<NodeJS.ErrnoException | null>((coz) =>
      guvenliLookup('localhost', {}, (e) => coz(e))
    );
    expect(hata?.code).toBe('ESSRF');
  });

  it('metin denetimini atlatan alan adı (sondaki nokta) yerel sunucuya ulaşamaz', async (ctx) => {
    // Ön koşul: işletim sistemi `localhost.` adını geri döngüye çözmeli (Windows çözer; bazı
    // yalıtılmış Linux ortamları çözemez — o durumda istek zaten gidemez, denenecek bir şey yok).
    const cozulur = await new Promise<boolean>((coz) => dns.lookup('localhost.', (hata) => coz(!hata)));
    if (!cozulur) ctx.skip();
    let istekGeldi = false;
    const sunucu = http.createServer((_, res) => {
      istekGeldi = true;
      res.end('gizli-token');
    });
    await new Promise<void>((coz) => sunucu.listen(0, '127.0.0.1', () => coz()));
    const port = (sunucu.address() as { port: number }).port;
    try {
      // "localhost." yasak listesindeki "localhost" ile eşleşmez; çözümleme yakalar
      const sonuc = await guvenliGetir(`http://localhost.:${port}/`);
      expect(sonuc).toBe('(fetch: özel ağ adresi engelli)');
      expect(istekGeldi).toBe(false);
    } finally {
      sunucu.close();
    }
  });
});

describe('jsonset / jsonunset yardımcıları (örnek alınan bot belgesindeki örnekler)', () => {
  it('yol yazar, ara nesneleri kurar; değer JSON ise türüyle saklanır', () => {
    expect(JSON.stringify(jsonYoluYaz({}, 'stats.wins', jsonDegeri('2')))).toBe('{"stats":{"wins":2}}');
    expect(JSON.stringify(jsonYoluYaz({ a: 1 }, 'items[0].name', jsonDegeri('sword')))).toBe('{"a":1,"items":[{"name":"sword"}]}');
    expect(jsonDegeri('true')).toBe(true);
    expect(jsonDegeri('merhaba dünya')).toBe('merhaba dünya');
    expect(JSON.stringify(jsonYoluYaz('düz metin', 'x', 1))).toBe('{"x":1}');
  });

  it('girdiyi değiştirmez (kopya döner)', () => {
    const v = { stats: { wins: 1 } };
    jsonYoluYaz(v, 'stats.wins', 5);
    expect(v.stats.wins).toBe(1);
  });

  it('yol siler; dizi indisinde eleman çıkarır; olmayan yol veriyi aynen bırakır', () => {
    expect(JSON.stringify(jsonYoluSil({ stats: { wins: 2 } }, 'stats.wins'))).toBe('{"stats":{}}');
    expect(JSON.stringify(jsonYoluSil({ l: [1, 2, 3] }, 'l[1]'))).toBe('{"l":[1,3]}');
    expect(JSON.stringify(jsonYoluSil({ a: 1 }, 'x.y'))).toBe('{"a":1}');
  });

  it('prototip kirletmeye açılan yollar reddedilir', () => {
    expect(jsonYoluYaz({}, '__proto__.polluted', true)).toBeNull();
    expect(jsonYoluYaz({}, 'a.constructor.prototype.x', 1)).toBeNull();
    expect(jsonYoluSil({}, '__proto__')).toBeNull();
    expect(({} as any).polluted).toBeUndefined();
    expect(jsonYoluYaz({}, '', 1)).toBeNull();
  });
});
