# Geri Dönüş (Rollback) — Streaming OS turu

Her şey geri alınabilir: kod iki depoda etiketli, veri değişiklikleri yalnız ekleme niteliğinde, tam yedek doğrulanmış
(`BACKUP_MANIFEST.md`). Hiçbir commit uzak depoya gönderilmedi.

## 0. Önce: OBS yönlendirmesini geri al (varsa)

Kontrol Merkezi'nde **"OBS'i yönlendiriciye bağla"** kullanıldıysa OBS'in yayın hedefi yerel alıcıya
(`rtmp://127.0.0.1:<rastgele>/live`) çevrilmiştir; eski sürüm bu alıcıyı açmaz ve OBS yayın başlatamaz.

1. Kontrol Merkezi → Yayın oturumu → **"OBS ayarını geri yükle"**. Önceki servis ayarı Windows Kimlik Yöneticisi'nde
   (`multistream.obs_service_backup`) saklanır ve geri yazılır; eylem denetim günlüğüne düşer.
2. Uygulama artık yoksa: OBS → Ayarlar → Yayın → servisi ve anahtarı elle yeniden girin.

## 1. Kod

| Depo | Güvenlik etiketi | Önceki dal | Bu turun dalı |
|---|---|---|---|
| Panel | `pre-streaming-os-20260925-175532` | `streamaxt-bot` | `revamp/streaming-os-20260925` |
| StreamAxT | `pre-streaming-os-20260925-175532` | `revamp/botrix-parity-20260921` | `revamp/streaming-os-20260925` |
| Panel (2. tur) | `pre-streaming-os-revision-20260926-010500` | `revamp/streaming-os-20260925` | `revamp/streaming-os-20260926` |
| StreamAxT (2. tur) | `pre-streaming-os-revision-20260926-010500` | `revamp/streaming-os-20260925` | `revamp/streaming-os-20260926` |

