/**
 * AxBoT — sırların diskte şifrelenmesi (S6)
 * Developed by AxthrowA
 *
 * Denetim S6: OAuth tokenları ve API anahtarları `data/axbot.sqlite`
 * içinde DÜZ METİN duruyordu. API'den artık dönmüyorlardı ama dosyayı ele
 * geçiren (paylaşılan bir yedek zip'i, taşınan taşınabilir klasör, başka bir
 * kullanıcı) hepsini okuyabiliyordu. Yedek betiği `data` klasörünü de zip'e
 * koyduğu için bu somut bir sızıntı yoluydu.
 *
 * Çözüm: Windows DPAPI (CurrentUser). Şifreli değer yalnız AYNI Windows
 * kullanıcısı, AYNI bilgisayarda çözülebilir; anahtarı biz tutmayız,
 * işletim sistemi tutar. Node'da yerleşik DPAPI yok ve yerel (native) modül
 * Akıllı Uygulama Denetimi'ne takılır; imzalı `powershell.exe` üzerinden
 * .NET `ProtectedData` çağrılır. Sırlar KOMUT SATIRINDA değil stdin ile
 * geçer (süreç listesinde görünmesin).
 *
 * Biçim: `dpapi:v1:<base64>`. Önek yoksa değer düz metindir ve AYNEN okunur
 * (geriye uyum). Başka makineye taşınan şifreli değer çözülemez → boş
 * sayılır → platform "yeniden bağlan" der. Bu bilinçli: amaç tam da bu.
 *
 * Kapatmak için: AXBOT_SIFRELEME=kapali (yeni yazımlar düz kalır;
 * mevcut şifreli değerler okunmaya devam eder).
 */
import { execFileSync } from 'node:child_process';

export const ONEK = 'dpapi:v1:';

/** Uygulamaya özgü ek entropi: başka bir uygulamanın DPAPI verisiyle karışmasın. */
// Baytlar ilk sürümden beri aynı: değişirse kayıtlı sırlar çözülemez
const ENTROPI_B64 = 'U3RyZWFtQXhULXNpci1rYXNhc2ktdjE=';

/**
 * Toplu işlem betiği. Girdi stdin'den JSON: [{i, islem:'sifrele'|'coz', veri}]
 * `veri` base64'tür. Şifrelemede aynı çağrı içinde geri çözüp doğrular.
 */
