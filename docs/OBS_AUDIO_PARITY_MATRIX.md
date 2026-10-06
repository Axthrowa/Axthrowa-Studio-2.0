# OBS ses paritesi matrisi

| OBS özelliği | Bizde | Durum | Kanıt |
|---|---|---|---|
| Mikserde her ses kaynağı | Ses taşıyan her kaynak ayrı kanal; programda olmayan soluk | UYGULANDI | `/api/motor/ses`, arayüz |
| Fader (dB) | 0 dB üst, −∞ alt; çift tık 0 dB | UYGULANDI | fader −30,0 dB = çarpan 0,0316 (arayüz sınaması) |
| VU ölçer (tepe, RMS, tepe tutma, kırpılma) | libobs volmeter, 20 Hz, yalnız abone varken; rAF ile çizim | UYGULANDI | ölçer RMS ≈ −21 dBFS (FFmpeg sinüsü) |
| Sustur | Kanal düğmesi, eylem, kısayol | UYGULANDI | |
| Solo | — | YOK | OBS'te de yok |
| Bas-konuş / bas-sustur | Eylem + küresel kısayol bırakma olayı | UYGULANDI | entegrasyon (basılı/bırakıldı) |
| Gelişmiş Ses Özellikleri | Düzey (+26 dB), mono, denge, senkron, izleme, iz 1–6 | UYGULANDI | arayüz + entegrasyon |
| Ses izleme | Kapalı / yalnız izle / izle+çıkış; izleme aygıtı | UYGULANDI (yalnız "kapalı" sınandı) | hoparlöre ses verilmez kuralı |
| 6 iz, adlandırılmış karışımlar | Profil iz adları; hedef ve kayıt iz seçimi | UYGULANDI | "iz 1 sessiz, iz 2 tonlu" çok izli kayıtta |
| Ses filtreleri | Kurulu OBS'in ses filtreleri | UYGULANDI | kazanç −20 dB → ölçerde 20,0 dB düşüş |
| Uygulama sesi yakalama | wasapi_process_output_capture | UNVERIFIED | |
| Oyun/pencere yakalamada ses | capture_audio | UNVERIFIED | |
| Çift ses uyarısı | Uygulama + masaüstü ortak izde | UYGULANDI | birim testi |
| Senkron kaydırma | −950…20000 ms | UYGULANDI | |
| Tarayıcı sesi | reroute_audio: mikserde | UYGULANDI | WebAudio ≈ −26 dBFS |
| Medya denetimi | oynat/duraklat/baştan | UYGULANDI | |
| Global ses aygıtları (Ayarlar › Ses) | Kaynak olarak eklenir | FARKLI | |
