import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { alanVerisi, oturumaIsle, oturumIskeleti, seOlayinaCevir, srcdocOlustur, yerlestir, httpsYap, BOS_WIDGET } from './ozelWidget';
import { seParcalari, zipAc } from './ozelWidgetZip';

describe('SE alanları', () => {
  it('varsayılan değerler kayıtlı değerlerle birleşir', () => {
    expect(alanVerisi({ alanlar: { a: { type: 'text', value: 'x' }, b: { type: 'number', value: 2 } }, veri: { b: 5 } })).toEqual({ a: 'x', b: 5 });
  });

  it('{{alan}} ve {alan} yalnız bilinen adlarda yerleşir', () => {
    expect(yerlestir('{{renk}} {renk} { renk } {{yok}} const {a} = o', { renk: 'red' })).toBe('red red { renk } {{yok}} const {a} = o');
  });
});

describe('bot iletisi → SE olayı', () => {
  it('sohbet iletisi message dinleyicisine, metin kaçışlanmış', () => {
    const o = seOlayinaCevir({ type: 'chat', data: { id: 'm1', platform: 'kick', channel: 'k', message: '<b>selam</b>', user: { id: 'u1', username: 'ali', displayName: 'Ali', isMod: true } } })!;
    expect(o.listener).toBe('message');
    expect(o.event.data).toMatchObject({ nick: 'ali', displayName: 'Ali', text: '<b>selam</b>', msgId: 'm1', userId: 'u1' });
    expect(o.event.data.badges[0].type).toBe('moderator');
    expect(o.event.renderedText).not.toContain('<b>');
  });

  it('uyarılar SE latest dinleyicilerine', () => {
    expect(seOlayinaCevir({ type: 'alert', subType: 'tip', data: { displayName: 'Ayşe', amount: 50, message: 'hi' } })).toEqual({
      listener: 'tip-latest',
      event: { name: 'Ayşe', displayName: 'Ayşe', isTest: false, type: 'tip', amount: 50, message: 'hi', currency: undefined }
    });
    expect(seOlayinaCevir({ type: 'alert', subType: 'follow', data: { username: 'x' } })?.listener).toBe('follower-latest');
    expect(seOlayinaCevir({ type: 'alert', subType: 'raid', data: { username: 'x', viewers: 9 } })?.event.amount).toBe(9);
    // Tekrar oynatılan uyarı yeni olay sayılmaz
    expect(seOlayinaCevir({ type: 'alert', subType: 'follow', data: {}, alert: { isReplay: true } })).toBeNull();
    expect(seOlayinaCevir({ type: 'widget_settings' })).toBeNull();
  });

  it('oturum sayaçları gerçek olayla artar, test olayıyla artmaz', () => {
    const d0 = oturumIskeleti();
    const d1 = oturumaIsle(d0, { listener: 'tip-latest', event: { name: 'A', amount: 10 } });
    expect(d1['tip-session']).toEqual({ count: 1, amount: 10 });
    expect(d1['tip-latest'].name).toBe('A');
    expect(oturumaIsle(d1, { listener: 'tip-latest', event: { name: 'B', amount: 5, isTest: true } })).toBe(d1);
  });
});

describe('çerçeve belgesi', () => {
  it('protokolsüz CDN adresi https olur', () => {
    expect(httpsYap(`<script src="//cdnjs.x/a.js"></script><a href='//b'>`)).toBe(`<script src="https://cdnjs.x/a.js"></script><a href='https://b'>`);
  });

  it('CSP yerel API bağlantısını kapatır; kullanıcı kodu etiketi kapatamaz', () => {
    const s = srcdocOlustur({ ...BOS_WIDGET, js: "var a='</script><script>kotu()';", css: '</style><script>x</script>' });
    expect(s).toContain("connect-src https: wss:");
    expect(s).not.toMatch(/connect-src[^;"]*(http:|\*|'self')/);
    expect(s).toContain(String.raw`<\/script><script>kotu()`);
    expect(s).not.toContain('</style><script>x');
  });
});

/** Basit zip (deflate) kurucu: yerel başlıklar + merkezi dizin */
function zip(dosyalar: Record<string, string>): ArrayBuffer {
  const parcalar: Buffer[] = [];
  const dizin: Buffer[] = [];
  let ofs = 0;
  for (const [ad, metin] of Object.entries(dosyalar)) {
    const ham = Buffer.from(metin);
    const sik = deflateRawSync(ham);
    const adB = Buffer.from(ad);
    const yerel = Buffer.alloc(30);
    yerel.writeUInt32LE(0x04034b50, 0);
    yerel.writeUInt16LE(8, 8);
    yerel.writeUInt32LE(sik.length, 18);
    yerel.writeUInt32LE(ham.length, 22);
    yerel.writeUInt16LE(adB.length, 26);
    const merkez = Buffer.alloc(46);
    merkez.writeUInt32LE(0x02014b50, 0);
    merkez.writeUInt16LE(8, 10);
    merkez.writeUInt32LE(sik.length, 20);
    merkez.writeUInt32LE(ham.length, 24);
    merkez.writeUInt16LE(adB.length, 28);
    merkez.writeUInt32LE(ofs, 42);
    parcalar.push(yerel, adB, sik);
    dizin.push(merkez, adB);
    ofs += 30 + adB.length + sik.length;
  }
  const dizinB = Buffer.concat(dizin);
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0);
  son.writeUInt16LE(Object.keys(dosyalar).length, 10);
  son.writeUInt32LE(dizinB.length, 12);
  son.writeUInt32LE(ofs, 16);
  const b = Buffer.concat([...parcalar, dizinB, son]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

describe('zip içe alma', () => {
  it('SE parçalarını ayırır', async () => {
    const dosyalar = await zipAc(
      zip({
        'Sayac/widget.html': '<div id=a></div>',
        'Sayac/widget.css': '#a{color:red}',
        'Sayac/widget.js': 'console.log(1)',
        'Sayac/fields.json': '{"renk":{"type":"colorpicker","value":"#fff"}}',
        'Sayac/data.json': '{"renk":"#000"}',
        '__MACOSX/Sayac/._widget.js': 'x'
      })
    );
    expect(dosyalar).toHaveLength(5);
    const w = seParcalari(dosyalar);
    expect(w).toMatchObject({ ad: 'Sayac', html: '<div id=a></div>', css: '#a{color:red}', js: 'console.log(1)', veri: { renk: '#000' } });
    expect(w.alanlar.renk.type).toBe('colorpicker');
  });

  it('html/js yoksa ya da JSON bozuksa açık hata', () => {
    expect(seParcalari([{ ad: 'greeter.html', metin: '' }]).ad).toBe('greeter');
    expect(() => seParcalari([{ ad: 'a.css', metin: '' }])).toThrow(/html/);
    expect(() => seParcalari([{ ad: 'w.html', metin: '' }, { ad: 'fields.json', metin: '{' }])).toThrow(/geçersiz JSON/);
  });
});
