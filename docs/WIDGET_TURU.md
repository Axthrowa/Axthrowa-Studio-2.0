# Widget iyileştirme turu (WID-8)

Son doğrulama: 2026-11-18 · Plan 3, WID-8 · `node scripts/widget-duman.mjs --tur` ile üretilir (elle düzenlemeyin)

Her widget sayfası canlı kipte (önizleme verisi olmadan) başsız Chrome'da açılır, geçici veri klasöründe çalışan kendi botuna bağlanır:

- **Boş durum:** veri yokken yakalanmamış istisna ya da ekranda `undefined`, `NaN`, `null`, `[object Object]` yok.
- **Uzun metin:** 25 karakterlik ad (Kick/Twitch sınırı) ve uzun mesajla test olayı; ardından ekrandaki her metin uzatılır. Metin "…" olmadan kesilmemeli, kaynağın kenarından çıkmamalı.
- **Dar alan:** aynı olay 480×360 kaynakta.
- **Platform:** platform bilgisi taşıyan olaylarda Kick, Twitch, YouTube ve TikTok'tan birer olay (`—`: widget platforma bağlı olay göstermiyor).
- **Test düğmesi / ipucu:** galeri kartında Test düğmesi (olay testi ya da Tek URL katman örneği) ve "Nasıl çalışır?" ipucu. `—`: sayfa galeride ayrı kart değil.

Ekran görüntüleri ve ham sonuç: `test-results/widget/tur/`, `test-results/widget/tur.json`. Test düğmesi ve ipucu kapsamı ayrıca `axbot/client/src/pages/galeriKapsami.test.ts` ile CI'da korunur.

| Sayfa | Galeri | Boş durum | Uzun metin | Dar alan | Platform | Test düğmesi | İpucu |
| --- | --- | --- | --- | --- | --- | --- | --- |
| alertbox | alert-box | geçti | geçti | geçti | geçti | geçti | geçti |
| chatbox | chat-overlay | geçti | geçti | geçti | geçti | geçti | geçti |
| donation-goal | donation-goal | geçti | geçti | geçti | — | geçti | geçti |
| follower-goal | follower-goal | geçti | geçti | geçti | — | geçti | geçti |
| subscriber-goal | subscriber-goal | geçti | geçti | geçti | — | geçti | geçti |
| kicks-goal | kicks-goal | geçti | geçti | geçti | — | geçti | geçti |
| giveaways | giveaways | geçti | geçti (bilerek: çekiliş makarası kenarda soluklaşarak bilerek kesilir; bulgu: uzun adla kesiliyor: "Arda") | geçti (bilerek: çekiliş makarası kenarda soluklaşarak bilerek kesilir; bulgu: kesiliyor: "Mira") | — | geçti | geçti |
| rankings | rankings | geçti | geçti | geçti | — | geçti (katman örneği) | geçti |
| wheel | wheel-of-fortune | geçti | geçti (bilerek: çark dilim adını en çok 14 karakterle (maxLabel) kısaltır; uzatma bunu atlıyor; bulgu: uzatılmış metin kesiliyor: "Ahmet_34 uzatılmış denem") | geçti | — | geçti | geçti |
| audio-player | cloud-tts | geçti | geçti | geçti | — | geçti | geçti |
| emote-combo | emote-combo | geçti | geçti | geçti | — | geçti | geçti |
| subathon | subathon | geçti | geçti | geçti | — | geçti | geçti |
| hype-train | hype-train | geçti | geçti | geçti | — | geçti | geçti |
| event-labels | event-labels | geçti | geçti | geçti | geçti | geçti | geçti |
| resonance | — | geçti | geçti | geçti | — | — | — |
| polls | polls | geçti | geçti | geçti | — | geçti | geçti |
| shoutout | shoutout | geçti | geçti | geçti | — | geçti | geçti |
| atla | atla | geçti | geçti | geçti | — | geçti | geçti |
| atla-oyunu | atla-oyunu | geçti | geçti | geçti | — | geçti | geçti |
| the-cup | the-cup | geçti | geçti | geçti | — | geçti | geçti |
| word-cloud | word-cloud | geçti | geçti (bilerek: yerleşim gerçek sözcükten hesaplanır, sığmayan sözcük bulutuna girmez; uzatma bunu atlıyor; bulgu: uzatılmış metin kesiliyor: "KEKW uzatılmış deneme me") | geçti | — | geçti (katman örneği) | geçti |
| scoreboard | scoreboard | geçti | geçti | geçti | — | geçti | geçti |
| credits | end-credits | geçti | geçti | geçti | — | geçti | geçti |
| pinned | pinned-messages | geçti | geçti | geçti | — | geçti | geçti |
| socials | social-rotator | geçti | geçti | geçti | — | geçti (katman örneği) | geçti |
| sponsor | sponsor-banner | geçti | geçti | geçti | — | geçti (katman örneği) | geçti |
| loyalty-redeem | loyalty-redemptions | geçti | geçti | geçti | — | geçti | geçti |
| lyrics | lyrics | geçti | geçti | geçti | — | geçti (katman örneği) | geçti |
| muzik-video | muzik-video | geçti | geçti | geçti | — | geçti | geçti |
| jumpscare | jumpscare | geçti | geçti | geçti | — | geçti | geçti |
| king | king | geçti | geçti | geçti | — | geçti | geçti |
| pano | — | geçti | geçti | geçti | — | — | — |
| viewer-counter | viewer-counter | geçti | geçti | geçti | — | geçti | geçti |
| activity-feed | activity-feed | geçti | geçti | geçti | geçti | geçti | geçti |
| kappagen | — | geçti | geçti | geçti | — | — | — |
| trivia | trivia-quiz | geçti | geçti | geçti | — | geçti (katman örneği) | geçti |
| overlay | — | geçti | geçti | geçti | — | — | — |
| sayac | sayac | geçti | geçti | geçti | — | geçti | geçti |
| izleyici-sirasi | izleyici-sirasi | geçti | geçti | geçti | — | geçti | geçti |
| geri-sayim | geri-sayim | geçti | geçti | geçti | — | geçti | geçti |
