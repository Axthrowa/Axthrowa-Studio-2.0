/**
 * AxBoT — API modül bütünlüğü (B1)
 * Developed by AxthrowA
 *
 * api/routes.ts alan modüllerine bölündü. İki sessiz hata sınıfını kilitler:
 *  1) `rotalar/` altına eklenip toplayıcıda bağlanmayan modülün rotaları
 *     hiç çalışmaz (404) — kimse fark etmez.
 *  2) Aynı yöntem+yol iki yerde tanımlanırsa Express yalnız İLKİNİ çalıştırır;
 *     ikincisi ölü koddur (komut yöneticisindeki gölgelenen `case`
 *     etiketlerinin rota karşılığı).
 * Rota modüllerini içe aktarmaz (veritabanı açılmasın): kaynak metin okunur.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const adaylar = [path.resolve(process.cwd(), 'src/api'), path.resolve(process.cwd(), 'server/src/api')];
const API = adaylar.find((a) => fs.existsSync(path.join(a, 'rotalar')))!;
const DIZIN = path.join(API, 'rotalar');
const modulDosyalari = fs
  .readdirSync(DIZIN)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .sort();

describe('API modül bütünlüğü', () => {
  it('rotalar/ altındaki her modül toplayıcıda içe aktarılıp bağlanır', () => {
    const toplayici = fs.readFileSync(path.join(API, 'routes.ts'), 'utf8');
    const satirlar = toplayici.split(/\r?\n/).map((l) => l.trim());
    for (const dosya of modulDosyalari) {
      const ad = dosya.replace(/\.ts$/, '');
      expect(satirlar, `${ad} içe aktarılmamış`).toContain(`import ${ad} from './rotalar/${ad}.js';`);
      expect(satirlar, `${ad} bağlanmamış`).toContain(`router.use(${ad});`);
    }
  });

  it('aynı yöntem + yol iki kez tanımlanmaz', () => {
    const gorulen = new Map<string, string>();
    const cift: string[] = [];
    let toplam = 0;
    for (const dosya of modulDosyalari) {
      const kaynak = fs.readFileSync(path.join(DIZIN, dosya), 'utf8');
      for (const m of kaynak.matchAll(/^router\.(get|post|put|patch|delete|all)\(\s*'([^']+)'/gm)) {
        toplam++;
        const anahtar = `${m[1].toUpperCase()} ${m[2]}`;
        if (gorulen.has(anahtar)) cift.push(`${anahtar} (${gorulen.get(anahtar)} ve ${dosya})`);
        else gorulen.set(anahtar, dosya);
      }
    }
    expect(cift).toEqual([]);
    // Bölme anındaki envanter 154 idi; rota eklendikçe artar, azalırsa bir
    // modül kaybolmuş olabilir.
    expect(toplam).toBeGreaterThanOrEqual(154);
  });
});
