/**
 * Yalnızca `themeContract.test.ts` için: dosya metnini okuma ve dizin gezme
 * fonksiyonlarının tipi.
 *
 * `@types/node` eklemedik çünkü tüm projeye global tipler sokuyor (örn.
 * `setTimeout` dönüşü `number` yerine `NodeJS.Timeout` oluyor). Vitest CSS
 * dosyalarını `?raw` ile bile boşalttığı için testin dosyayı gerçekten
 * okuması gerekiyor.
 */
declare module "node:fs" {
  export function readFileSync(path: URL | string, encoding: "utf8"): string;
  export function readdirSync(path: URL | string, options: { recursive: true }): string[];
}
