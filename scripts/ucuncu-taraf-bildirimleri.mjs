// Üçüncü taraf bildirimleri ve SBOM (ADR-005 §3, plan §2 "Çıktılar"). Çevrimdışı çalışır:
//   node scripts/ucuncu-taraf-bildirimleri.mjs
// Üretir:
//   THIRD_PARTY_NOTICES.txt           — ürün lisansı + kaynak teklifi + her bileşenin adı/sürümü/lisansı/lisans metni
//   public/THIRD_PARTY_NOTICES.txt    — aynısı (uygulama içinde Yardım › Hakkında ve lisanslar)
//   public/LICENSE.txt                — ürünün GPL-2.0 metni
//   cikti/sbom.cdx.json               — CycloneDX 1.5 SBOM
// Yalnız dağıtılan bileşenler: Rust'ta kökten "normal" (çalışma zamanı) bağımlılıkla erişilenler (derleme/geliştirme
// bağımlılıkları hariç), npm'de `dev` olmayan paketler (panel + Resonance ön yüzleri paketlenir).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LISANS_DOSYASI = /^(licen[cs]e|copying|notice|unlicense)([-._].*)?$/i;

function lisansMetinleri(klasor) {
  let adlar = [];
  try {
    adlar = fs.readdirSync(klasor).filter((a) => LISANS_DOSYASI.test(a)).sort();
  } catch {
    return [];
  }
  return adlar
    .map((a) => {
      try {
        const t = fs.readFileSync(path.join(klasor, a), 'utf8').replace(/\r\n/g, '\n').trim();
        return t ? { dosya: a, metin: t } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** Rust: kök paketten normal bağımlılıklarla erişilen crate'ler */
function rustBilesenleri(manifest, kaynak) {
  const meta = JSON.parse(
    execFileSync('cargo', ['metadata', '--format-version', '1', '--offline', '--manifest-path', manifest, '--filter-platform', 'x86_64-pc-windows-msvc'], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
  );
  const paket = new Map(meta.packages.map((p) => [p.id, p]));
  const dugum = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  const kendi = new Set(meta.workspace_members);
  const gorulen = new Set();
  const yigin = [meta.resolve.root ?? meta.workspace_members[0]];
  while (yigin.length) {
    const id = yigin.pop();
    if (gorulen.has(id)) continue;
    gorulen.add(id);
    for (const d of dugum.get(id)?.deps ?? []) {
      if (d.dep_kinds.some((k) => k.kind === null)) yigin.push(d.pkg);
    }
  }
  return [...gorulen]
    .filter((id) => !kendi.has(id))
    .map((id) => paket.get(id))
    .map((p) => ({
      tur: 'cargo',
      ad: p.name,
      surum: p.version,
      lisans: p.license || (p.license_file ? `bkz. ${p.license_file}` : 'belirtilmemiş'),
      adres: p.repository || p.homepage || '',
      kaynak,
      metinler: lisansMetinleri(path.dirname(p.manifest_path)),
    }));
}

/** npm: kilit dosyasındaki dev olmayan paketler */
function npmBilesenleri(klasor, kaynak) {
  const kilit = path.join(klasor, 'package-lock.json');
  if (!fs.existsSync(kilit)) return [];
  const paketler = JSON.parse(fs.readFileSync(kilit, 'utf8')).packages ?? {};
  const out = [];
  for (const [yol, p] of Object.entries(paketler)) {
    if (!yol.includes('node_modules/') || p.dev || p.link) continue;
    const ad = yol.slice(yol.lastIndexOf('node_modules/') + 'node_modules/'.length);
    out.push({
      tur: 'npm',
      ad,
      surum: p.version ?? '',
      lisans: typeof p.license === 'string' ? p.license : 'belirtilmemiş',
      adres: '',
      kaynak,
      metinler: lisansMetinleri(path.join(klasor, yol)),
    });
  }
  return out;
}

const bilesenler = [
  ...rustBilesenleri(path.join(kok, 'src-tauri', 'Cargo.toml'), 'panel (Rust)'),
  ...npmBilesenleri(kok, 'panel ön yüzü (npm)'),
  ...npmBilesenleri(path.join(kok, 'resonance'), 'Resonance ön yüzü (npm)'),
];
// Aynı bileşen birden çok kaynakta: tek kayıt
const birlesik = new Map();
for (const b of bilesenler) {
  const k = `${b.tur}:${b.ad}@${b.surum}`;
  const var_ = birlesik.get(k);
  if (var_) {
    if (!var_.kaynak.includes(b.kaynak)) var_.kaynak += `, ${b.kaynak}`;
  } else birlesik.set(k, { ...b });
}
const liste = [...birlesik.values()].sort((a, b) => `${a.tur}:${a.ad}`.localeCompare(`${b.tur}:${b.ad}`) || a.surum.localeCompare(b.surum));

const surum = JSON.parse(fs.readFileSync(path.join(kok, 'package.json'), 'utf8')).version;
const satirlar = [];
const yaz = (s = '') => satirlar.push(s);
yaz('AxthrowA Studio — ÜÇÜNCÜ TARAF BİLDİRİMLERİ');
yaz(`Sürüm ${surum}. Bu dosya scripts/ucuncu-taraf-bildirimleri.mjs ile üretilir; elle düzenlemeyin.`);
yaz();
yaz('Ürün lisansı: GNU General Public License sürüm 2 ya da (tercihinize göre) daha sonraki bir sürüm');
yaz('(GPL-2.0-or-later). Lisans metni: LICENSE.txt. Bu programın ikili sürümünü alan herkes, karşılık gelen tam');
yaz('kaynak kodunu da aynı lisansla alma hakkına sahiptir; kaynak kodu programla birlikte dağıtılan depodan ya da');
yaz('dağıtıcıdan talep edilerek edinilebilir.');
yaz();
yaz('Bu uygulama kullanıcının bilgisayarında kurulu OBS Studio ile obs-websocket protokolü üzerinden konuşur ve OBS\'e');
yaz('tarayıcı dock\'u olarak eklenir; OBS Studio ve OBS eklentileri bu pakete dahil değildir. OBS Studio, OBS Project\'in');
yaz('markasıdır; bu ürün onunla bağlantılı değildir.');
yaz();
yaz(`Bileşen sayısı: ${liste.length}`);
yaz('='.repeat(100));

// Aynı lisans metni bir kez yazılır; sonrakiler numarasıyla anılır
const metinNo = new Map();
for (const b of liste) {
  yaz();
  yaz(`${b.ad} ${b.surum}  [${b.tur}; ${b.kaynak}]`);
  yaz(`Lisans: ${b.lisans}`);
  if (b.adres) yaz(`Kaynak: ${b.adres}`);
  if (!b.metinler.length) {
    yaz('(Pakette lisans dosyası yok; yukarıdaki SPDX lisansının standart metni geçerlidir.)');
    continue;
  }
  for (const m of b.metinler) {
    const h = createHash('sha256').update(m.metin).digest('hex');
    if (metinNo.has(h)) {
      yaz(`${m.dosya}: metin #${metinNo.get(h)} ile aynı`);
    } else {
      const no = metinNo.size + 1;
      metinNo.set(h, no);
      yaz(`--- ${m.dosya} (metin #${no}) ---`);
      yaz(m.metin);
      yaz('--- son ---');
    }
  }
}
const metin = satirlar.join('\n') + '\n';
fs.writeFileSync(path.join(kok, 'THIRD_PARTY_NOTICES.txt'), metin, 'utf8');
fs.mkdirSync(path.join(kok, 'public'), { recursive: true });
fs.writeFileSync(path.join(kok, 'public', 'THIRD_PARTY_NOTICES.txt'), metin, 'utf8');
fs.copyFileSync(path.join(kok, 'LICENSE'), path.join(kok, 'public', 'LICENSE.txt'));

// CycloneDX 1.5
const purl = (b) => (b.tur === 'cargo' ? `pkg:cargo/${b.ad}@${b.surum}` : `pkg:npm/${b.ad.startsWith('@') ? '%40' + b.ad.slice(1) : b.ad}@${b.surum}`);
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    component: { type: 'application', name: 'axthrowa-studio', version: surum, licenses: [{ expression: 'GPL-2.0-or-later' }] },
  },
  components: liste.map((b) => ({
    type: 'library',
    name: b.ad,
    version: b.surum,
    purl: purl(b),
    ...(b.lisans && !b.lisans.startsWith('bkz.') && b.lisans !== 'belirtilmemiş' ? { licenses: [{ expression: b.lisans.replace(/\//g, ' OR ') }] } : {}),
    ...(b.adres ? { externalReferences: [{ type: 'vcs', url: b.adres }] } : {}),
  })),
};
fs.mkdirSync(path.join(kok, 'cikti'), { recursive: true });
fs.writeFileSync(path.join(kok, 'cikti', 'sbom.cdx.json'), JSON.stringify(sbom, null, 2), 'utf8');

const metinsiz = liste.filter((b) => !b.metinler.length).length;
console.log(`bileşen: ${liste.length} (Rust ${liste.filter((b) => b.tur === 'cargo').length}, npm ${liste.filter((b) => b.tur === 'npm').length}); ayrı lisans metni: ${metinNo.size}; lisans dosyası olmayan: ${metinsiz}`);
console.log(`THIRD_PARTY_NOTICES.txt ${(metin.length / 1024).toFixed(0)} KB, cikti/sbom.cdx.json`);
