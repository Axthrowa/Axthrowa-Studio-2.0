/**
 * AxBoT — HTML / betik bağlamı için kaçışlama (saf)
 * Developed by AxthrowA
 *
 * Kick OAuth geri dönüş sayfası `error` ve `code` sorgu parametrelerini
 * doğrudan HTML'e ve <script> içine gömüyordu: yansıyan XSS
 * (`/api/auth/kick/callback?error=<script>…</script>`). Betik bizim
 * kökenimizde çalışacağı için CSRF köken denetimini de geçerdi.
 */

/** HTML metni ve öznitelik değeri için. */
export function htmlKacisla(deger: unknown): string {
  return String(deger ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

/**
 * <script> içine gömülecek JSON. `</script>` ile bloktan kaçış ve U+2028/2029
 * satır sonları engellenir.
 */
export function betikJsonu(deger: unknown): string {
  return JSON.stringify(deger ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
