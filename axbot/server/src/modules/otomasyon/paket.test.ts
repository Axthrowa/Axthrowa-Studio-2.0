/** BOT-1: dışa aktarılan kural (sesi ve kuyruğuyla) temiz kurulumda içe alınır */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, expect, it, vi } from 'vitest';

vi.mock('../muzik/index.js', () => ({ muzikHost: { hariciAdres: () => '' } }));

const ilkDizin = process.cwd();
const kokler: string[] = [];
/** Yeni veri klasörü + yeni modüller: VITEST'te db her yüklemede boş :memory:, medya cwd/data/media */
async function temizKurulum() {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'axbot-paket-'));
  kokler.push(kok);
  process.chdir(kok);
  vi.resetModules();
  return {
    paket: await import('./paket.js'),
    otomasyon: (await import('./otomasyon.js')).otomasyon,
    pano: (await import('../pano/pano.js')).sesPanosu,
    medya: (await import('../media/media.js')).medya,
    wav: (await import('../alerts/hazir-setler.js')).wavYaz
  };
}
afterAll(() => {
  process.chdir(ilkDizin);
  for (const k of kokler) fs.rmSync(k, { recursive: true, force: true });
});

it('kural, çağırdığı kural, kuyruğu ve ses panosu öğesi medyasıyla taşınır', async () => {
  const a = await temizKurulum();
  const m = a.medya.ekle('isik.wav', a.wav([[440, 0, 0.1]], 'zil').toString('base64'));
  expect(m.ok).toBe(true);
  const oge = a.pano.ogeYaz({ ad: 'Abone sesi', komut: 'abone', medyaId: (m as any).oge.id });
  expect(oge.ok).toBe(true);
  const ogeId = (oge as any).oge.id;
  const yardimci = { id: 'y', ad: 'Teşekkür', etkin: false, tetik: { tur: 'takip' }, kosullar: [], eylemler: [{ tur: 'sohbet', metin: 'sağ ol' }] };
  const ana = {
    id: 'ana', ad: 'Abone ışığı', kuyruk: 'Işık', tetik: { tur: 'abone' }, kosullar: [],
    eylemler: [{ tur: 'pano_oynat', ogeId }, { tur: 'rastgele_dal', yuzde: 50, evet: [{ tur: 'kural_calistir', kuralId: 'y' }], hayir: [] }]
  };
  const baska = { id: 'z', ad: 'İlgisiz', tetik: { tur: 'takip' }, kosullar: [], eylemler: [{ tur: 'sohbet', metin: 'x' }] };
  expect(a.otomasyon.kaydet([ana, yardimci, baska], [{ ad: 'Işık', ayniAnda: 1, enCokBekleyen: 5 }]).ok).toBe(true);
  // Dosyaya yazılıp okunmuş gibi
  const dosya = JSON.parse(JSON.stringify(a.paket.disaAktar(['ana'])));
  expect(dosya.kurallar.map((k: any) => k.id).sort()).toEqual(['ana', 'y']);
  expect(dosya.medya).toHaveLength(1);

  const b = await temizKurulum();
  expect(b.otomasyon.kurallar()).toEqual([]);
  expect(b.medya.listele()).toEqual([]);
  const r = b.paket.iceAktar(dosya);
  expect(r).toMatchObject({ ok: true, kurallar: 2, kuyruklar: 1, pano: { eklenen: 1 }, medya: { eklenen: 1 } });
  const kurallar = b.otomasyon.kurallar();
  const yeniAna = kurallar.find((k) => k.ad === 'Abone ışığı')!;
  const yeniY = kurallar.find((k) => k.ad === 'Teşekkür')!;
  expect(yeniAna.id).not.toBe('ana');
  expect(yeniAna.kuyruk).toBe('Işık');
  const yeniOge = b.pano.ogeler()[0];
  expect(yeniAna.eylemler[0]).toEqual({ tur: 'pano_oynat', ogeId: yeniOge.id });
  expect((yeniAna.eylemler[1] as any).evet[0]).toEqual({ tur: 'kural_calistir', kuralId: yeniY.id });
  expect(b.medya.bul(yeniOge.medyaId)).toBeTruthy();

  // Aynı paket ikinci kez: ses ve kuyruk yinelenmez, kurallar yeniden eklenir
  const r2 = b.paket.iceAktar(dosya);
  expect(r2).toMatchObject({ ok: true, kurallar: 2, kuyruklar: 0, pano: { zatenVardi: 1 } });
  expect(b.medya.listele()).toHaveLength(1);
  expect(b.paket.iceAktar({ tur: 'baska' }).ok).toBe(false);
}, 30_000);
