# OBS eklenti çökme kurtarma

> Kod: `src-tauri/src/eklenti/kayit.rs` (bekçi), `server/motor_api.rs` (`cokme_denetle`, başlatma kapısı),
> `motor_kopru.rs` (beklenmedik çıkış kodu), `motor/src/eklenti.rs` (işaret dosyası), arayüz `YayinCalismaAlani.tsx`.

## 1. İşaretler

| Dosya | Yazan | Silinen | Anlamı kalırsa |
|---|---|---|---|
| `motor/oturum.json` | Panel, motoru başlatırken (yüklenecek eklentiler listesiyle) | Düzgün durdurmada, uygulama kapanırken, başlatma hatası (çökmesiz) | Oturum temiz bitmedi |
| `motor/eklenti-yukleniyor.json` | Motor, her üçüncü taraf eklentiyi `obs_open_module` öncesi | `obs_init_module` döndükten sonra | Süreç o eklentinin yüklenmesinde düştü → **şüpheli adıyla bilinir** |

Panel ayrıca motorun kendi kendine kapandığını görürse çıkış kodunu saklar (`beklenmedik_cikis`; NTSTATUS, ör.
`0xC0000005` erişim ihlali). Uygulama kapanırken motor düzgün durdurulur (`RunEvent::Exit`), böylece bir sonraki
açılış bunu çökme sanmaz.

## 2. Karar tablosu

| Durum | Kayıt | Kullanıcıya sorulur mu |
|---|---|---|
| İşaret var (yükleme sırasında düştü) | Şüpheli eklentinin `cokmeler`ine "yukleme" + kod; **2. yükleme çökmesinde otomatik karantina** | Evet |
| İşaret yok, panel açıkken motor beklenmedik kapandı, üçüncü taraf eklenti yüklüydü | Yüklü eklentilerin geçmişine "calisma" | Evet |
| İşaret yok, panel de kapalıyken olmuş (gözlenmedi) | Bilgi olarak kaydedilir | Hayır (panelin kendisi kapanmış olabilir) |
| Üçüncü taraf eklenti yoktu | Bilgi | Hayır (eklenti sorunu değil) |

Karar verilmeden motor başlatılmaz (`/api/motor/baslat` → 409). Seçenekler (OBS'in iki seçeneğinden fazlası):

- **Güvenli kipte başlat** — bu açılışta üçüncü taraf eklenti yüklenmez; eklentinin kaynakları yer tutucu olur.
- **"X" eklentisini devre dışı bırak ve başlat** — eklenti kapatılır ve karantinaya alınır, diğerleri yüklenir.
- **Normal başlat** — her şey yeniden denenir (eklenti yine çökerse ikinci çökmede kendiliğinden karantina).
- **Tanılama** — Eklenti Yöneticisi (Geliştirici sekmesi: yoklama ayrıntısı, çökme geçmişi, motor günlüğündeki satırlar)
  ve Ayarlar > Destek paketi.

Ayrıca her zaman "Güvenli kipte başlat" düğmesi vardır (istem üzerine, çökme olmadan da).

## 3. Sahne verisi

Güvenli kipte ya da eklenti kaldırıldığında sahne koleksiyonu **değiştirilmez**: eklenti kaynağı `eksik` işaretiyle ve
özgün ayarlarıyla korunur; arayüzde "Eklenti eksik" yer tutucusu, "Eklentiyi kur…" ve "Eklenti konumu ekle…" eylemleri,
gereken kaynak türü gösterilir. Eklenti geri gelince kaynak kendiliğinden kurulur.

## 4. Sınandı

- Motor açılışta `yym_test_cokme` ile düştü → 409 (şüpheli adıyla) → durum `cokme.supheli`, `cikisKodu 0xC0000005` →
  karar vermeden başlatma yine 409 → "devre dışı bırak" → motor diğer eklentiyle açıldı, şüpheli QUARANTINED
  (`server_api.rs::eklenti_yoneticisi_kurulum_sinama_cokme_ve_karantina`).
- Kayıt birim testleri: iki yükleme çökmesinde karantina, gözlenmeyen kapanışta soru yok, kararlar
  (`kayit.rs` testleri). Yoklama sürecinde çökme → BLOCKED (`yoklama.rs` gerçek süreç testi).
