/**
 * AxBoT — Gemini anahtar/servis hatalarını anlaşılır Türkçeye çevirir
 * Developed by AxthrowA
 *
 * Google 401/403 yanıtında `details[].reason` ile asıl nedeni söyler. Eskiden
 * panel yalnız "Anahtar reddedildi veya Google'a ulaşılamadı" diyordu; kullanıcı
 * anahtarı doğru girdiği hâlde neyin yanlış olduğunu göremiyordu (ör. Google
 * Cloud'da başka servis için açılmış, Gemini'ye kapalı bir anahtar).
 */

const AI_STUDIO = 'aistudio.google.com/apikey';

/** Google hata gövdesinden (ya da SDK hata metninden) nedeni çıkarır. */
export function hataNedeni(metin: string): string {
  const m = String(metin || '').match(/"reason"\s*:\s*"([A-Z_]+)"/);
  if (m) return m[1];
  if (/API key not valid/i.test(metin)) return 'API_KEY_INVALID';
  return '';
}

/** Anahtarla ilgili bir sorunsa kullanıcıya gösterilecek açıklama; değilse null. */
export function anahtarSorunu(metin: string, anahtar = ''): string | null {
  const neden = hataNedeni(metin);
  const aiStudioBicimi = anahtar.startsWith('AIza');
  const bicimNotu = anahtar && !aiStudioBicimi ? " Kayıtlı anahtar 'AIza' ile başlamıyor; Gemini (AI Studio) anahtarları 'AIza' ile başlar." : '';
  switch (neden) {
    case 'API_KEY_SERVICE_BLOCKED':
    case 'ACCESS_TOKEN_TYPE_UNSUPPORTED':
      return (
        `Bu anahtar Gemini API'sine kapalı (Google bu anahtar için generativelanguage servisini engelliyor).` +
        bicimNotu +
        ` Çözüm: ${AI_STUDIO} adresinden yeni bir Gemini anahtarı oluşturup buraya yapıştır ya da Google Cloud → API ve Hizmetler → Kimlik bilgileri'nde anahtarın "API kısıtlamaları"na "Generative Language API" ekle.`
      );
    case 'API_KEY_INVALID':
      return `Anahtar geçersiz (silinmiş ya da yanlış kopyalanmış).${bicimNotu} ${AI_STUDIO} adresinden yeni anahtar oluştur.`;
    case 'SERVICE_DISABLED':
      return `Anahtarın projesinde Generative Language API kapalı. Google Cloud'da bu API'yi etkinleştir ya da ${AI_STUDIO} adresinden anahtar oluştur.`;
    case 'API_KEY_HTTP_REFERRER_BLOCKED':
    case 'API_KEY_IP_ADDRESS_BLOCKED':
      return 'Anahtar yalnız belirli sitelere/IP adreslerine izin veriyor. Google Cloud\'da anahtarın "uygulama kısıtlaması"nı kaldır.';
    default:
      if (/\b(401|403)\b|UNAUTHENTICATED|PERMISSION_DENIED/i.test(metin)) {
        return `Google anahtarı reddetti.${bicimNotu} ${AI_STUDIO} adresinden yeni anahtar oluştur.`;
      }
      return null;
  }
}
