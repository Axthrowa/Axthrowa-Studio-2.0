# Widget incelemesi — BotRix panel karşılaştırması

**Amaç:** BotRix'in widget panelindeki *işlev ve arayüz* seviyesini yakalamak.
**Kural:** BotRix kodu kopyalanmaz. Yalnız davranış/ayar listesi gözlemlenir,
kendi uygulamamız sıfırdan yazılır.

İnceleme tarihi: 2026-09-21 · Hesap: Kick platformu, ücretsiz plan.

---

## 1. Panel yapısı (gözlem)

Her widget sayfası aynı iskeleti kullanıyor:

1. Başlık + kısa açıklama
2. **OBS Widget'ı** bölümü: "Bu linki kimseyle paylaşma" uyarısı + `Widget URL'si` + **Kopyala**
3. **Önizleme** (bazı widget'larda)
4. **Ayarlar** bölümü: PLATFORMLAR (Twitch / YouTube / Kick onay kutuları) + SEÇENEKLER
5. Gerekirse **Değişiklikleri kaydet** ve widget'a özel eylem düğmeleri
   (ör. "Bekleme süresini sıfırla", "Kupayı boşalt")

Premium kilidi: bazı temalar `⭐` ile işaretli; bazı widget'lar tamamen kilitli
(aşağıda işaretli).

---

## 2. Widget listesi (21) ve rotaları

| Widget | Rota | Durum |
|---|---|---|
| Chat Overlay | `/panel/widget/chat` | açık |
| Şans Çarkı | `/panel/widget/fortunewheel` | açık |
| Takipçi Hedefi | `/panel/widget/followers` | açık |
| Abone Hedefi | (hedef ailesi) | açık |
| Bağış Hedefi | (hedef ailesi) | açık |
| KICKs Hedefi | (hedef ailesi) | açık |
| Aktivite Akışı | `/panel/widget/activityfeed` | açık |
| Etkinlik Etiketleri | `/panel/widget/labels` | açık (BETA) |
| Kupa | `/panel/widget/cup` | açık (BETA) |
| İzleyici Sayacı | `/panel/widget/viewers` | açık |
| Şu An Çalan Şarkı | `/panel/widget/songrequest` | açık |
| Emoji Kombosu | `/panel/widget/emotecombo` | açık |
| Anketler (Encuestas) | `/panel/widget/polls` | açık |
| TTS | `/panel/widget/tts` | açık |
| Ekranda Emojiler | ? | açık |
| Sabitlenmiş Mesajlar | ? | açık |
| Sadakat Ödülleri | ? | açık |
| Shoutout | ? | açık (BETA) |
| Çekilişler | ? | açık |
| Jenerik (credits) | ? | açık |
| **Hype Treni** | `/panel/widget/hypetrain` | **premium kilitli** |
| **Subathon** | — | **premium kilitli (V2)** |

> Premium kilitli ikisinin ayar listesi bu hesapla görülemiyor. Bizim
> uygulamamızda ikisi de zaten ücretsiz ve ayarları eklendi.

---

## 3. Widget bazında ayar envanteri (gözlemlenen)

### Chat Overlay (`/chat`) — 22 kontrol
- PLATFORMLAR: Twitch, YouTube, Kick
- Animasyon (10): Kayarak giriş, Soluk geçiş, Zıplama, Sekerek giriş, Yakınlaşma,
  Dönerek giriş, Döndürerek giriş, Sallanarak giriş, Yuvarlanarak giriş, Animasyon yok
- Tasarım (24, 13'ü premium): Aurora, Bubbles, Cake, Carbon, Default, Glass, Minimal,
  Platform Accent, Side, StreamLine, Transparent, White, ★Hacker, ★Neon, ★Neon Cards,
  ★Pastel Pop, ★Pixel Quest, ★Rounded, ★Sky, ★Sunset, ★Window Glass, ★WhatsChat,
  ★Retro, ★Velvet
- Yazı tipi (dropdown)
- Mesaj yönü: yeni mesajlar altta / üstte
- Arka plan (renk)
- Bot mesajlarını gizle
- BetterTTV / 7TV emojileri
- Eski mesajları gizle + süre (ör. 15 saniye)
- Yeni mesaj sesi
- Bağış mesajlarını göster
- Puan ödülü mesajlarını göster
- Yazı boyutu (kaydırıcı)
- Komutları gizle ( ! )
- Stream Together mesajları
- Yoksayılan kullanıcılar (liste)
- Platform ikonunu göster
- Mesaj saatini göster

### Şans Çarkı (`/fortunewheel`)
- **Çark profilleri**: yeni profil, ücretsizde 1 çark, premiumda 10
- Komut (ör. `!cark`)
- Bekleme süresi (20 kademe): 30sn, 1dk, 2, 3, 5, 10, 15, 20, 30dk, 1sa … 24sa, 7g, 30g
- Tema (28, 15'i premium): Rainbow, Red, Green, Blue, Yellow, Cyan, Magenta, Orange,
  Purple, Pink, Brown, White, Slot Machine, ⭐Confetti, ⭐UNO, ⭐Papercraft,
  ⭐PixelQuest, ⭐NoirLux, ⭐Candy, ⭐Aurora, ⭐Slate, ⭐Inferno, ⭐Neon Glow,
  ⭐Carnival, ⭐Hacker, ⭐Retro 8-bit, ⭐Vegas, ⭐Matrix
- İzin verilen roller (Kick): Herkes / …
- Kullanıcı adını göster
- Öğe listesi (dilimler)
- Gelişmiş ayarlar
- Eylem: **Bekleme süresini sıfırla**, Önizleme

### Hedef widget'ları (`/followers`, abone/bağış/KICKs aynı iskelet)
- Tasarım (ör. Clean)
- Mod: Tüm zamanlar / Özel süre
- Hedef tutar
- Arka plan rengi
- Metin rengi
- Mesaj (şablon)
- Tipografi

### Aktivite Akışı (`/activityfeed`)
- Mod: **Dock** / **Widget** (radyo)
- Uyarıyı tekrar et, sessiz, duraklat, atla (yönetim eylemleri)

### İzleyici Sayacı (`/viewers`)
- İkonu göster
- Yuvarlatılmış
- Arka plan, Renk
- Tipografi
- Hizalama
- Platformlar: Kick, Twitch, YouTube
- Tema (ücretsiz): Classic, Minimal, Glass, Neon
- Tema (premium): Velvet, Ticker, Capsule, Holochip, SplitFlap
- Çoklu platform modu

### Şu An Çalan Şarkı (`/songrequest`)
- Mod: YouTube / Spotify (yakında)
- Tasarım (16, 9'u premium): Base, Glass, Pill, Wave, HoloChip, IsoBand, PaperCraft,
  ⭐Light, ⭐Neon, ⭐Retro, ⭐Minimalist, ⭐TimeShow(Beta), ⭐Emberrail, ⭐Marquee,
  ⭐Spectrum, ⭐Synthwave
- Not: SongRequest'in tarayıcıda açık olması gerekiyor

### Emoji Kombosu (`/emotecombo`)
- PLATFORMLAR
- BetterTTV / 7TV emojileri
- Maksimum eşzamanlı emoji
- Kombonun minimum sayısı
- Emoji zaman aşımı (saniye)

### Anketler (`/polls`)
- PLATFORMLAR
- Tema (13, 6'sı premium): Default, Compact Battle, Platform Brand, Broadcast,
  Bubbles, White, Cake, ⭐Hacker, ⭐Neon, ⭐Rounded, ⭐Lightsaber, ⭐Battle, ⭐Minimal
- Maks. anket
- Önizleme anketleri
- Bitiş sonrası görünürlük: 30/60/90/120/180/300 sn
- Benzer anketleri birleştir
- Oy sayısını göster
- Kullanım: sohbete `/poll`

### Kupa (`/cup`)
- TASARIM
- KICKs minimum
- Eylem: **Kupayı boşalt**

### TTS (`/tts`)
- Dil/ses listesi (Google bulut sesleri, 19+ dil)
- Komut
- Minimum rol (Kick): Herkes / Abone / …
- Yerel ses uyarısı: yerel ses yoksa OBS widget'ı olarak çalışmayabilir

---

## 4. Bizdeki durum — 2026-09-21 sonu

**Galerideki 29 widget'ın tamamı ayar sistemine bağlı.** Her kart tıklanınca
Türkçe etiketli, bölümlere ayrılmış bir ayar penceresi açılıyor; değişiklik
500 ms sonra otomatik kaydediliyor ve `widget_settings` yayınıyla OBS'teki
katmana **sayfa yenilemeden** uygulanıyor.

Ayar sayıları (panelden ölçüldü):

| Widget | Ayar | Bölümler |
|---|---|---|
| Aktivite Akışı | 49 | Olaylar / Şablon / Tipografi / … |
| Sohbet Katmanı | 36 | Düzen / Tipografi / Görünüm / Animasyon / Kontur |
| Hype Treni | 30 | Genel / Tema / Tipografi / Görünüm / Düzen / Tren / Puanlar |
| Hedefler (4 adet) | 31 | Hedef / Görünüm / Düzen / … |
| Bağış Kupası | 27 | Genel / Tema / Kupa / Emojiler / Düzen / … |
| Jenerik (Kapanış) | 27 | Genel / Tipografi / Görünüm / Animasyon / Bölümler |
| Çekilişler | 27 | Çekiliş / Görünüm / Düzen |
| Sıralama (Rankings) | 26 | Genel / Sıralama / Tema / Tipografi / Görünüm / Düzen |
| Shoutout | 24 | Genel / Tema / Düzen / Tipografi / Görünüm / Gelişmiş |
| İzleyici Sayacı | 24 | Genel / Tema / Düzen / Tipografi / Görünüm / Platformlar |
| Sadakat Ödülleri | 24 | Genel / Tema / Düzen / … / Ses |
| Emoji Kombosu · Ekranda Emojiler | 24 | Combo / Görünüm |
| Olay Etiketleri | 24 | Düzen / Şablon / Tipografi |
| Şarkı Sözleri | 23 | Tema / Tipografi / Görünüm / Düzen / Animasyon |
| Sabitlenmiş Mesajlar | 22 | Genel / Tema / Düzen / Tipografi / Görünüm |
| Şu An Çalan | 22 | Tema / Genel / Düzen / Tipografi / Görünüm / Animasyon |
| Yayın Kralı | 21 | Genel / Tema / Tipografi / Görünüm / Düzen |
| Anketler | 19 | Düzen / Görünüm |
| Çarkıfelek | 17 | Görünüm / Animasyon / Kontur / Komut |
| TTS · Bulut TTS | 16 | Ses / Düzen |
| JumpScare | 15 | Medya / Görünüm / Ses / Düzen / Animasyon |
| Uyarı Kutusu | 14 | Gelişmiş / Ses / Düzen |
| Subathon | 14 | Genel / Süre / Görünüm |
| Bil Bakalım | 10 | Genel / Görünüm |

### Bu turda kapatılan işlev boşlukları

- **Bağış Kupası**: takip/raid de kupaya düşüyordu (her uyarı sayılıyordu) ve
  sunucu hem `alert` hem `cup_drop` yayınladığı için **her bağış iki jeton**
  ekliyordu. Artık yalnız `cup_drop` dinleniyor, eşikler (min. bağış / min.
  KICKs) uygulanıyor, `cup_clear` kupayı boşaltıyor.
- **Hype Treni**: tamamen sahteydi — seviye ve yüzde sabitti, sayaç sıfıra
  inince 300'e dönüyordu, hiçbir olay treni ilerletmiyordu. Artık abone /
  hediye abone / bağış / KICKs / takip puan ekliyor, seviye hedefi
  `taban × büyüme^(seviye-1)` ile büyüyor, süre dolunca tren duruyor.
- **Sabitlenmiş Mesaj**: örnek çekiliş duyurusu gerçek yayında da görünüyordu.
  Artık yalnız `?preview=1` kipinde.
- **Jenerik**: her bölümün altında sabit sahte isimler (StreamQueen, ProGamer34…)
  yayında görünüyordu. Artık yalnız önizlemede; boş bölüm gizleniyor.
- **Sıralama**: `u[sort] ?? u.points` izleme süresi ve mesaj alanlarını
  ıskalayıp puanı gösteriyordu. Alan eşlemesi açık yazıldı, izleme süresi
  `3sa 21dk` biçiminde.
- **Yayın Kralı**: WebSocket adresi 3001'e sabitti (portu değişen kurulumda hiç
  bağlanmıyordu) ve yeniden bağlanma zamanlayıcısı temizlenmiyordu.
- **Şarkı Sözleri**: boş listede `% 0` modulo NaN indeks üretiyordu; parça
  değişince satır sayacı sıfırlanmıyordu.
- **Shoutout / Sadakat / JumpScare**: zaman aşımları temizlenmediği için arka
  arkaya gelen iki olay birbirinin kartını erken kapatıyordu.
- **TTS oynatıcı**: kuyruk sınırsızdı; uzun molada biriken onlarca istek arka
  arkaya okunuyordu. `maxQueue` ile en yeni N istek tutuluyor.
- **Ayar penceresi**: `theme` ve `layout` gibi alanlar her widget'ta farklı
  anlama geldiği hâlde tek küresel liste vardı (sayaçta "satır/sütun", hedefte
  "yazı üstte/altta"). Widget'a özel seçenek ve bölüm haritaları eklendi.
- **CloudTTS / Ekranda Emojiler / Trivia Quiz** kartları boş açılıyordu: galeri
  kimliğiyle ayar kimliği farklıydı, takma ad haritasıyla eşlendi.
- Galeri Türkçeleştirildi; **"Wheel Of Fortune" → "Çarkıfelek"**.

### Hâlâ BotRix'te olup bizde olmayan

- Tema sayısı: BotRix widget başına 13–28 tema sunuyor (yarısı premium), bizde
  her widget'ta 4–5 tema var.
- Platform filtresi (Twitch/YouTube/Kick onay kutuları) yalnız İzleyici
  Sayacı'nda var; sohbet ve uyarılarda yok.
- Ayar penceresinde canlı önizleme paneli yok (OBS Stüdyo tuvalinde var).
- BetterTTV / 7TV emoji desteği.

### Bizde olup BotRix'te olmayan

Bil Bakalım (trivia), Şarkı Sözleri, Yayın Kralı, JumpScare, Sıralama,
Jenerik, tek URL'lik "OBS Stüdyo" tuvali.