Yalnız ikinci turu geri almak için iki depoda `revamp/streaming-os-20260925` dalına dönmek yeterli (ikinci turda
veritabanı şeması değişmedi; eklenen tek kalıcı ayar `settings-panel.json` → `controlDeck`, eski sürüm yok sayar).
Git paketleri: `Desktop\yayin-yonetim-yedekler\git-20260926-tur2\` (`git bundle verify` → okay).

```bash
git -C "C:/Users/Axthrowa/Desktop/yayin-yonetim-araci - Kopya (2)" switch streamaxt-bot
```

```bash
git -C "C:/Users/Axthrowa/Desktop/Projeler" switch revamp/botrix-parity-20260921
```

Tek bir değişikliği geri almak için ilgili commit'i `git revert <commit>` ile geri alın (commit listesi
`IMPLEMENTATION_REPORT.md`'de). Dal silinmez; yeni işler dalda kalır.

**Uyarı — a76f2b5'i (keyring düzeltmesi) geri almayın.** Eski kod sırları sahte (mock) depoya yazıyor, OBS şifresi ve
Kick oturumu her açılışta kayboluyordu.

## 2. Veri — bu turun eklediği her şey ve eski sürümün tepkisi

| Veri | Yer | Eski sürüm ne yapar |
|---|---|---|
| Çoklu yayın hedefleri | panel ayarları `panel.multistream` (`version: 1`) | alanı tanımaz, yok sayar |
| Hedef yayın anahtarları | Kimlik Yöneticisi `multistream.key.<id>` | okumaz; istenirse Kimlik Yöneticisi'nden silinebilir |
| OBS servis yedeği | Kimlik Yöneticisi `multistream.obs_service_backup` | okumaz |
| Denetim günlüğü kayıtları | `botaxt.db` → `audit_log` (tablo 001 göçünden beri var; bu tur yalnız satır ekler, şema değişmedi) | kayıtları okumaz; silmek gerekmez |
| Kontrol Merkezi düzeni / notlar | WebView `localStorage` (`yya.controlCenter.*`) | kullanmaz |
| Kalkan `platformdaSil` | StreamAxT `bot_settings.shield_mode_settings` JSON'u | bilinmeyen alanı yok sayar |
| Uyarı kuyruğu denetim durumu | StreamAxT belleği (kalıcı değil) | — |

Bu turda şema göçü yok; hiçbir değişiklik veri silmez ya da mevcut alanı değiştirmez; eski sürüme dönmek için veri geri yüklemek **gerekmez**.

## 3. Tam geri yükleme (yalnız gerekirse)

Yedek: `C:\Users\Axthrowa\Yedekler\backup-pre-streaming-os-20260925-175532` (3644 dosya, SHA-256 doğrulamalı).

1. Paneli ve StreamAxT'i kapatın (tepsi simgesinden çıkış).
2. Depo: `git/panel.bundle` ve `git/streamaxt.bundle` → `git clone <bundle> <hedef>` ya da mevcut depoda
   `git fetch <bundle> 'refs/*:refs/*'`.
3. Veritabanları: `db-snapshots/` altındaki tutarlı kopyaları özgün yollarına kopyalayın (yollar `manifest.json`'da).
   Canlı `.db` üzerine yazmadan önce mevcut dosyayı yeniden adlandırın.
4. Ayarlar: `appdata-roaming/…` ve `appdata-local/…/EBWebView` klasörlerini `%APPDATA%` / `%LOCALAPPDATA%` altındaki
   karşılıklarına kopyalayın.
5. Doğrulama: `manifest.json`'daki sha256 değerleriyle karşılaştırın.

## 4. Dağıtım

`scripts\yedek-al.ps1` zip yedekleri yalnız kaynak kodu ve ayar/veritabanı dosyalarını içerir, derlenmiş exe'yi
**içermez**. Bu yüzden yeni paket kurulmadan önce çalışan paket ayrıca kopyalanır (yol aşağıda, dağıtım adımında
doldurulur). Kullanıcı verisi (`data`, `app-data`, `media`) paketin dışında tutulur ve dağıtımda değişmez.

- Önceki paket kopyası: `C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\dagitim-oncesi-20260926-003528\`
  (413 dosya, 31 MB, `manifest.json`'da sha256):
  - `panel-portable\` → `YayinYonetimAraci.exe`, `dist`, `resonance`, `streamaxt\{dist,public,package.json}`;
    geri dönmek için bunları `cikti\portable\` altındaki karşılıklarının üzerine kopyalayın (panel kapalıyken).
  - `streamaxt-release\` → `Projeler\release\app\{dist,public}` ve `…\StreamAxT-v1.0.0-Portable\app\{dist,public}`.
  - `db\` → dağıtım anındaki üç gerçek StreamAxT veritabanının SQLite backup API kopyası (`integrity_check = ok`).
    Bu turda şema değişmediği için normalde gerekmez.

### Dağıtım — ikinci tur (2026-09-26)

- Dağıtım öncesi kopya: `C:\Users\Axthrowa\Desktop\yayin-yonetim-yedekler\dagitim-oncesi-20260926-060316\` (535 dosya,
  43,6 MB, `manifest.json` SHA-256; dağıtım öncesi doğrulandı: 0 uyuşmazlık). İçerik ilk turdakiyle aynı düzende;
  ek olarak `db\` altında WAL/SHM dosyaları ve kurulu mod veritabanı (`kurulu-appdata-botaxt.db`), ve
  `streamaxt-release\…\node_modules\tiktok-live-*` (dağıtımda 2.5.0 → 2.4.0 değişen paketlerin eski hâli).
- Uygulamalar kapalıyken kopyalandı (WAL dosyaları tutarlı). Veritabanları dağıtımda değiştirilmedi
  (`panel-streamaxt.sqlite` karması dağıtımdan sonra aynı).
- Zip: `yedek-20260926-061213-streaming-os-tur2-deste-olcer-lisans-dagitim.zip`.
