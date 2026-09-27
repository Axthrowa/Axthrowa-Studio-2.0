# Ground Control Hızlı Eylemleri → Bizim Quick Action Center

> Kaynak kısıtı: uygulama bu turda açılmadı (bkz. [GROUND_CONTROL_COMPLETE_AUDIT](GROUND_CONTROL_COMPLETE_AUDIT.md)).
> Aşağıdaki liste yalnız resmi kaynaklarda **adı geçen** eylemlerdir; "tümünü keşfet" hedefi `BLOCKED`.

## 1. Ground Control'de belgelenen eylemler

| Eylem | Sınıf | Kaynak |
|---|---|---|
| Uyarıları duraklat | `CONFIRMED_IN_OFFICIAL_DOCS` | ürün sayfası |
| Uyarıları sustur | `CONFIRMED_IN_OFFICIAL_DOCS` | ürün sayfası |
| Reklamı ertele (ad snooze) | `CONFIRMED_IN_OFFICIAL_DOCS` | ürün sayfası |
| Uyarıyı atla | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` | Stream Deck açıklaması (Mute, Pause, Skip Alerts) |
| Sıradaki uyarıları duraklat / oynat | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` | resmi X duyurusu |
| Sohbet botu zamanlayıcılarını aç/kapa | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` | resmi X duyurusu |
| Tek tıkla tahmin | `CONFIRMED_IN_OFFICIAL_DOCS` | ürün sayfası |
| Anket / tahmin (Twitch Affiliate/Partner) | `CONFIRMED_IN_OFFICIAL_DOCS` | ürün sayfası |
| Başlık / kategori hızlı ayarları (Twitch) | `CONFIRMED_IN_OFFICIAL_DOCS` | ürün sayfası |
| Komut, sayaç, modül, değişken yönetimi | `CONFIRMED_IN_OFFICIAL_DOCS (özet)` | 2.0 duyurusu |
| Moderasyon eylemleri (sil, zaman aşımı, ban) | `UNVERIFIED` | — |
| Uyarıyı yeniden oynat, kuyruktan çıkar | `UNVERIFIED` | — |

## 2. Bizim eylem kayıt defterimiz — 2026-09-26 (UYGULANDI)

Kod: `src-tauri/src/actions/mod.rs` (tanımlar, doğrulama), `src-tauri/src/server/actions_api.rs` (`/api/actions`,
`/api/actions/run`). Her çağrı: izin → onay → parametre doğrulama → kullanılabilirlik → yürütme → denetim günlüğü
(`ACTION:<id>`). Kontrol Merkezi "Hızlı eylemler" ve "Sahne & Ses" panelleri bunu kullanır.

| Eylem | Konum | Platform / bileşen | İzin | Onay | Yan etki | Kullanılabilirlik |
|---|---|---|---|---|---|---|
| `scene.switch` | Sahne & Ses | OBS (ana tuval) | `scene.switch` | — | program sahnesi değişir | OBS bağlıysa |
| `audio.mute` / `audio.unmute` / `audio.toggle` | Sahne & Ses | OBS girişi | `audio.control` | — | giriş susar/açılır | OBS bağlıysa |
| `record.start` | Hızlı eylemler | OBS | `broadcast.record` | — | kayıt başlar (zaten açıksa hata değil) | OBS bağlıysa |
| `record.stop` | Hızlı eylemler | OBS | `broadcast.record` | **çift onay** | kayıt biter | OBS bağlıysa |
| `replay.save` | Hızlı eylemler | OBS tekrar arabelleği | `broadcast.replay` | — | klip dosyası yazılır | OBS bağlı + arabellek açık (değilse açıklayıcı hata) |
| `stream.start` / `stream.stop` | Hızlı eylemler | OBS ana yayın | `broadcast.stream` | **çift onay** | yayın başlar / biter | OBS bağlıysa |
| `destination.start` | Hedefler kartı / API | çoklu yayın | `broadcast.outputs` | — | tek hedef bağlanır | oturum açıksa |
| `destination.stop` | Hedefler kartı / API | çoklu yayın | `broadcast.outputs` | **çift onay** | tek hedef durur, diğerleri sürer | oturum açıksa |
| `destinations.stopAll` | Hızlı eylemler | çoklu yayın | `broadcast.outputs` | **çift onay** | tüm hedefler ve alıcı kapanır | oturum açıksa |
| `alert.pause` / `resume` / `skip` / `mute` / `unmute` | Hızlı eylemler | StreamAxT uyarı kuyruğu (ekip çapında) | `alerts.control` | — | tüm panellere anında yayılır | StreamAxT çalışıyorsa |
| `alert.clear` | Hızlı eylemler | StreamAxT | `alerts.control` | **çift onay** | bekleyen uyarılar silinir | StreamAxT çalışıyorsa |

Kapsam dışı kalanlar (MISSING): reklam çalıştır/ertele, anket/tahmin, başlık/kategori, klip oluştur (platform API),
acil "hepsini sustur" makrosu, yerel Elgato Stream Deck eklentisi (PLANNED).

Sonradan eklenenler: **Kontrol destesi** (aynı eylemleri sayfalı düğme ızgarasında çalıştırır; onaylı eylemler çift
dokunuşla) ve donanım Stream Deck için genel HTTP ucu — bkz. `CONTROL_DECK_AND_STREAM_DECK.md`. Twitch yavaş / abone /
takipçi / yalnız-emote modları StreamAxT moderasyon ucunda ve Evrensel sohbet panelinde (yalnız Twitch; bkz.
`MULTICHAT_ARCHITECTURE.md` §4).

---

## 3. Önceki hedef kataloğu (2026-09-25)



Her eylem: kimlik, etiket, simge, gerekli izin (`scope`), onay gereksinimi (tehlikeli eylemlerde basılı tutma veya
çift onay), platform yetenek denetimi, durum (açık/kapalı/meşgul) ve denetim günlüğü kaydı.

| Eylem | Kapsam (izin) | Onay | Yetenek denetimi | Mevcut durum |
|---|---|---|---|---|
| Uyarıları sustur / sesi aç | `alerts.control` | — | — | EKSİK (StreamAxT'te kuyruk var, sustur yok) |
| Uyarı kuyruğunu duraklat / sürdür | `alerts.control` | — | — | EKSİK |
| Geçerli uyarıyı atla | `alerts.control` | — | — | EKSİK (`alertQueue.atla` yalnız testte) |
| Test uyarılarını temizle | `alerts.control` | — | — | EKSİK |
| Uyarıyı yeniden oynat | `alerts.control` | — | — | EKSİK |
| Tekrarı kaydet | `broadcast.replay` | — | OBS tekrar arabelleği etkin mi | KISMİ (OBS kısayolu) |
| Klip oluştur | `broadcast.clip` | — | platform klip API'si | EKSİK |
| Mikrofonu / müziği sustur | `audio.control` | — | kaynak eşlemesi | VAR (kısayol eylemleri) |
| Sahne değiştir | `scene.switch` | — | — | VAR |
| Kaydı başlat / durdur | `broadcast.record` | durdurmada | — | VAR (OBS eylemi) |
| Yavaş kip | `chat.moderate` | — | platform destekliyorsa | EKSİK |
| Reklam çalıştır | `channel.ads` | evet | Twitch yetkisi | EKSİK |
| Anket / tahmin oluştur | `channel.polls` | — | Twitch Affiliate/Partner | EKSİK |
| Botu aç/kapa | `bot.control` | — | — | KISMİ |
| TTS'i aç/kapa | `tts.control` | — | — | KISMİ (StreamAxT ayarı) |
| Acil sahne / BRB | `scene.switch` | basılı tut | — | KISMİ (BRB sahnesi) |
| Hepsini sustur (acil) | `audio.control` | basılı tut | — | EKSİK |
| Hedefi durdur / hepsini bitir | `broadcast.outputs` | çift onay | hedef durumu | EKSİK (çoklu yayın yok) |

Ayrıntılı tasarım ve izin modeli: [CONTROL_CENTER_ARCHITECTURE](CONTROL_CENTER_ARCHITECTURE.md).
