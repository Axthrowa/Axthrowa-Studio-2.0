/**
 * Kick izin sayfasını yüklü tarayıcının gizli penceresinde açar (bot hesabıyla girmek için).
 * Web sayfası gizli pencere açamaz; bunu ancak yerelde çalışan sunucu yapabilir.
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

/** Yalnız Kick'in izin sayfası: bu uç rastgele adres açtırmak için kullanılamasın */
export function izinAdresiMi(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'id.kick.com' && u.pathname === '/oauth/authorize';
  } catch {
    return false;
  }
}

/** Denenecek tarayıcılar ve gizli pencere bayrakları */
export function tarayiciAdaylari(env: Record<string, string | undefined> = process.env): Array<{ yol: string; bayrak: string }> {
  const koklar = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean) as string[];
  const tarayicilar: Array<[string, string]> = [
    ['Google/Chrome/Application/chrome.exe', '--incognito'],
    ['Microsoft/Edge/Application/msedge.exe', '--inprivate'],
    ['BraveSoftware/Brave-Browser/Application/brave.exe', '--incognito'],
    ['Mozilla Firefox/firefox.exe', '-private-window']
  ];
  return tarayicilar.flatMap(([yol, bayrak]) => koklar.map((k) => ({ yol: path.win32.join(k, yol), bayrak })));
}

export function gizliPenceredeAc(url: string): boolean {
  if (process.platform !== 'win32' || !izinAdresiMi(url)) return false;
  const t = tarayiciAdaylari().find((a) => existsSync(a.yol));
  if (!t) return false;
  // Kabuk yok: adres tek bağımsız değişken olarak gider
  const cocuk = spawn(t.yol, [t.bayrak, url], { detached: true, stdio: 'ignore' });
  cocuk.on('error', (e) => console.error('[Kick] Gizli pencere açılamadı:', e.message));
  cocuk.unref();
  return true;
}
