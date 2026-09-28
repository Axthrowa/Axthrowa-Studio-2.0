# Sır saklama mimarisi (SecretStore)

## İlke

Yayın anahtarları, kaynakların parola alanları, OBS WebSocket parolası ve platform oturum sırları **yalnız işletim
sisteminin kimlik deposunda** (Windows Kimlik Yöneticisi; `keyring` crate, `windows-native` özelliği) tutulur.
JSON, SQLite, YAML, `localStorage`, `.env`, uygulama durumu, günlükler, destek paketi, koleksiyon/profil dışa
aktarımı ve denetim kaydı sır **içermez**. Depoya yazılamazsa işlem hata verir; düz metne **sessizce düşülmez**.

## Arayüz

`multistream::KeyStore` (Rust):

| İşlem | Anlamı |
|---|---|
| `set(id, değer)` | yaz (store); başarısızsa `false` → çağıran hata döner |
| `get(id)` | oku (yalnız sunucu içinde; yanıtlara konmaz) |
| `replace(id, değer)` | yalnız var olanı değiştir |
| `delete(id)` | sil |
| `has(id)` | var mı (arayüz "anahtar kayıtlı" gösterir) |

Uygulamalar: `KeyringStore` (Kimlik Yöneticisi, servis `com.axthrowa.yayin-yonetim-araci`, ad
`multistream.key.<hedef>`) ve `MemoryStore` (birim testleri). Kaynak parolaları `motor.kaynak.<id>.<alan>`.

**Başvuru**: yapılandırmada ve durumda değer değil başvuru görünür: `secure://<platform>/<hedef>/stream-key`.

## Gösterme ve kopyalama

- **Göster**: `POST /api/multistream/destinations/reveal` — yalnız bu bilgisayardan (uzak istemciye 403), bilinçli
  düğme; yanıt `Cache-Control: no-store`; denetime yalnız "gösterildi" ve başvuru yazılır. Arayüz 20 sn sonra gizler,
  değeri hiçbir kalıcı duruma yazmaz (tarayıcı depolaması sınamada boş doğrulandı).
- **Kopyala**: aynı uçtan alınıp panoya yazılır; 30 sn sonra pano hâlâ aynı değeri taşıyorsa temizlenir.
- **Değiştir / sil**: parola alanından yeni değer (gösterilmez) ya da yalnız anahtarı silme (hedef kalır; yayındayken
  reddedilir).

## Yalıtım

- Eklentilere sır API'si açılmaz (listeleme/okuma yok). Not: süreç içi OBS eklentisi, motorun belleğindeki etkin
  çıktının anahtarına teorik olarak erişebilir — sanal alan iddia edilmez ([OBS_PLUGIN_SECURITY_MODEL](OBS_PLUGIN_SECURITY_MODEL.md)).
- Motor anahtarı yalnız stdin'den alır; günlükleri `obs::gizle` ile maskelenir (`rtmp://…/live/***`).
- Uzak panel (LAN) anahtar göremez ve WebSocket'te OBS parolası maskelenir.

## Doğrulama

`multistream_anahtar_goster_sil_ve_baglanti_sinamasi`, `multistream_api_keys_never_leak_and_actions_are_audited`,
`motor_profil_kodlama_paylasimi_ve_kayit` (profil dosyası ve dışa aktarımında anahtar yok),
`eylem_eklemeleri_ve_destek_paketi_sir_sizdirmaz`, `secret_store::yazilan_sir_ayri_okumada_kalici`.
