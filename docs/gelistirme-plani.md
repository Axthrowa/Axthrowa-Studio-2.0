# Geliştirme planı — AxthrowA Studio + AxBoT

Tarih: 11 Kasım 2026. Kaynaklar: Kick geliştirici belgeleri, Streamer.bot sohbet dock’u, StreamWizard emote duvarı, Enhanced IRL overlay maliyeti. Yeni özellik kodu bu belgede yok; sıra ve neden var.

## Şimdi düzelenler

- Botun kendi emote’u (bot hesabı ya da yayıncı hesabından giden yankı) emote duvarına ve emote kombosuna sayılmıyor.
- `!clip`: Twitch’te Helix klip (`clips:edit`). Kick’te resmi klip ucu hâlâ yok ([KickDevDocs #71](https://github.com/KickEngineering/KickDevDocs/issues/71), Eylül 2026’da yol haritasında). Kick klibi yayının HLS adresinden yerel ffmpeg ile kesiliyor; adres `playback_url` hem kökte hem `livestream` içinde aranıyor. Başarısız olursa sohbet “klip alındı” demiyor, nedeni yazıyor.
- OBS “Studio · Çoklu Sohbet” dock’u paneldeki canlı çoklu sohbeti (AxBoT Multi-Chat) açıyor. Dock’u OBS’te bir kez yenilemek gerekir.

## Sıradaki iş (yayını bozmadan)

1. **Klip güvenilirliği.** Kick HLS adresi gelmezse sohbete kısa neden yazmak yetmez: panelde son hata ve `data/klipler` listesi görünsün. ffmpeg yoksa kurulum yolu tek cümle olsun. Twitch jetonunda `clips:edit` yoksa Bağlantılar’da “yeniden bağla” görünsün.
2. **Emote duvarı ayarı.** StreamWizard’daki üç kapı: `!` ile başlayan mesajlar uçmasın (komboda var, duvarda da olsun), izleyici başına bekleme, gizlenen hesap listesi (Nightbot, StreamElements, Streamlabs). Aynı anda en çok N emote; OBS kasmasın diye varsayılanı düşük tut ([overlay maliyeti](https://docs.enhancedirl.com/en/cloud-obs/overlay-performance/)).
3. **Dock’lar.** Sohbet dock’unda gönderme ve hızlı moderasyon (sil / timeout) çalışsın; olay dock’u ayrı kalsın. Streamer.bot da sohbet ve olay akışını ayrı dock yapıyor ([dock sohbet](https://docs.streamer.bot/faq/dock-internal-chat)).
4. **Botta sessiz kalan komutlar.** Kapalı modül, yetki veya bekleme `!clip` gibi komutta sohbete hiçbir şey yazmadan `null` dönüyor. İzleyici “çalışmıyor” sanıyor. En azından “bu komut kapalı” ya da “bekle” yazılsın.

## Sonra eklenebilir

- **Klip uyarısı.** Kick `clip.created` olayı gelene kadar kendi kestiğimiz klip panelde ve isteğe bağlı overlay’de “X klip aldı” diye görünsün. Paylaşım linki Kick API’si açılınca eklenir.
- **7TV / BTTV / FFZ.** Sohbet, duvar ve kombo aynı sözlüğü kullansın. Streamer.bot 2026’da 7TV overlay emote’unu ayrıca açtı; animasyonlu emote’u kapatma anahtarı OBS’i rahatlatır.
- **Olay patlaması.** Takip, abone, bağış ve raid duvarda ayrı bir patlama yapsın; bağışta adet karekök ile artsın, tavan olsun (StreamWizard modeli).
- **Paylaşılan sohbet.** Twitch Shared Chat (2026) açıksa mesajın hangi kanaldan geldiği rozetle görünsün.
- **Tek yayın sağlığı.** Dropped frame, ses kırpması ve botun Kick/Twitch kopması tek satırda. Kopunca sohbet dock’u “bağlı değil” desin, boş liste gibi durmasın.

## Yapılmayacak

- Kick’in olmadığı klip API’sini varmış gibi sohbete link basmak.
- Emote duvarını tam ekran sürekli parçacık animasyonuna çevirmek.
- Yeni mini oyun (bahis, kuyruk, puan yağmuru) bu turda. Tabloları var, sohbet komutları yok; ayrı bir tur.

## 11 Kasım 2026 — dock adları

OBS’e yazılan sekiz dock başlığı `Studio · …` yerine `AX Studio · …`. Panel listesi öneki yine gizler; OBS menüsünde tam ad görünür. Eski başlık OBS ayarında durur. OBS kapalıyken Studio’dan dock’ları yeniden yazmak gerekir.

## Uygulama planı

Kaynaklar herkese açık 2026 karşılaştırmaları: [KickBot / Botrix](https://kickbot.com/guides/compare/kickbot-vs-botrix), [Kick botları](https://kickbot.com/guides/compare/best-kick-bots), [Blerp Twitch botları](https://blerp.com/best-twitch-chat-bots), [Gyre 2026](https://gyre.pro/blog/best-chatbot-to-use-for-streaming). Firecrawl veya Exa bu oturumda yoktu; arama bu sayfalarla sınırlı.

Sıra, yayını bozmadan:

1. **Dock’u yenile.** Yeni adlar ancak OBS kapalıyken “Seçilenleri OBS’e ekle” ile yazılır. Sohbet dock’u Multi-Chat olarak kalsın; olay dock’u ayrı kalsın. Bunu kod yazmaz; OBS kapalıyken panelden dock’lar yeniden eklenir.
2. **Yayın sağlığı tek satır.** Dashboard üst şeridi kare düşüşünü ve sesin kırpmaya yaklaşmasını yazar. Sohbet dock’u bota bağlı değilken boş liste yerine “Sohbet bağlı değil.” der.
3. **Overlay maliyeti.** Emote duvarı sağ alt 640×480 kutuda uçar. Aynı anda en çok 12 emote.
4. **Olay patlaması.** Takip, abone, bağış ve raid duvarda ayrı, en çok 12’lik patlama. Bağışta adet karekök ile artar.

Ödeme, bahşiş sayfası ve ses klonlama bu planda yok.

## Bot planı

Yerel paket olarak yalnız BotRix Chrome eklentisi 12.6 incelendi (`C:\Users\Axthrowa\AppData\Local\Temp\botrix-rea\unpacked`). JavaScript çalıştırılmadı. Kapsam kısmi: `manifest.json` ve `service_worker.js` kaydı `ev_0bda9b3160cfa2e060dd99d496a93d067152609f24bf27663f2001edaed99b34`; `kick-features.js` önceki kayıt `ev_237120f31ef4711f0d721c4944def60bf68f94f568aadce7b23ae97343f5b750`. Dokuz dosya seçilmedi. Nightbot, Fossabot ve Streamer.bot bu makinede paket olarak yok; onlar için aşağıdaki tablo site metnidir, REA kanıtı değildir.

Eklentide gözlenenler: izinler `tts` ve `alarms`. Betikler `botrix.live`, YouTube canlı sohbet, `kick.com` ve `dashboard.kick.com` üzerinde. Arka plan `https://botrix.live/api/bot/settingsTTS`, `https://botrix.live/api/user/profile`, puan düşürme, seviye ve okunan mesaj uçlarını çağırıyor. `kick-features.js` içinde `!clip` veya klip oluşturan bir istek yok. Klip simgesi `https://botrix.live/sync/kickalerts` sayfasına gidiyor.

| Eksik | Kimde var | Bizde | Sıra |
|---|---|---|---|
| Silinen mesaj günlüğü, tekrar / zalgo / regex filtresi | Fossabot, KickBot | Kısmi: büyük harf, link, emote, sembol, küfür | 1 |
| `!followers` | BotRix yerleşik listesi | Yok (`docs/botrix-parity.md`) | 2 |
| Şarkı duraklat, ses, sıradaki şarkı | BotRix `!sr` ailesi | `!sarki` vardı. `!songpause` `!songresume` `!songvol` eklendi (mod) | 3 |
| Puan yağmuru, tahmin, izleyici kuyruğu | BotRix | Sohbet komutları zaten vardı: `!pdrops` `!tahmin` `!joinq` | 4 |
| Kick’te tarayıcısız herkese açık klip sayfası | KickBot kendi sunucusunda | Yerel ffmpeg dosyası. Kick’in klip ucu yok | Yapma |
| Binlerce TTS sesi, ses klonlama | KickBot | Yerel TTS | Yapma |

1, 2 ve 3 sohbet komutu olarak bağlı. 4 zaten bağlıydı: `!pdrops start|stop`, `!tahmin`, `!joinq` ailesi.
