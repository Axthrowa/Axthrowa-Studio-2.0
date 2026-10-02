# OBS kısayol paritesi matrisi

> Tüm denetleyiciler (kısayol, Kontrol Merkezi, deste, uzak) aynı **eylem kayıt defterinden** geçer
> (`src-tauri/src/actions/mod.rs`): izin → onay → yürütme → denetim `ACTION:<id>`. Küresel kısayollar Tauri
> global-shortcut ile; çakışma denetimi kayıt anında.

| OBS kısayolu | Eylem kimliği | Durum |
|---|---|---|
| Sahneye geç | `engine.scene.switch` (Studio Mode'da önizlemeye) | UYGULANDI |
| Studio Mode geçişi | `engine.studio.transition` | UYGULANDI |
| Kaynağı göster / gizle | `engine.source.show/hide/toggle` | UYGULANDI |
| Sustur / sesi aç | `engine.audio.mute/unmute/toggle` | UYGULANDI |
| Bas-konuş | `engine.audio.pushToTalk` (bırakınca susar) | UYGULANDI |
| Bas-sustur | `engine.audio.pushToMute` | UYGULANDI |
| Medyayı yeniden başlat / oynat-duraklat | `engine.media.restart/playPause` | UYGULANDI |
| Yayını başlat / durdur | `engine.goLive` / `engine.stopAll` (onay ister) | UYGULANDI |
| Kaydı başlat / durdur | `engine.record.start/stop` | UYGULANDI |
| Tekrarı kaydet | `engine.replay.save` | UYGULANDI |
| Hedef başlat/durdur/yeniden bağlan | `destination.*` | UYGULANDI |
| Kaydı duraklat / sürdür / aç-kapat | `engine.record.pause/resume/togglePause` | UYGULANDI (kodlayıcı yayınla paylaşılıyorsa reddedilir) |
| Kayıt dosyasını böl | `engine.record.split` | UYGULANDI |
| Sanal kamerayı başlat / durdur | `engine.virtualcam.start/stop/toggle` | UYGULANDI |
| Filtreyi aç / kapat | `engine.filter.enable/disable/toggle` (kaynak + filtre adı) | UYGULANDI |
| Sahne öğesi göster/gizle geçişi | `engine.source.show/hide/toggle` öğenin gösterme/gizleme geçişiyle | UYGULANDI (geçiş ayarı ve gizlenme sınandı; geçişin piksel düzeyinde oynaması sınanmadı) |
| T-bar | — | OBS'te de kısayol yok; Studio Mode'da arayüzden |
| Hızlı geçiş | `engine.studio.quickTransition` (adlandırılmış geçiş adı) | UYGULANDI — süre o geçişin hızlı geçiş düğmesinden, yoksa tuvalin süresi |

Çalışma alanı içi (odak panelde): Ctrl+Z/Y geri al/yinele, Ctrl+C/V kopyala/yapıştır, Ctrl+E dönüşüm, Ctrl+F sığdır,
Ctrl+S uzat, Ctrl+D ortala, Ctrl+Home/End en üst/alt, Del kaldır, F2 yeniden adlandır, oklar it (Shift 10 px),
Ctrl+K komut paleti.

Doğrulama: eylemler entegrasyon testleriyle (`motor_kisayol_eylemleri_bas_konus_ve_sahne`,
`motor_kayit_duraklat_bol_dikey_tekrar_sanal_kamera_filtre_eylemi`) sınandı; gerçek küresel tuş
basışı **UNVERIFIED** (masaüstü girdi otomasyonu kullanılmaz; kullanıcı tam ekran oyunda olabilir).
