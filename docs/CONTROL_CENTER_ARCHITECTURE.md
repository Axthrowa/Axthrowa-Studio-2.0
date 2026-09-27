# Control Center Mimarisi

> Ground Control'den alınan ders: yayını **üreten** yüzey (Broadcast) ile **yöneten** yüzey (Control Center) ve
> topluluğu yöneten yüzey (Moderator) ayrı; aynı durumu paylaşırlar. Birebir arayüz kopyası yapılmaz.

## 1. Paneller

| Panel | Veri kaynağı | Durum |
|---|---|---|
| Universal Chat | panel `chatHub` (Kick/Twitch/YouTube) + StreamAxT (Trovo/Discord/TikTok) | VAR — Kontrol Merkezi paneli (görünümler, arama, mesaj silme, Twitch sohbet modları; [MULTICHAT](MULTICHAT_ARCHITECTURE.md)) |
| Activity Feed | StreamAxT `stream_events` + normalize olay | VAR — tekilleştirilmiş panel (ortak akış) |
| Quick Actions | eylem kataloğu ([GROUND_CONTROL_QUICK_ACTION_MATRIX](GROUND_CONTROL_QUICK_ACTION_MATRIX.md)) | VAR — `/api/actions` (izin, onay, denetim) |
| Control Deck | aynı eylem kataloğu, sayfalı düğme ızgarası ([CONTROL_DECK_AND_STREAM_DECK](CONTROL_DECK_AND_STREAM_DECK.md)) | VAR |
| Yayın motoru | kendi yayın çekirdeği (`/api/motor…`, ADR-003): tuval önizlemeleri, kaynaklar, hedef başına tuval | VAR (kısmi: sahne düzenleyici, kayıt düğmesi yok) |
| Stream Preview | OBS program önizlemesi / Kick oynatıcısı (mevcut ProfileDashboard) | KISMİ |
| Stream Metadata | StreamAxT başlık/kategori uçları (yetenek denetimli) | KISMİ |
| Destinations | Output Router durumları ([MULTISTREAM](MULTISTREAM_ARCHITECTURE.md)) | VAR |
| Alert Queue | StreamAxT uyarı kuyruğu + denetim olayları | VAR |
| Moderation | StreamAxT elle moderasyon, ortak kara liste, AutoMod | VAR (StreamAxT sayfaları) |
| Polls / Predictions | Twitch API | EKSİK (yetenek: yalnız Twitch Affiliate/Partner) |
| Stream Health | OBS `GetStats` + hedef ilerlemesi + sistem | KISMİ (StreamHealthCard) |
| Recording / Replay | obs-websocket kayıt ve tekrar arabelleği | KISMİ (kısayol eylemleri) |
| Audio Mini Mixer | obs-websocket ses istekleri | KISMİ (sessize alma eylemleri) |
| Automation | bitiş kuralları, zamanlayıcılar | KISMİ |
| Operator Notes | yerel not | VAR (yalnız bu tarayıcı) |

## 2. Yerleşim motoru (Docking Workspace)

- Model: `{version, workspaces: [{id, name, layout: SplitTree | TabStack, panels: {id: {visible, minimized, popout}}}]}`
  — ağaç: yatay/dikey bölmeler (oran), yapraklarda sekme yığınları.
- İşlemler: sürükle-bırak (bölmeye veya sekme yığınına), yeniden boyutlandır, küçült, gizle, kapat, sıfırla,
  sıralama, **ayrı pencereye taşı** (Tauri `WebviewWindow` — çok monitör §47), kalıcılık (`settings-panel.json`).
- Hazır profiller: Streamer, Moderator, Producer, Chat Focus, Technical, Minimal, Vertical, Multi-platform; kullanıcı
  kendi çalışma alanını kaydeder. Sürüm alanı ile geriye uyumlu göç.
- Performans: paneller sanallaştırılmış liste kullanır; veri güncellemeleri toplu ve seyreltilmiş; çizim yavaşlığı
  yayın hattını etkilemez (yayın ayrı süreçlerde).

## 3. İzin modeli (§55, §56, §102)

| Rol | Kapsamlar (örnek) |
|---|---|
| Owner | hepsi |
| Admin | hepsi (sahip devri hariç) |
| Producer | `scene.*`, `audio.*`, `broadcast.record`, `broadcast.replay`, `alerts.*`, `metadata.edit`, `broadcast.outputs` (onaylı) |
| Technical Operator | `broadcast.*`, `audio.*`, `diagnostics.*` |
| Moderator | `chat.*`, `alerts.control`, `channel.polls`, `activity.read`, onaylı hızlı eylemler |
| Chat Moderator | `chat.read`, `chat.moderate` |
| Guest Operator | açıkça verilen tek tek eylemler |
| Viewer | yalnız okuma |

- Kodlayıcı, OAuth, yayın anahtarı, güvenlik ayarları yalnız Owner/Admin/Technical'a görünür.
- Yerel yayıncı (loopback + `local_guard`) Owner'dır; uzak oturumlar (`remote_users`, Bearer) rolüyle sınırlıdır.
- Her eylem: izin → doğrulama → yetenek → onay (gerekiyorsa) → yürütme → **denetim günlüğü** (kim, ne, ne zaman,
  hedef; sır yok) (§101).

## 4. Ekip çapında uyarı kuyruğu (§57, §58)

- Tek kaynak: StreamAxT uyarı kuyruğu. Denetimler: `pause`, `resume`, `skip`, `mute`, `unmute`, `replay`, `remove`,
  `clearTests`.
- Her denetim bir **sürüm numarasıyla** gelir (iyimser kilit): istemci gördüğü kuyruk sürümünü gönderir; sürüm
  eskiyse (başka moderatör önce davrandıysa) istek reddedilir ve güncel durum döner — "Mod A atladı, Mod B anında görür".
- Durum değişiklikleri WebSocket ile tüm panellere ve OBS uyarı widget'ına aynı olayla yayınlanır.
- Denetim günlüğü: `ALERT_SKIP`, `ALERT_PAUSE`… (kullanıcı, uyarı kimliği, zaman).

## 5. Uzaktan erişim (§64, §100, §149)

Uzak/moderatör istemcileri çekirdeğe doğrudan erişmez: HTTP API (Bearer) → Control Plane (izin + doğrulama + denetim).
QR eşleme, oturum kapsamlı izin ve kısa ömürlü tokenlar Faz 15'te; bugünkü `/remote` paneli Bearer ile çalışıyor.
