/**
 * Dış bağlantıyı aç — gömülü (iframe) kullanımda da çalışır.
 *
 * AxBoT, AxthrowA Studio'nun Bot sekmesinde bir iframe içinde
 * çalışıyor. Orada `target="_blank"` ve `window.open` sessizce başarısız
 * oluyor (WebView yeni sekme açmıyor): "OBS Alert Önizle" gibi düğmeler hiçbir
 * şey yapmıyormuş gibi görünüyordu. Açılamazsa üst pencereye haber verilir;
 * ana uygulama adresi işletim sisteminin tarayıcısında açar. O da yoksa adres
 * panoya kopyalanır ve `false` döner.
 */
export function openLink(url: string, features?: string): boolean {
  try {
    const w = window.open(url, '_blank', features || 'noopener,noreferrer');
    if (w) return true;
  } catch {
    /* engellendi */
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'axbot:open-external', url }, '*');
      return true;
    }
  } catch {
    /* farklı köken */
  }
  try {
    void navigator.clipboard?.writeText(url);
  } catch {
    /* pano yok */
  }
  return false;
}
