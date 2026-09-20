/**
 * Panoya kopyalama — WebView2 için yedekli.
 *
 * `navigator.clipboard` yalnız güvenli bağlamda (https / localhost) ve pencere
 * odaktayken çalışıyor; uygulama kendi protokolünden servis edilince yazma
 * isteği sessizce reddedilebiliyor ve düğme hiçbir şey yapmamış gibi
 * görünüyordu. Bu yüzden başarısızlıkta gizli bir alan üzerinden
 * `document.execCommand("copy")` deniyoruz — eski API ama her yerde çalışıyor.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* aşağıdaki yedeğe düş */
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    // Ekranda görünmesin ama seçilebilir kalsın (display:none seçimi bozar).
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
