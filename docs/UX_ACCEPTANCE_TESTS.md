# Kabul sınamaları (§73–78) — sentetik karşılıkları ve sonuçlar (2026-09-28)

Kurallar: yayın yalnız 127.0.0.1'deki FFmpeg alıcılarına; yakalama yok (UNVERIFIED); izleme yalnız "kapalı";
masaüstü girdi otomasyonu yok (arayüz tarayıcı bölmesinde başsız sunucuyla, JS olaylarıyla sınandı).

| § | Senaryo | Nasıl sınandı | Sonuç |
|---|---|---|---|
| 73 | Kısayollar: sahneye geç, Studio geçişi, sustur, bas-konuş/bas-sustur, medya, kayıt/tekrar | `motor_kisayol_eylemleri_bas_konus_ve_sahne` (eylem kayıt defteri = kısayol yolu), çakışma denetimi mevcut testleri | GEÇTİ (küresel tuş basışı UNVERIFIED) |
| 74 | Kaynaklar: renk, yazı, sesli medya, test eklenti kaynağı, tarayıcı; mikserde beklenen kanallar | `motor_v2_…`, motor `sinama` (tarayıcı: kare değişimi + WebAudio −26 dBFS), arayüz (renk/yazı/medya ekleme, gruplama, filtre) | GEÇTİ |
| 75 | Mikser: düzey, sustur, kompresör/kazanç, izler; "müzik VOD izine gitmesin" | kazanç −20 dB → ölçerde 20,0 dB; çok izli kayıtta iz 1 −91 dB / iz 2 −21 dB; hedef başına iz (hedef-a sessiz, hedef-e tonlu); arayüzde fader −30 dB, sustur, Gelişmiş Ses | GEÇTİ |
| 76 | Çoklu yayın: üç+ yerel alıcı, anahtar Kimlik Yöneticisinde, biri durur diğerleri sürer, yeniden bağlanma, kodlama paylaşımı | motor `sinama` (A/B/C/D/E), `motor_api_sentetik_kaynak_ve_hedef`, `motor_profil_kodlama_paylasimi_ve_kayit` (3 hedef, 2 kodlayıcı) | GEÇTİ (gerçek platform UNVERIFIED) |
| 77 | Güvenlik: test anahtarı veri klasöründe, destek paketinde, profil/koleksiyon dışa aktarımında 0 kez | `multistream_api_keys_never_leak_…`, `multistream_anahtar_goster_sil_…`, `eylem_eklemeleri_ve_destek_paketi_sir_sizdirmaz`, profil testi; arayüzde tarayıcı depolaması denetimi | GEÇTİ |
| 78 | Arayüz: OBS kullanıcısı gözüyle kontrol listesi | Aşağıdaki liste; tarayıcı bölmesi (başsız sunucu) | GEÇTİ (ekran görüntüsü emülasyonda küçük; düzen DOM ölçümüyle) |

## §78 kontrol listesi

- [x] Menü çubuğu OBS menüleri + bizim menülerimiz; Docklar menüsünde göster/gizle, kilit, sıfırla, ayrı pencere
- [x] Önizleme üstte; alt dock sırası Sahneler | Kaynaklar | Ses Mikseri | Sahne Geçişleri | Denetimler; durum çubuğu
- [x] Sahne ekle → tıkla programa geçer; Studio Mode'da önizlemeye; Slide geçişiyle programa
- [x] Kaynak ekle (renk, yazı, medya); üstte en son eklenen; sürükle (400,200 px taşındı), köşeden 2× boyutlandır, "Tuvale sığdır"
- [x] Shift+→ 10 px itme; Ctrl+Z iki kez başa döner; Ctrl+Y yineler
- [x] Ctrl ile çoklu seçim → "2 öğeyi grupla" → ağaçta açılır grup
- [x] Filtreler: renk kaynağında yalnız efekt filtreleri; Renk Düzeltme özellik formu
- [x] Mikser: canlı ölçer, fader, sustur, Gelişmiş Ses Özellikleri (6 adlandırılmış iz)
- [x] Koleksiyon: yeni → geç (motor çalışırken) → geri dön (sahneler, filtreler, ses ayarları geri kuruldu)
- [x] Yayın ayarları: arama, Gelişmiş kip anahtar kare alanı, bit hızı profile yazıldı; çoklu yayın kartı (maskeli anahtar, 20 sn göster, TCP sına, karışım ataması)
- [x] Projektör ve ayrı pencere dock'ları (mikser ölçerli, sahneler)
- [x] Ctrl+K komut paleti; otomatik yapılandırma sihirbazı (NVENC, %0 atlanan kare)
