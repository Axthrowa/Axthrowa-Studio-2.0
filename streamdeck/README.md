# AxthrowA Studio — Stream Deck eklentisi (U12)

Elgato Stream Deck 7.1+ (Windows) için. Yalnız bu bilgisayardaki Studio'ya (`http://127.0.0.1:8843`) bağlanır; yerel istek
olduğu için anahtar istemez, izin/onay/denetim kaydı Studio'da uygulanır.

| Eylem | Ne yapar |
| --- | --- |
| Deste düğmesi | Studio destesindeki (Kontrol Merkezi → Deste) bir düğmeyi tuşa atar; tuş adı düğmenin adıdır |
| Mikrofon | Seçilen OBS ses girişini susturur / açar; susturulunca tuş kırmızı |
| Yayın | OBS yayınını başlatır / durdurur; canlıyken tuş kırmızı |
| Kayıt | OBS kaydını başlatır / durdurur; kayıttayken tuş kırmızı |

Onay isteyen eylemlerde (yayını başlat/durdur, kaydı durdur) tuşta "Onay? Tekrar bas" yazar; 3 sn içinde ikinci basış onaylar.

```bash
npm install
npm run build      # src → com.axthrowa.studio.sdPlugin/bin/plugin.js
npm test
npm run validate
npm run pack       # dist/com.axthrowa.studio.streamDeckPlugin (çift tıkla kurulur)
```
