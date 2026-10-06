# ADR-005 — Dağıtım modeli ve motor stratejisi: YOL G (tüm ürün GPL-2.0-or-later)

> Durum: **KABUL** (2026-09-28) · Yerine geçtiği karar: [ADR-004](OBS_LICENSE_ARCHITECTURE_DECISION.md) ("kişisel
> kullanım, dağıtım yok") · İlgili: [ADR-001/002/003](STREAMING_ENGINE_DECISION.md), plan
> [PLAN_PROMPT_OZGUN_YAYIN_MOTORU](PLAN_PROMPT_OZGUN_YAYIN_MOTORU.md).
> Bu belge hukuki danışmanlık değildir; dağıtımdan önce bir avukata §3 ve §5'i okutun.

## 1. Bağlam

Plan istemi ürünü **dağıtıma hazır** hâle getirmeyi hedefliyor ve iki yol sunuyor:

| | YOL B — özgün motor, kapalı kaynak | YOL G — tüm ürün GPL açık kaynak |
|---|---|---|
| Motor | libobs'a bağlanılmaz; render, ses, kodlayıcı, RTMP, muxer, yakalama sıfırdan | Mevcut libobs tabanlı `motor/` kalır |
| OBS eklenti uyumluluğu | Yok | **Var** (aynı libobs ABI'si) |
| Oyun yakalama, uygulama sesi, tarayıcı kaynağı | Kendi kodumuz (aylar–yıllar) | Kurulu OBS'in olgun modülleri |
| Kaynak kodu | Kapalı olabilir | **Panel dahil tamamı GPL-2.0-or-later ile açılır** |
| Planın Faz 1–3 kapsamı | Tam | Büyük ölçüde mevcut; yalnız eksikler |

**Ürün sahibinin kararı (2026-09-28): YOL G.**

## 2. Karar

1. **Dağıtım modeli: VAR**, ürün **GPL-2.0-or-later** ile açık kaynak dağıtılır (panel `src/`, `src-tauri/`,
   motor `motor/`, betikler). Kapalı kaynak bileşen yoktur.
2. **Motor:** libobs tabanlı ayrı süreç (ADR-003) korunur. `motor/` emekliye ayrılmaz. Planın "yeni motor çalışma
   alanı `cekirdek/`" maddesi uygulanmaz; yerine mevcut motor genişletilir.
3. **OBS eklenti uyumluluğu kapsam içidir** (ADR-004 §3.4 kuralları geçerli: eklentiler kullanıcının makinesinde
   yüklenir, biz üçüncü taraf eklenti ikilisi dağıtmayız/indirmeyiz).
4. **libobs'un kendisi paketlenmez**: motor kullanıcının kurulu OBS Studio'sundaki `obs.dll`'i yükler (ADR-004 §3.3).
   İleride libobs'u pakete koymak ayrı bir karardır (GPL uyumlu, kaynak teklifiyle mümkündür).
5. **Hedef işletim sistemi:** Windows 10 22H2+ / Windows 11 x64.

## 3. Lisans sonuçları (YOL G)

- Tüm ürün GPL-2.0-or-later: depo kökünde `LICENSE`, her ikili dağıtımla **kaynak kodu teklifi** (depo adresi ya da
  kaynak arşivi) ve `THIRD_PARTY_NOTICES.txt`.
- **Bağımlılık politikası:** hedef artık "GPL'siz panel" değil, **GPL-2.0-or-later ile uyumlu** bağımlılıktır.
  İzinli: MIT, Apache-2.0 ("or later" sayesinde birleşik eser GPL-3.0 altında dağıtılabilir), BSD, ISC, Zlib,
  MPL-2.0, Unicode, CC0, LGPL, GPL-2.0-or-later, GPL-3.0(-or-later). **Yasak:** GPL ile uyumsuz lisanslar (SSPL,
  Commons Clause, BUSL, tescilli/"nonfree", CC-BY-NC) ve AGPL. Denetim: `scripts/lisans-denetimi.mjs` (panel +
  motor crate'leri) ve `src/lib/licenses.test.ts` (npm).
- **Tescilli SDK'lar:** NVIDIA/AMD/Intel kodlayıcıları libobs modülleri üzerinden, kullanıcının sürücüsüyle çalışır.
  NDI SDK kullanılmaz.
- **Patentler:** H.264/HEVC/AAC donanım kodlayıcıları ve OBS'in kendi modülleri üzerinden; AV1/Opus telifsiz.
  Ticari dağıtım öncesi avukat görüşü alınır.

## 4. Marka

"OBS", "OBS Studio", "StreamElements", "SE.Live" adları/logoları ürün adı ya da simgesi olarak kullanılmaz; yalnız
uyumluluğu tarif eden metinlerde geçer. Hakkında sayfasında: "OBS Studio, OBS Project'in markasıdır; bu ürün onunla
bağlantılı değildir."

## 5. Plan fazlarının YOL G'ye göre uyarlanması

| Faz | Plandaki kapsam | YOL G'de |
|---|---|---|
| F0 | ADR, cargo-deny, `cekirdek/` iskeleti, IPC | ADR-005, GPL uyumlu lisans politikası, `LICENSE`, `THIRD_PARTY_NOTICES`/SBOM üretimi. **`cekirdek/` yok** |
| F1–F3 | Özgün render/ses/kodlayıcı/sahne grafiği | libobs'ta var; eksik parçalar (kayıt duraklatma/bölme, slayt gösterisi…) motora eklenir |
| F4 | OBS düzeninde kabuk | Mevcut çalışma alanı + `OBS_UI_PARITY_CHECKLIST.md` eksikleri |
| F5 | Çıkışlar | libobs çıkışları (RTMP/RTMPS, kayıt biçimleri, tekrar, sanal kamera — OBS kurulumundan) |
| F6–F8 | Ayarlar, ses/video filtreleri, medya/tarayıcı | libobs filtreleri/kaynakları; ayar paritesi matrisi |
| F9 | Platformlar | Mevcut çoklu yayın; OAuth yalnız ürün sahibinin uygulama kaydıyla (UNVERIFIED) |
| F10 | Eklenti API, betik, obs-websocket 5.x uyumlu sunucu | Gerçek OBS eklentileri (var); obs-websocket 5.x uyumlu sunucu kendi uygulamamız |
| F11 | Kendi oyun kancamız | Gereksiz: OBS'in `win-capture`'ı (UNVERIFIED — yalnız sentetik sınama kararı) |
| F12 | Dağıtım | NSIS + taşınabilir + imza (var), THIRD_PARTY_NOTICES, kaynak teklifi; güncelleme/çökme raporu sunucusu ürün sahibi kararıyla |

## 6. Geri alınamaz adımlar (her biri ayrıca onay ister)

Depoyu herkese açık yapmak / yayınlamak, sürüm etiketi, dış sunucuya çökme raporu ya da telemetri gönderimi, gerçek
platform hesabıyla yayın.
