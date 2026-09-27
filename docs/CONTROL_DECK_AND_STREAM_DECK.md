# Kontrol destesi ve Stream Deck entegrasyonu

Durum: **yerleşik deste IMPLEMENTED + VERIFIED** (tarayıcıda, yalıtılmış StreamAxT'e karşı) ·
**donanım Stream Deck: HTTP yolu VERIFIED (curl), Elgato yazılımıyla uçtan uca UNVERIFIED** — bu makinede Stream Deck
yazılımı yüklü değil (`%APPDATA%\Elgato\StreamDeck` ve `C:\Program Files\Elgato\StreamDeck` yok, süreç yok).

## 1. Tek eylem, çok denetleyici

Bütün denetimler aynı eylem kayıt defterinden geçer (`src-tauri/src/actions/mod.rs`, `/api/actions/run`):

```
denetleyici (Hızlı eylemler | Kontrol destesi | donanım Stream Deck | uzak arayüz)
    → POST /api/actions/run {id, params, confirm}
    → tanım → parametre doğrulama (400) → izin (403) → onay (428) → kullanılabilirlik (409) → yürütme → denetim (ACTION:<id>)
```

Denetleyici ne olursa olsun izin, onay ve denetim günlüğü sunucuda uygulanır; hiçbir denetleyici bunları atlayamaz.

## 2. Yerleşik kontrol destesi (Kontrol Merkezi → "Kontrol destesi")

- Sayfalar (en çok 8) × düğmeler (sayfa başına en çok 24), 6 renk; düzenleme modunda ekle / sil / sola-sağa taşı.
- Parametreli eylemler (sahne, ses girişi, hedef) için öneri listesi: OBS sahneleri/girişleri ve çoklu yayın hedefleri.
  Bağlantı yoksa değer elle yazılabilir; kullanılabilirlik sunucudan gelir ("OBS bağlı değil" vb. düğmede gösterilir).
- Onay isteyen eylemler (yayın/kayıt durdurma, tüm hedefleri bitirme, uyarı kuyruğunu temizleme) **çift dokunuşla**
  çalışır; ilk dokunuş hiçbir istek göndermez (doğrulandı: denetim günlüğü ilk dokunuştan sonra değişmedi).
- Yapılandırma `settings-panel.json` → `controlDeck` (sürümlü, `version: 1`). `parseDeck` bozuk/bilinmeyen alanları ayıklar:
  kimlik biçimi, eylem kimliği biçimi, parametre adları (`__proto__` gibi anahtarlar düşer), renk beyaz listesi, kontrol
  karakterleri. Geçersiz kayıt varsayılan desteye düşer.
- Yeni panel göçü: hazır profilde (kullanıcı özelleştirmemiş) kayıtlı düzene profilin görünürlüğüyle eklenir; özel
  düzende gizli olarak sona eklenir.

Kanıt (OBSERVED_IN_RUNTIME, başsız sunucu + yalıtılmış StreamAxT 3012):
"Uyarıları duraklat" → 3012 `paused: true, updatedBy: yerel`; "Uyarıları sürdür" → `paused: false`; denetimde
`ACTION:alert.pause ok:true`, `ACTION:alert.resume ok:true`. Eklenen düğmeler yeniden yüklemede korundu; silme ve sayfa
silme sunucu kaydına yansıdı. Birim testleri: `src/lib/deck.test.ts`, `src/lib/controlCenter.test.ts`.

## 3. Donanım Stream Deck (Elgato) — HTTP ile

Panel sunucusu yalnız `127.0.0.1:8843`'te dinler. Stream Deck'te genel amaçlı bir "HTTP isteği" eylemi sunan bir eklenti
ile bir tuşa şu istek atanır:

```
POST http://127.0.0.1:8843/api/actions/run
Content-Type: application/json

{"id": "alert.pause", "params": {}, "confirm": false}
```

Örnek gövdeler: `{"id":"scene.switch","params":{"scene":"Oyun"}}`, `{"id":"audio.toggle","params":{"input":"Mikrofon"}}`,
`{"id":"replay.save"}`. Eylem listesi ve anlık kullanılabilirlik: `GET /api/actions`.

Güvenlik davranışı (VERIFIED, curl, başsız sunucu):

| İstek | Sonuç |
|---|---|
| Köken başlığı olmayan yerel POST (`alert.pause`, `alert.resume`) | 200 |
| `Origin: https://evil.example` | 403 (tarayıcı sayfalarından CSRF yok) |
| `Host: attacker.example` | 403 (DNS rebinding yok) |
| Onay gerektiren eylem `confirm` olmadan | 428 "Onay gerekli" |

Uyarı: donanım tuşunda `confirm: true` göndermek çift dokunuş korumasını devre dışı bırakır. Yayın durdurma gibi
eylemler için bunu bilinçli yapın; önerilen, bu eylemleri Stream Deck'te çok eylemli ("multi action") ya da ayrı sayfada
tutmak.

Yerel süreç güveni: geri döngü (loopback) istekleri yerel kullanıcı sayılır — bu, panelin mevcut güven modelidir
(bkz. `SECURITY_REVIEW.md`). Aynı makinede çalışan her süreç bu uca erişebilir; bu yüzden uç yalnız 127.0.0.1'e bağlıdır.

## 4. Yerel Elgato eklentisi — yapılmadı (neden)

`@elgato/streamdeck` 3.0.0 ve `@elgato/cli` 1.10.0 (ikisi de MIT) ile durum simgeli (kullanılabilir/değil) yerel bir
eklenti yazılabilir. Bu turda **yazılmadı**: Stream Deck yazılımı ve donanımı bu makinede yok, doğrulanamayan bir eklentiyi
"çalışıyor" diye teslim etmek kural dışı. Tasarım hazır: eklenti `GET /api/actions` ile durum simgelerini 5 sn'de bir
günceller, tuşa basışta `POST /api/actions/run` çağırır; onaylı eylemlerde tuş ilk basışta "emin misin" durumuna geçer.
Durum: **PLANNED**.
