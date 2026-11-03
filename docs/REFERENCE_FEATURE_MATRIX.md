# Referans Karşılaştırma Matrisi

> Referans sütunları (SE Core = `obs-streamelements-core` kaynak denetimi, [STREAMELEMENTS_CORE_AUDIT](STREAMELEMENTS_CORE_AUDIT.md)): ✓ = özellik doğrulandı, ~ = kısmi/sınırlı, ✗ = yok, ? = `UNVERIFIED`, — = ilgisiz.
> Doğrulama sınıfları ürün envanterlerinde ([OBS](OBS_COMPLETE_FEATURE_INVENTORY.md), [BotRix](BOTRIX_COMPLETE_AUDIT.md),
> [SE.Live](SELIVE_COMPLETE_AUDIT.md), [Ground Control](GROUND_CONTROL_COMPLETE_AUDIT.md),
> [StreamElements](STREAMELEMENTS_PLATFORM_INVENTORY.md)). "Bizde" sütunu 2026-09-25 başlangıç durumudur.
> Durum: `EXISTING` · `PARTIAL` · `MISSING` · `NEEDS_REFACTOR` · `NOT_APPLICABLE` · `UNVERIFIED`.

> **Bölüm bazında izlenebilirlik:** [PROMPT_TRACEABILITY](PROMPT_TRACEABILITY.md).

> **Güncelleme (2026-09-26, Streaming OS turu):** durum sütunundaki `X ← Y` gösterimi bu turda Y'den X'e geçişi
> ve ilgili commit'i belirtir. Ayrıntı: `docs/IMPLEMENTATION_REPORT.md`, sınırlar: `docs/KNOWN_LIMITATIONS.md`.

