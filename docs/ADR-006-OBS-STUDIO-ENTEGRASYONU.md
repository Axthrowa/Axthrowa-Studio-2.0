# ADR-006 — Kendi libobs motoru yerine kurulu OBS Studio

> Durum: **KABUL** (2026-10-06) · Yerine geçtiği: [ADR-003](STREAMING_ENGINE_DECISION.md) (libobs tabanlı ayrı süreç),
> [ADR-005](ADR-005-DAGITIM-VE-OZGUN-MOTOR.md) §2.2–2.4 (motor `motor/` korunur, eklentiler motora yüklenir).
> ADR-005'in dağıtım/lisans kararları (tüm ürün GPL-2.0-or-later, marka kuralları) geçerliliğini korur.

## Bağlam

`motor/` kurulu OBS'in `obs.dll`'ini kendi sürecinde yükleyip üzerine kendi tuval/sahne/kodlayıcı modelini, panel de
OBS arayüzünün React karşılığını (Yayın çalışma alanı, dock'lar, projektörler, eklenti yöneticisi) kuruyordu. Ürün
sahibi sonuçtan memnun değil: OBS'in kendi arayüzü, işlevleri ve eklentileri olduğu gibi istenir.

## Karar (ürün sahibinin seçimi)

1. **Yayın kurulu OBS Studio'da yapılır.** Sahneler, kaynaklar, filtreler, kodlayıcılar, çıkışlar ve OBS eklentileri
   OBS'in kendisinindir; bu ürün onların kopyasını yapmaz.
2. **Bu ürün OBS'e dock olarak girer.** Panel bölümleri `http://127.0.0.1:8843/dock?id=<kimlik>` adresinde OBS özel
   tarayıcı dock'u olarak çalışır. OBS Studio sekmesi seçilen dock'ları OBS kapalıyken
   `%APPDATA%\obs-studio\user.ini` › `[BasicWindow]` › `ExtraBrowserDocks`'a yazar (sabit dock kimlikleri: yeniden
   yazmak çoğaltmaz, OBS yerleşimi korunur; kullanıcının kendi dock'ları kalır; ilk değişiklikte yedek alınır).
3. **Denetim obs-websocket ile.** Eylem kayıt defterinin eski `engine.*` eylemleri OBS karşılıklarına dönüştü
   (kayıt duraklat/böl, sanal kamera, filtre, Studio Mode/hızlı geçiş, altyazı, medya, bas-konuş/bas-sustur); eski
   kimlikler takma ad olarak çalışmaya devam eder. Bağlantı bilgisi panelde yoksa OBS'in
   `plugin_config/obs-websocket/config.json`'undan okunur.
4. **Kaldırılanlar:** `motor/`, motor köprüsü/koleksiyon/profil/OBS içe aktarma modülleri, eklenti yöneticisi
   (OBS eklentileri artık OBS'in kendisinde), kendi obs-websocket sunucumuz, remux/eksik dosya uçları, Yayın çalışma
   alanı, projektör ve motor dock'ları. Kaynak git geçmişindedir (`dbb8785` öncesi).
5. **Kurulu OBS kullanılır**, pakete OBS konmaz.

## Sonuçlar

- OBS'in tüm özellikleri ve eklenti ekosistemi doğrudan kullanılabilir; libobs ABI'sine bağımlılık ve büyük bakım
  yükü kalkar.
- Aynı anda yatay + dikey tuval gibi motorun kendi modeli OBS'in yetenekleriyle sınırlanır (OBS 32 Canvases ya da
  eklentiler).
- Dock'lar bu uygulama açıkken çalışır.
