# Evrensel Çok Platformlu Sohbet Mimarisi

> Durum: **IMPLEMENTED (kısmi kapsam)** — 2026-09-26. Kod: `src/lib/chat/{model,normalize,store}.ts` (saf, testli),
> `src/components/control/UniversalChat.tsx` (Kontrol Merkezi panelleri). Kaynak bağdaştırıcılar AxBoT'ta.

## 1. Akış

```
Kick (Pusher) ─┐
Twitch (IRC) ──┤   AxBoT platform bağdaştırıcıları (base.ts + capabilities.ts)
YouTube ───────┤         │  ChatMessagePayload / olay yükleri
Trovo ─────────┤         ▼
Discord ───────┤   AxBoT event-bus → pipeline (kara liste, kalkan, AutoMod…)
TikTok (okuma) ┘         │  ws/server.ts: {type:"chat"} (+karaListede / kalkanda), {type:"alert", subType, data, alert}
                         ▼
          Panel: paylaşılan tek WebSocket (UniversalChat.tsx, useSyncExternalStore)
                         │  100 ms partiler
                         ▼
          normalizeChat / normalizeActivity  →  ChatState (halka tampon, tekilleştirme)
                         │
              ┌──────────┴──────────┐
     Evrensel sohbet paneli     Etkinlik akışı paneli
```

Platforma özgü koşullar arayüzde yok: arayüz yalnız normalleştirilmiş modeli ve AxBoT'un yetenek tablosunu
(`/api/platforms/capabilities`) bilir.

## 2. Normalleştirilmiş model (`NormalizedChatMessage`)

| Alan | Kaynak / kural |
|---|---|
| `key` | `platform:messageId` — tekilleştirme; ileti kimliği yoksa `yerel-<zaman>-<sayaç>` |
| `userKey` | **`platform:userId`**; kimlik yoksa `platform:ad:<ad>` ve `userKeySource: "name"` işareti. Farklı platformlardaki aynı ad asla birleştirilmez (testli) |
| `roles` | yayıncı / moderatör / VIP / abone (platform bayraklarından) |
| `mentionsChannel` | ileti kanal adını `@` ile ya da kelime sınırında içeriyor mu (Türkçe/Unicode harf sınırı) |
| `isQuestion` | soru işaretiyle biten/içeren, ≥ 4 karakter |
| `isBot` / `isSystem` | AxBoT'un bot ve "gönderilemedi" satırları |
| `moderation` | `blocked` (ortak kara liste), `shielded` (kalkan kuralı + neden) — bu iletiler OBS sohbetinde zaten gizli |
| `isPaid`, `amount`, `currency` | yükte tutar varsa |
| `firstInSession` | depo ekler: bu oturumda kişinin ilk iletisi (bot/sistem hariç) |
| `color` | yalnız `#hex` kabul edilir (stil enjeksiyonu yok) |

Ham yük saklanmaz (bellek); gerekirse AxBoT günlüğünde.

## 3. Depo

- Halka tampon **1500 ileti**; tekilleştirme anahtar kümesi 4× sınırda budanır.
- Etkinlik: olay kimliği = AxBoT uyarı kimliği (olay başına benzersiz) → yeniden bağlanmada çift kayıt yok;
  en yeni başta, 300 sınır.
- Görünümler: **Tümü, Bahsetmeler, Sorular, İlk kez yazanlar, Abone/üye, Ücretli, Moderasyon**; platform süzgeci
  (çoklu seçim, sayaçlı), bot göster/gizle, Türkçe büyük/küçük harf duyarsız arama.
- Çizim sınırı: DOM'da en fazla 250 satır (eskiler aramayla bulunur); akışı dondur/sürdür ("N yeni ileti").

## 4. Moderasyon ve gönderim

| Eylem | Nasıl | Koşul |
|---|---|---|
| 10 dk zaman aşımı / kalıcı ban | AxBoT `POST /api/moderation/{timeout,ban}` (AxBoT tarafı: platform yeteneği + bağlantı denetimi + denetim günlüğü `MANUAL_*`) | düğme yalnız yetenek VE bağlantı varsa ve hedef yayıncı/moderatör değilse görünür; **çift onay** |
| Bot olarak yaz | WS `send_chat` → AxBoT bot hesabı | hedef "Tüm platformlar" ya da bağlı + `sohbet.gonder` yetenekli platform |
| Mesaj silme | AxBoT `POST /api/moderation/delete-message` {platform, mesajId} → platform bağdaştırıcısı; denetim `MANUAL_DELETE` (AxBoT 64023eb, panel 8d5e65b) | yetenek `moderasyon.mesajSil` + bağlantı + platform mesaj kimliği; **çift onay** |
| Yavaş / takipçi / abone / emote modu | AxBoT `POST /api/moderation/chat-mode` → Twitch Helix `PATCH /chat/settings` (kapsam `moderator:manage:chat_settings`; yavaş mod 3–120 sn, takipçi modu 0–129600 dk — Twitch resmi belgesinden, Chrome ile doğrulandı) | yalnız Twitch (`moderasyon.sohbetModlari`); Kick ve YouTube'da resmi API yok → düğme gizlenmez, devre dışı + neden |
| Yanıt, sohbeti temizle (platformda) | **MISSING** | bağdaştırıcıların yanıt zinciri / toplu temizleme yöntemi yok |

Hız sınırı: giden iletiler AxBoT'un platform bağdaştırıcılarında (platform başına kuyruk, yeniden deneme) —
panel ek kuyruk tutmaz.

## 5. Doğrulama

- Birim: kimlik ayrımı, ada düşme işareti, roller/bot/sistem/kara liste/kalkan, bozuk yük, bahsetme/soru, tekilleştirme,
  ilk kez yazan, tampon sınırı, görünümler + platform + arama, etkinlik idempotentliği (`src/lib/chat/chat.test.ts`).
- Tarayıcıda (yalıtılmış AxBoT, platform bağlantısız): 3 TEST uyarısı → etkinlik akışında platform rozeti, tutar,
  ay, TEST işareti; panelden gönderilen ileti bot satırı olarak geldi, platform bağlı olmadığı için "Gönderilemedi"
  sistem satırları; Moderasyon görünümü yalnız sistem satırlarını, bot süzgeci bot satırlarını ayırdı.
- **Canlı platformda doğrulanmadı** (gerçek sohbet/moderasyon kullanıcı kuralı gereği tetiklenmedi).

## 6. Eksikler (sonraki iş)

1. Platform sütunları görünümü (yan yana), gerçek sanallaştırma (değişken satır yüksekliği ölçümü).
2. Emote/ek parçaları (`messageParts`), yanıt zinciri (`replyTo`), silinen ileti işareti — bağdaştırıcıların bu alanları
   yayınlaması gerekir.
3. Ücretli ileti türleri (Super Chat, Bits, Kicks) sohbet yükünde tutarla gelmiyor; bugün etkinlik akışında.
4. ~~Kanal modları ve mesaj silme için AxBoT'a yetenek güdümlü uçlar~~ → **yapıldı** (§4). Canlı platformda
   denenmedi (gerçek moderasyon kullanıcı kuralı gereği tetiklenmedi); hata/yetenek yolları yalıtılmış AxBoT'a
   karşı 8 durumda doğrulandı, Twitch gövde kuralları birim testli (`twitch-rules.test.ts`).
