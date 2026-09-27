# OBS lisans ve mimari kararı (ADR-004)

> Durum: **KABUL** (2026-09-26) · Önceki kararlar: [ADR-001/002/003](STREAMING_ENGINE_DECISION.md).
> Bu belge hukuki danışmanlık değildir; mühendislik kararının gerekçesidir.

## 1. Ürünün durumu (ürün sahibinin beyanı)

| Soru | Yanıt |
|---|---|
| Dağıtım modeli | **Kişisel kullanım; dağıtım yok** (2026-09-26, ürün sahibinin seçimi) |
| Kaynak durumu | Panel (Tauri + React) kapalı/özel depo; motor `motor/` GPL-2.0-or-later (LICENSE dosyası depoda) |
| Ticari kullanım | Yok (kişisel yayın aracı) |

GPL-2.0 yükümlülükleri (kaynak teklifi, aynı lisansla dağıtım) **dağıtımla** doğar. Dağıtım olmadığı sürece motorun
libobs'a bağlanması ya da OBS eklentilerini yüklemesi yükümlülük doğurmaz. Yine de mimari, ileride dağıtım
gündeme gelirse yeniden yazım gerektirmeyecek şekilde kurulur.

## 2. Seçenekler

| | A — libobs tabanlı (mevcut) | B — Bağımsız motor | C — Mimari ayrım |
|---|---|---|---|
| Ne | Kurulu OBS'in `obs.dll`'i ayrı bir GPL süreçte (`yayin-motoru`) yüklenir | WGC/DXGI + D3D11 + WASAPI + Media Foundation/FFmpeg + NVENC/AMF/QSV ile sıfırdan | Panel ile GPL motor arasında yalnız JSON satır protokolü (stdio) |
| OBS eklenti uyumluluğu | **Gerçek** (aynı libobs ABI'si; §47–53) | Yok (eklentiler libobs'a bağlanır) | A ile birlikte |
| Oyun yakalama / uygulama sesi | OBS'in olgun kodu (win-capture, win-wasapi) | Aylar-yıllar; hile koruması riski | — |
| Lisans (dağıtılırsa) | Motor GPL kalır, kaynağı ikiliyle sunulmalı | Serbest (FFmpeg bileşenlerine dikkat) | Panel ile motor ayrı programlar sayılabilir **ama** varsayılmaz: iletişim yakın/karmaşık veri yapıları paylaşırsa tek program sayılabilir (FSF SSS) |
| Risk | libobs ana sürüm değişince yapı düzenleri yeniden doğrulanmalı | Kapsam | "Süreç ayırdım, sorun çözüldü" yanılgısı |

## 3. Karar

**A + C:** motor libobs tabanlı ayrı süreç olarak kalır (ADR-003), panel ile yalnız belgelenmiş, genel amaçlı JSON
komut protokolüyle konuşur (komut adı + basit alanlar; paylaşılan bellek, ortak veri yapısı, panelde libobs başlığı
yok). Kişisel kullanımda ek yükümlülük yok.

Kurallar (dağıtım gündeme gelirse bu listeyle yeniden değerlendirilir):
1. OBS kaynak kodundan büyük parça **kopyalanmaz**. OBS kaynağı yalnız ABI/yol/anahtar doğrulaması için okunur;
   davranış bağımsız yeniden uygulanır. Kopyalanan tek şey kamuya açık ABI'nin kendisidir (yapı alan sırası, sabit
   değerleri) — motorda, GPL dosyalarda.
2. OBS logosu, simgeleri, QSS/tema değerleri, açılış ekranı ve markası kullanılmaz; arayüz kendi `dt-*` tasarım
   sistemimiz ve tek simge ailesiyle (lucide, ISC) yapılır. "OBS" adı yalnız uyumluluğu tarif etmek için geçer.
3. Motor ikilisi kurulumla birlikte gelir (875da9e); dağıtılırsa `yayin-motoru-LICENSE.txt` + motor kaynağı teklifi
   zorunlu, OBS'in `obs.dll`'i **paketlenmez** (kullanıcının kurulu OBS'inden yüklenir).
4. Üçüncü taraf OBS eklentileri kendi lisanslarıyla kullanıcının makinesinde yüklenir; biz eklenti ikilisi
   dağıtmayız, indirmeyiz. Kendi test eklentilerimiz GPL-2.0-or-later.
5. Panel tarafında GPL kod yok (lisans bekçisi: `src/lib/licenses.test.ts`, `scripts/lisans-denetimi.mjs`).

## 4. Sonuçlar

- OBS eklenti uyumluluğu gerçekçi bir hedef olarak kalır (başka seçenekte olmazdı).
- Motor OBS 32.x'e bağlıdır; ana sürüm yükseltmesi [OBS_UPSTREAM_VERSION_STRATEGY](OBS_UPSTREAM_VERSION_STRATEGY.md)
  sürecinden geçer.
- Bağımsız motor (B) reddedilmedi, ertelendi: yalnız lisans/dağıtım modeli değişirse gündeme gelir.
