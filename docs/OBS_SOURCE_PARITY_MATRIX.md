# OBS kaynak paritesi matrisi

> Kaynak türleri libobs türleridir (kurulu OBS'ten çalışma anında); panel yeni kaynağı türün **en yeni sürümüyle**
> oluşturur (`color_source_v3`, `text_gdiplus_v3`). Sınama yalnız sentetiktir (kullanıcı kararı).

| OBS kaynağı | libobs türü | Panel türü | Durum | Kanıt |
|---|---|---|---|---|
| Renk | color_source_v3 | renk | UYGULANDI | entegrasyon + arayüz |
| Metin (GDI+) | text_gdiplus_v3 | yazi | UYGULANDI | entegrasyon + arayüz |
| Görüntü | image_source | gorsel | UYGULANDI | dosyasız görsel "bekliyor" durumu sınandı |
| Medya kaynağı | ffmpeg_source | medya | UYGULANDI | sentetik ton/test deseni; ses ölçerde |
| Tarayıcı | browser_source (obs-browser, CEF) | tarayici | UYGULANDI | yerel sayfa: CSS animasyonu kareleri değişir, WebAudio ≈ −26 dBFS mikserde, izleme kapalı; CEF alt süreçleri motorla kapanır |
| Sahne (iç içe) | scene | sahne | UYGULANDI | entegrasyon |
| Grup | group | grup | UYGULANDI | kalıcılık dahil |
| Ekran yakalama | monitor_capture | ekran | UNVERIFIED | özellik anahtarları örneksiz doğrulandı |
| Pencere yakalama (+ses) | window_capture | pencere | UNVERIFIED | `capture_audio` anahtarı doğrulandı |
| Oyun yakalama (+ses) | game_capture | oyun | UNVERIFIED | kipler any_fullscreen/window/hotkey doğrulandı; örnek oluşturulmadı (kanca atmasın) |
| Video yakalama aygıtı | dshow_input | kamera | UNVERIFIED | |
| Ses girişi | wasapi_input_capture | mikrofon | UNVERIFIED | |
| Ses çıkışı | wasapi_output_capture | masaustu | UNVERIFIED | çift ses uyarısı birim testiyle |
| Uygulama ses yakalama | wasapi_process_output_capture | uygulama_sesi | UNVERIFIED | pencere + öncelik anahtarları doğrulandı |
| Slayt gösterisi | slideshow_v2 | obs (içe aktarımda) | KISMİ | "Kaynak ekle" menüsünde yok; OBS'ten içe aktarılırsa çalışır |
| VLC, eklenti kaynakları | eklentinin türü | eklenti / obs | UYGULANDI | test eklentisi kaynağı + eksik eklenti yer tutucusu |

Ortak: Özellikler (libobs özellik formu; parola alanları Kimlik Yöneticisinde), Filtreler, Dönüşüm, göster/gizle,
kilit, yeniden adlandır, çoğalt (filtrelerle), var olanı başka sahneye ekle, kaynak durumu (hazır / bekliyor —
boyut 0: pencere/oyun bulunamadı, aygıt yok, sayfa yüklenmedi). "Etkileşim" (tarayıcıya tıklama/klavye) yok.