const BETIK = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$ent = [Convert]::FromBase64String('${ENTROPI_B64}')
$kapsam = [System.Security.Cryptography.DataProtectionScope]::CurrentUser
$girdi = [Console]::In.ReadToEnd() | ConvertFrom-Json
$cikti = @()
foreach ($g in @($girdi)) {
  try {
    $b = [Convert]::FromBase64String($g.veri)
    if ($g.islem -eq 'sifrele') {
      $s = [System.Security.Cryptography.ProtectedData]::Protect($b, $ent, $kapsam)
      $geri = [System.Security.Cryptography.ProtectedData]::Unprotect($s, $ent, $kapsam)
      $cikti += [pscustomobject]@{ i = $g.i; ok = $true; sonuc = [Convert]::ToBase64String($s); dogrulama = [Convert]::ToBase64String($geri) }
    } else {
      $c = [System.Security.Cryptography.ProtectedData]::Unprotect($b, $ent, $kapsam)
      $cikti += [pscustomobject]@{ i = $g.i; ok = $true; sonuc = [Convert]::ToBase64String($c) }
    }
  } catch {
    $cikti += [pscustomobject]@{ i = $g.i; ok = $false; sonuc = '' }
  }
}
ConvertTo-Json -InputObject @($cikti) -Compress
`;

interface Is {
  i: number;
  islem: 'sifrele' | 'coz';
  veri: string;
}
interface Sonuc {
  i: number;
  ok: boolean;
  sonuc: string;
  dogrulama?: string;
}

/** Şifreli metin → düz metin önbelleği (her şifreli değer süreç başına bir kez çözülür). */
const cozulmus = new Map<string, string>();
/** Çözülemeyenler — her okumada PowerShell tekrar çalışmasın. */
const cozulemeyen = new Set<string>();
let kullanilamaz = process.platform !== 'win32';
let uyarildi = false;

export function onekliMi(deger: unknown): deger is string {
  return typeof deger === 'string' && deger.startsWith(ONEK);
}

export function sifrelemeAcikMi(env: NodeJS.ProcessEnv = process.env): boolean {
  return !kullanilamaz && String(env.AXBOT_SIFRELEME || '').toLowerCase() !== 'kapali';
}

function calistir(isler: Is[]): Sonuc[] {
  if (!isler.length) return [];
  if (kullanilamaz) return isler.map((x) => ({ i: x.i, ok: false, sonuc: '' }));
  try {
    const cikti = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', BETIK],
      { input: JSON.stringify(isler), encoding: 'utf8', timeout: 30_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }
    );
    const j = JSON.parse(String(cikti).trim() || '[]');
    return (Array.isArray(j) ? j : [j]) as Sonuc[];
  } catch (e: any) {
    kullanilamaz = true;
    if (!uyarildi) {
      uyarildi = true;
      console.warn('[Kasa] DPAPI kullanılamıyor, sırlar düz metin kalacak:', String(e?.message || e).slice(0, 160));
    }
    return isler.map((x) => ({ i: x.i, ok: false, sonuc: '' }));
  }
}

/**
 * Düz metni şifreler. Şifreleme kapalıysa, DPAPI yoksa ya da gidiş-dönüş
 * doğrulaması tutmazsa DÜZ METNİ olduğu gibi döner — asla bozuk değer yazılmaz.
 */
export function sifrele(duz: string | null | undefined): string | null {
  const [sonuc] = sifreleHepsi([duz]);
  return sonuc === undefined ? null : sonuc;
}

/** Bu düz metnin daha önce üretilmiş şifrelisi (tekrar kaydederken PowerShell çağrılmasın). */
function bilinenSifreli(duz: string): string | undefined {
  for (const [sifreli, d] of cozulmus) if (d === duz) return sifreli;
  return undefined;
}

/**
 * Birden çok değeri TEK PowerShell çağrısıyla şifreler, sırayı korur.
 * Boş/null/zaten şifreli değerler ve doğrulaması tutmayanlar AYNEN döner —
 * asla bozuk değer üretilmez. Önceden şifrelenmiş düz metin önbellekten
 * gelir (değişmeyen token'ı yeniden kaydetmek anında olur).
 */
export function sifreleHepsi<T extends string | null | undefined>(liste: T[]): Array<T | string> {
  const cikti: Array<T | string> = [...liste];
  if (!sifrelemeAcikMi()) return cikti;
  const is: Is[] = [];
  const yer = new Map<number, number>();
  liste.forEach((d, i) => {
    if (d === null || d === undefined) return;
    const s = String(d);
    if (!s || onekliMi(s)) return;
    const hazir = bilinenSifreli(s);
    if (hazir) {
      cikti[i] = hazir;
      return;
    }
    yer.set(is.length, i);
    is.push({ i: is.length, islem: 'sifrele', veri: Buffer.from(s, 'utf8').toString('base64') });
  });
  for (const r of calistir(is)) {
    const i = yer.get(r.i);
    if (i === undefined || !r.ok) continue;
    const s = String(liste[i]);
    if (Buffer.from(r.dogrulama || '', 'base64').toString('utf8') !== s) continue;
    const sifreli = ONEK + r.sonuc;
    cozulmus.set(sifreli, s);
    cikti[i] = sifreli;
  }
  return cikti;
}

/**
 * Önekli değeri çözer; önek yoksa AYNEN döner. Çözülemezse boş dize —
 * başka makineden gelmiş şifreli bir token kullanılamaz, platform "yeniden
 * bağlan" der.
 */
export function coz(deger: unknown): unknown {
  if (!onekliMi(deger)) return deger;
  const hazir = cozulmus.get(deger);
  if (hazir !== undefined) return hazir;
  if (cozulemeyen.has(deger)) return '';
  const [r] = calistir([{ i: 0, islem: 'coz', veri: deger.slice(ONEK.length) }]);
  if (r?.ok) {
    const duz = Buffer.from(r.sonuc, 'base64').toString('utf8');
    cozulmus.set(deger, duz);
    return duz;
  }
  cozulemeyen.add(deger);
  console.warn('[Kasa] Bir sır çözülemedi (başka bilgisayar/kullanıcıdan gelmiş olabilir) — yeniden girilmeli.');
  return '';
}

/** Birden çok şifreli değeri TEK PowerShell çağrısıyla önbelleğe alır (açılış hızı). */
export function onbellegeAl(degerler: unknown[]): void {
  const bekleyen = [...new Set(degerler.filter(onekliMi))].filter((d) => !cozulmus.has(d) && !cozulemeyen.has(d));
  if (!bekleyen.length) return;
  const sonuclar = calistir(bekleyen.map((d, i) => ({ i, islem: 'coz', veri: d.slice(ONEK.length) })));
  for (const r of sonuclar) {
    const d = bekleyen[r.i];
    if (!d) continue;
    if (r.ok) cozulmus.set(d, Buffer.from(r.sonuc, 'base64').toString('utf8'));
    else cozulemeyen.add(d);
  }
}

/**
 * Birden çok düz değeri TEK çağrıyla şifreler (geçiş için).
 * Döner: düz → şifreli; doğrulaması tutmayanlar haritada YOKTUR.
 */
export function topluSifrele(duzler: string[]): Map<string, string> {
  const harita = new Map<string, string>();
  if (!sifrelemeAcikMi()) return harita;
  const liste = [...new Set(duzler.filter((d) => typeof d === 'string' && d && !onekliMi(d)))];
  const sonuclar = calistir(liste.map((d, i) => ({ i, islem: 'sifrele', veri: Buffer.from(d, 'utf8').toString('base64') })));
  for (const r of sonuclar) {
    const d = liste[r.i];
    if (!d || !r.ok) continue;
    if (Buffer.from(r.dogrulama || '', 'base64').toString('utf8') !== d) continue;
    const sifreli = ONEK + r.sonuc;
    harita.set(d, sifreli);
    cozulmus.set(sifreli, d);
  }
  return harita;
}

/**
 * Bir sonuç satırındaki önekli metin alanlarını çözer (yerinde değil, kopya).
 * Veritabanı okumalarında tek noktadan uygulanır; önek yoksa satır AYNEN döner.
 */
export function satiriCoz<T>(satir: T): T {
  if (!satir || typeof satir !== 'object') return satir;
  let degisti = false;
  const kopya: Record<string, unknown> = { ...(satir as any) };
  for (const [k, v] of Object.entries(kopya)) {
    if (onekliMi(v)) {
      kopya[k] = coz(v);
      degisti = true;
    }
  }
  return (degisti ? kopya : satir) as T;
}

/** Testler için: süreci DPAPI yokmuş gibi çalıştır. */
export function _testIcinKullanilamazYap(v = true) {
  kullanilamaz = v;
}