| Özellik | Bizde | OBS | SE Core | BotRix | SE.Live | GC | SE | Restream | Hedef davranış | Kanıt | Öncelik | Risk | Durum |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ekran / pencere / oyun yakalama | OBS üzerinden | ✓ | ~ (kaynak ekleme API'si) | — | ✓ (OBS) | — | — | ~ (Studio) | OBS motoru, uygulamadan kaynak ekleme/denetim | SE Core: kaynak | P0 | düşük | PARTIAL (kendi çekirdekte ekran/oyun kaynağı kod yolu — ADR-003, `UNVERIFIED`) |
| Kamera / capture card | OBS üzerinden | ✓ | ~ (video yakalama ekleme) | — | ✓ | — | — | ~ | aynı | SE Core: kaynak | P0 | düşük | PARTIAL |
| Sahne değiştirme | var | ✓ | — | — | ✓ | — | — | — | hızlı eylem + kısayol + uzaktan | envanterler | P0 | düşük | EXISTING |
| Sahne düzenleme (dönüşüm, kilit, sıra) | ✗ | ✓ | ~ (öğe CRUD, dönüşüm, grup) | — | ✓ | — | ~ (overlay editör) | — | obs-websocket ile temel düzenleme; asıl düzenleyici OBS | SE Core: kaynak | P1 | orta | MISSING |
| Stüdyo modu / geçişler | ✗ | ✓ | ~ (tuval geçişi) | — | ✓ | — | — | — | önizleme/program + geçiş tetikleme | SE Core: kaynak | P2 | düşük | MISSING |
| Ses karıştırıcı (seviye, sessiz) | kısmi (kısayollar) | ✓ | ✗ (OBS'in karıştırıcısı) | — | ✓ | — | — | ~ | mini karıştırıcı paneli + ölçer | SE Core: kaynak; bizde: gerçek OBS'e karşı ölçüm | P1 | orta | PARTIAL (Kontrol Merkezi'nde susturma + tepe/ortalama ölçer, 4b8b20d; ses seviyesi/pan yok) |
| Ses izleri / hedef başına iz | ✗ | ✓ (6 iz) | ✓ (çıkış başına iz) | — | ? | — | — | — | iz yönlendirme; hedef başına iz ileri faz | SE Core: kaynak | P2 | orta | PARTIAL (çekirdek 6 iz ve kayıtta çoklu iz destekler; panel seçimi yok) |
| Ses filtreleri | kısmi (aç/kapa) | ✓ | ~ (filtre türü/özellik sorgusu) | — | ✓ | — | — | — | filtre aç/kapa + ayar | SE Core: kaynak | P2 | düşük | PARTIAL |
| NVENC / kodlayıcı seçimi | OBS profilinde | ✓ | ✓ (kodlayıcı sınıfları, tembel oluşturma) | — | ✓ | — | — | — | profil okuma + politika uyarıları | SE Core: kaynak; bizde: çalışma anı profil okuma | P0 | orta | EXISTING ← PARTIAL (profil okuma + politika uyarıları; kodlayıcı OBS'te seçilir) |
| Kayıt | kısayolla | ✓ | ✓ (tuval başına kayıt çıkışı, bölme) | — | ✓ | — | — | ✓ (bulut) | başlat/durdur/böl/bölüm + durum | SE Core: kaynak | P0 | düşük | PARTIAL |
| Tekrar arabelleği / Backtrack | kısayolla | ✓ | ✓ (tuval başına, kaydet tetikleyici) | — | ✓ (tuval başına, yalnız yayında) | — | — | — | kaydet eylemi + olayla kaydet + maliyet göstergesi | SE Core: kaynak | P2 | orta | PARTIAL |
| Sanal kamera | ✗ | ✓ | ✗ | — | ✓ | — | — | — | başlat/durdur eylemi | SE Core: kaynak (API'de yok) | P3 | düşük | MISSING |
| Tek hedefe yayın | var (OBS) | ✓ | — | — | ✓ | — | — | ✓ | — | envanterler | P0 | — | EXISTING |
| **Çoklu yayın** | ✗ | ✗ (tek servis) | ✓ (hedef başına OBS çıkışı, kodlayıcı paylaşımı) | — | ✓ (yerel) | — | — | ✓ (bulut) | tek kodlama → çok hedef, hedef başına durum | SE Core: kaynak; bizde: e2e test + ölçüm | P1 | yüksek | EXISTING ← MISSING (5ce161d, f3b0a16, af32308) |
| Hedef başına başlat/durdur | ✗ | — | ✓ | — | ? | — | — | ~ | canlıyken tek hedefi durdur/yeniden başlat | SE Core: kaynak; bizde: e2e test | P1 | yüksek | EXISTING ← MISSING (5ce161d) |
| Hedef sağlığı (bit hızı, yeniden bağlanma) | ✗ | ~ (tek çıkış) | ~ (yeniden bağlanma, düşen kare, tıkanıklık) | — | ? | — | — | ✓ | kart başına sağlık | SE Core: kaynak; bizde: birim + e2e test | P1 | orta | EXISTING ← MISSING (kbps/fps/hız/düşen/yeniden deneme) |
| Çoklu tuval (dikey) | ✗ | ~ (altyapı + eklenti) | ✓ (özel canvas) | — | ✓ | — | — | ~ | tuval keşfi + bağlı sahneler | SE Core: kaynak; kullanıcı OBS: çalışma anı; bizde: sentetik sınama | P2 | yüksek | IMPLEMENTED (kendi çekirdekte 1920×1080 + 1080×1920, paylaşılan kaynak, tuval başına kodlayıcı — 1a2417a) ← MISSING; bağlı sahneler yok |
| Twitch Dual Format | ✗ | ✓ (Enhanced Broadcasting + ek tuval) | ~ (paylaşımlı tuval → ek tuval) | — | ✓ | — | — | ? | OBS ayarlarına rehberlik + kontrol listesi | SE Core: resmi API belgesi | P2 | orta | MISSING |
| Bulut aktarımı | ✗ | ✗ | ✗ | — | ✗ | — | — | ✓ | aynı durum makinesiyle bulut hedefi | SE Core: kaynak | P3 | yüksek | MISSING |
| SRT | ✗ | ✓ (çıkış) | ? | — | ? | — | — | ✓ | FFmpeg ile hedef/alıcı | — | P3 | orta | MISSING |
| Birleşik sohbet | var | ✗ | — | ~ | ? | ✓ | — | ✓ (Chat) | panel + filtreler + moderasyon | envanterler | P1 | orta | EXISTING |
| Sohbet filtreleri (platform, bahsetme, mod, arama) | kısmi | — | — | ? | ? | ? | — | ? | filtre çubuğu | envanterler | P1 | düşük | EXISTING ← PARTIAL (görünümler, platform seçimi, arama, bot süzgeci; 03d1fce) |
| Sohbet moderasyonu (sil/zaman aşımı/ban) | var (AxBoT) | — | — | ✓ | ? | ? | ~ | ? | yetenek denetimli, denetim günlüklü | envanterler | P1 | orta | EXISTING |
| Çok platformlu etkinlik akışı | kısmi | — | — | ✓ | ✓ | ✓ | ✓ | ~ | normalize olay + filtre | envanterler | P1 | orta | PARTIAL |
| Uyarılar | var | — | — | ✓ | ✓ | — | ✓ | — | durum makinesi + test laboratuvarı | envanterler | P1 | orta | EXISTING |
| **Uyarı kuyruğu denetimi** (duraklat, sürdür, atla, sustur) | ✗ (`skipEnabled` etkisiz) | — | — | ? | ? | ✓ | ✓ | — | ekip çapında, iyimser kilitli, denetim günlüklü | GC: resmi; bizde: canlı yalıtılmış test | P1 | orta | EXISTING ← MISSING (AxBoT b53051d; panel af32308) |
| Hızlı eylemler | kısmi (kısayollar) | ~ (kısayol) | — | — | ? | ✓ | — | — | izinli eylem kataloğu | GC: resmi | P1 | orta | PARTIAL (Kontrol Merkezi: tek dokunuş sahne/susturma, çift onaylı yayın eylemleri) |
| Stream Deck | ✗ | ~ (eklentiyle) | — | — | ? | ✓ | — | — | yerel API + eklenti | envanterler; bizde: curl | P3 | orta | PARTIAL ← MISSING (yerel HTTP eylem ucu `/api/actions/run` genel HTTP eklentileriyle kullanılabilir — curl ile VERIFIED; Elgato yazılımı bu makinede yok → uçtan uca UNVERIFIED; yerel eklenti PLANNED — bkz. CONTROL_DECK_AND_STREAM_DECK.md) |
| Dahili dokunmatik deste | ✗ | — | — | — | — | — | — | — | ızgara, sayfa, çoklu eylem | envanterler; bizde: tarayıcı | P3 | düşük | IMPLEMENTED + VERIFIED ← MISSING (sayfa, renk, çift dokunuşlu onay, sunucuda kalıcı; çoklu eylem/makro yok) |
| Yerleşim motoru (dock) | ✗ (sekme) | ✓ (dock) | ~ (OBS dock API'si) | — | ✓ (dock) | ✓ | — | — | bölme ağacı + sekme yığını + ayrı pencere | SE Core: kaynak | P1 | orta | PARTIAL ← MISSING (panel ızgarası: gizle/sırala/genişlik/hazır düzen; bölme ağacı ve ayrı pencere yok) |
| Moderatör / ekip rolleri | kısmi (uzak kullanıcı rolü) | — | — | ~ | — | ✓ | ~ | ✓ (takım) | RBAC + kapsamlar | envanterler | P2 | yüksek | PARTIAL |
| Denetim günlüğü | kısmi | — | — | ? | — | ? | ? | ? | tüm Control Plane eylemleri | bizde: API testi | P1 | düşük | PARTIAL (çoklu yayın + uyarı denetimi günlükte; sahne/susturma henüz değil) |
| Başlık / kategori yönetimi | var (AxBoT) | — | — | ✓ | ? | ✓ (Twitch) | ✓ | ✓ | çok platformlu toplu düzenleme | envanterler | P1 | orta | EXISTING |
| Anket / tahmin | ✗ | — | — | ~ (anket widget) | ? | ✓ (Twitch) | ~ | — | adaptör yetenekli | envanterler | P2 | orta | MISSING |
| Yayın öncesi kontrol listesi | ✗ | — | ~ (bant genişliği testi) | — | ? | ✓ | — | ? | politika kuralları + cihaz/ağ | SE Core: kaynak; GC: resmi (başlık) | P1 | orta | PARTIAL ← MISSING (platform kuralları + OBS profili; cihaz/ağ denetimi yok) |
| Platform politika uyarıları | ✗ | — | — | — | ? | ? | — | ✓ (kurallar blogu) | yapılandırılabilir kural tablosu | platform resmi belgeleri | P1 | orta | EXISTING ← MISSING (policy.rs kural tablosu) |
| Komutlar / zamanlayıcılar / modüller | var | — | — | ✓ | ~ | ✓ | ✓ | — | — | envanterler | — | — | EXISTING |
| TTS | var | — | — | ✓ | ? | ? | ✓ | — | kuyruk + moderatör denetimi | envanterler | P1 | düşük | EXISTING |
| Sadakat / mağaza / hedefler | var | — | — | ✓ | — | ~ | ✓ | — | — | envanterler | — | — | EXISTING |
| Özel widget SDK'sı | ✗ | ~ (tarayıcı kaynağı) | — | ~ (özel kod) | ✓ (SE widget) | — | ✓ | — | kum havuzlu, izin kapsamlı | envanterler | P3 | yüksek | MISSING |
| Overlay düzenleyici | kısmi (OverlayStudio) | ✓ (sahne) | — | ~ | ✓ | — | ✓ | ✓ | katman, kılavuz, geri al | envanterler | P2 | orta | PARTIAL |
| Otomasyon stüdyosu | kısmi | ~ (kısayol, betik) | — | ~ | ? | — | ~ | — | düğüm editörü | envanterler | P2 | orta | PARTIAL |
| Uzaktan denetim | kısmi (`/remote`) | ✓ (websocket) | — | — | — | ✓ (masaüstü) | ~ | ✓ | QR eşleme, kapsamlı oturum | envanterler | P3 | yüksek | PARTIAL |
| AI asistan | kısmi (Gemini) | — | — | ~ | ? | ? | ? | ~ | yayın akışından yalıtılmış | envanterler | P3 | orta | PARTIAL |
| Sağlık paneli / tanılama | kısmi | ✓ (istatistik) | — | — | ? | ? | — | ✓ | tek bildirim merkezi | envanterler | P1 | orta | PARTIAL |
| Güvenlik (yerel API, köken) | 4. turda sağlamlaştırıldı | — | — | — | — | — | — | — | sürekli | envanterler | P0 | yüksek | EXISTING |
