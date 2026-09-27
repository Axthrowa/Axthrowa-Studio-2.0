# Arayüz Tasarım Sistemi — profesyonel masaüstü yayın uygulaması

Amaç: 8 saat açık kalan, yoğun ama düzenli bir araç. Referans ergonomi: OBS Studio, NLE'ler (Premiere, Resolve),
IDE'ler (VS Code, JetBrains) — **etkileşim kalıpları** (yuvalı paneller, özellik denetçisi, bağlam menüsü, klavye akışı),
marka ya da görünüm değil. "Yapay zekâ ile üretilmiş pano" görünümü bir hata sayılır (bkz. §7).

Uygulama: `src/styles/desktop.css` (`dt-*` bileşen sınıfları), Tailwind token'ları (`tailwind.config.js`, `--panel-*`).
Yeni ekranlar (Yayın çalışma alanı, Eklenti yöneticisi, komut paleti) yalnız bu sistemi kullanır; eski ekranlar kademeli
taşınır (bkz. §8).

## 1. Yüzeyler ve renk

| Token | Kullanım |
|---|---|
| `--panel-bg` | uygulama zemini (saf siyah değil: #0c0d10) |
| `--dt-surface-1` | yuvalı panel gövdesi |
| `--dt-surface-2` | panel başlığı, araç çubuğu, tablo başlığı |
| `--dt-surface-3` | seçili satır, basılı araç düğmesi |
| `--panel-border` | panel ayırıcıları (gölge yerine) |
| `--panel-accent` | seçim, odak halkası, birincil eylem — **süs için kullanılmaz** |

Anlamsal durum renkleri (yalnız durum bildirir; her durum ayrıca metin/simge taşır — renk körlüğü):

| Durum | Renk | Biçim |
|---|---|---|
| Canlı (LIVE) | `--dt-live` #e5484d | kırmızı nokta + "CANLI" + süre; uygulamanın geri kalanı kırmızı olmaz |
| Kayıt | `--dt-rec` #ff6b57 | ayrı "KAYIT" göstergesi |
| Uyarı | `--dt-warn` #f5a524 | ⚠ simge + metin |
| Hata | `--dt-error` #e5484d | simge + açıklayıcı metin |
| Başarılı / hazır | `--dt-ok` #3dd68c | yalnız gerekli yerde |
| Sessiz / devre dışı | `--panel-muted` | düşük kontrast metin |

Açık tema isteğe bağlı; koyu tema birincil. Gradyan, neon, parlama (glow), cam efekti (glassmorphism) **yok**.

## 2. Tipografi

| Rol | Boyut | Not |
|---|---|---|
| Gövde | 13 px | tablolar, listeler |
| Etiket / yardımcı | 12 px | ayar etiketleri, sütun başlıkları |
| Küçük | 11 px | birim, durum metni |
| Panel başlığı | 12 px, yarı kalın | büyük harf yok; her panelde 24 px başlık **yok** |
| Sayı | `tabular-nums` | bit hızı, süre, kare |

Birimler her zaman yazılır: kbps, ms, FPS, Hz, dB, MB, GB, sn.

## 3. Boşluk ve ölçü

Ölçek: **4 · 8 · 12 · 16 · 24 · 32 px**. Rastgele kenar boşluğu yok.
Satır yüksekliği: liste 28 px, tablo 30 px, araç çubuğu 32 px. En küçük pencere: 1280×720.

## 4. Köşe ve gölge

| Öğe | Yarıçap |
|---|---|
| Düğme, giriş, seçim kutusu | 4 px |
| Yuvalı panel | 2 px (ya da 0) |
| İletişim kutusu, açılır pencere | 6 px |

Gölge **yalnız katmanlı** öğede: bağlam menüsü, açılır pencere, modal. Yuvalı paneller kenarlık ve yüzey
seviyesiyle ayrılır.

## 5. Düğme hiyerarşisi

| Tür | Sınıf | Ne zaman |
|---|---|---|
| Birincil | `dt-btn-primary` | ekranda en fazla bir tane (GO LIVE, Kur) |
| İkincil | `dt-btn` | olağan eylemler |
| Araç | `dt-tool` | panel araç çubuğu; simge + ipucu, anlamı belirsizse metin |
| Tehlikeli | `dt-btn-danger` | yayını bitirme, kaldırma; onay ister |
| Aç/kapa | `dt-toggle` + `aria-pressed` | izler, görünürlük |

Tek simge ailesi: **lucide**. Emoji ve Unicode simge yok.

## 6. Etkileşim

Bkz. `DESKTOP_INTERACTION_GUIDELINES.md`: bağlam menüleri, çift tıklama, klavye, onaylar, bildirimler, boş durumlar,
hata iletileri, ilerlemeli açıklama.

## 7. Yasaklar (her ekranda denetlenir)

- Dev yuvarlak kartlar, 24–32 px yarıçap, her paneli yüzen kart yapmak
- Anlamsız gradyan, neon mor/mavi, parlama, cam efekti, aşırı saydam panel
- Rastgele renkli durum hapları, başlık yanında emoji, pazarlama başlıkları, dev boşluklar
- Pano içinde pano, iş yapmayan KPI kartı, gereksiz mini grafik
- Her şeyi yalnız simgeyle anlatmak; mobil web düzenini masaüstüne büyütmek
- Açılışta kartların sırayla uçması; her kartta giriş animasyonu

Son soru: **"Bu, 8 saat kullanılacak profesyonel bir araç mı, yoksa sıradan bir SaaS panosu mu?"** İkincisiyse yeniden
tasarlanır.

## 8. Geçiş durumu (2026-09-26)

| Alan | Durum |
|---|---|
| `dt-*` bileşenleri | yeni |
| Yayın çalışma alanı, Eklenti yöneticisi, komut paleti | yalnız `dt-*` |
| Genel `yya-btn-primary` (gradyan + parlama) | düz vurgu rengine çevrildi |
| `yya-input` (`rounded-xl`) | 4 px'e indirildi |
| Sol menü etkin öğe parlaması | kaldırıldı |
| Eski ekranlar (Giriş/Çıkış/Mola düzenleyicileri, Bot) | kart ağırlıklı; kademeli taşınacak (`WORKSPACE_LAYOUT_ARCHITECTURE.md`) |
