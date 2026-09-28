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
| Sahne öğesi göster/gizle geçişi | — | YOK |
| Filtre aç/kapat kısayolu | OBS tarafı (`filter`) var; motor için yok | KISMİ |

Çalışma alanı içi (odak panelde): Ctrl+Z/Y geri al/yinele, Ctrl+C/V kopyala/yapıştır, Ctrl+E dönüşüm, Ctrl+F sığdır,
Ctrl+S uzat, Ctrl+D ortala, Ctrl+Home/End en üst/alt, Del kaldır, F2 yeniden adlandır, oklar it (Shift 10 px),
Ctrl+K komut paleti.

Doğrulama: eylemler entegrasyon testiyle (`motor_kisayol_eylemleri_bas_konus_ve_sahne`) sınandı; gerçek küresel tuş
basışı **UNVERIFIED** (masaüstü girdi otomasyonu kullanılmaz; kullanıcı tam ekran oyunda olabilir).
