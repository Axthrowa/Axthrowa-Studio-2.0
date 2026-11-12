# Gömülü sayfa sözleşmesi

AxthrowA Studio, AxBoT'u ve Resonance'ı birer çerçeve (iframe) olarak gömer. Çerçeveler ile Studio
yalnız `postMessage` ile konuşur. Bu belge bütün iletileri tek yerde toplar. Yeni ileti eklerken
buraya bir satır ve bir test ekleyin.

## Güvenlik kuralları

- **Studio, çerçeveden gelen iletiyi iki koşulla kabul eder:** kaynak pencere bizim çerçevemiz olmalı
  (`ev.source`), köken de gömülen adresin kökeni olmalı (`ev.origin`). Bu denetim
  `src/lib/embedMessages.ts` içinde yapılır.
- **Çerçeve, yalnız `window.parent` kaynaklı iletiyi kabul eder.**
- Her alan biçimiyle süzülür:
  - Renkler yalnız `#hex` ya da `rgb()` olabilir.
  - Ölçüler yalnız `rem`/`px` olabilir (`.75rem` gibi kısa yazım da geçer).
  - Metinler 80 karakteri geçemez ve `<` `>` içeremez.
- Studio → çerçeve iletileri hedef kökenle gönderilir; `*` kullanılmaz.

## İletiler

| İleti | Yön | Ne yapar | Test |
|---|---|---|---|
| `{ tur: 'studio-tema-iste' }` | AxBoT / Resonance → Studio | Çerçeve yüklenince temayı ister. | `embedMessages.test.ts` (temaIstegi) |
| `{ tur: 'studio-tema', tema, degiskenler }` | Studio → AxBoT / Resonance | Renkleri, köşeleri ve başlık ölçüsünü gönderir (ayrıntı aşağıda). Görünüm (`data-skin`) ya da köşe (`data-kose`) değişince yeniden gider. | `botTemaMesaji.test.ts`, bot `studioTemasi.test.ts`, Resonance `studioTemasi.test.js` |
| `{ tur: 'ayara-git', ayar, sekme? }` | Studio → AxBoT | Komut paletinde seçilen bot ayarına gider. Gerekirse önce sekmesini açar, sonra ayarın yerine kaydırır, 1,8 sn vurgular ve denetimine odaklanır. | `embedMessages.test.ts` (T2), bot `gomuluSozlesme.test.ts` |
| `{ tur: 'geri-al' }` | Studio → AxBoT | Bot sayfası açıkken ve odak Studio'da bir yazı alanında değilken basılan Ctrl+Z'yi bota iletir. Bot bunu kendi Ctrl+Z'si gibi işler. | `embedMessages.test.ts` (geriAlBotaGider), bot `gomuluSozlesme.test.ts` |
| `{ type: 'axbot:odak-birak' }` | AxBoT → Studio | Botta açık pencere yokken basılan Esc odağı Studio menüsündeki açık sayfaya geri verir (klavye odağı devri). | `embedMessages.test.ts` (odakBirakRequest) |
| `{ type: 'axbot:komut-paleti' }` | AxBoT → Studio | Odak bottayken basılan Ctrl+K Studio'nun komut paletini açar. | `embedMessages.test.ts` (komutPaletiRequest) |
| `{ type: 'axbot:open-external', url }` | AxBoT → Studio | Adresi sistem tarayıcısında açar. Yalnız http(s) adresler kabul edilir. | `embedMessages.test.ts` (openExternalRequest) |
| `{ type: 'axbot:open-music' }` | AxBoT → Studio | Studio'nun Müzik sekmesini açar. | `embedMessages.test.ts` (openMusicRequest) |
| `{ source: 'resonance', type: 'open-external', url }` | Resonance → Studio | Spotify veya Google girişi gibi izinli adresleri açar. | `embedMessages.test.ts` (resonanceLinkAllowed) |
| `{ tur: 'sesli-ptt', basili }` | Studio → AxBoT (sesli dinleyici) | Genel bas-konuş kısayolunu iletir. | bot `lib/sesli/kapi.test.ts` |

## Tema iletisinin değişkenleri

**Renkler:** `--axt-zemin`, `--axt-yuzey`, `--axt-yuzey-2`, `--axt-kenar`, `--axt-vurgu`, `--axt-metin`,
`--axt-soluk`. Değerleri Studio'nun o anki görünümünden (`--panel-*`) gelir.

**Ölçüler:** `--axt-yaricap-kart`, `--axt-yaricap-dugme`, `--axt-yazi-baslik`. Değerleri ortak tasarım
dosyasından (`src/styles/axt-tasarim.css`) gelir.

Bu dosyanın kopyaları:
- **Resonance:** dosyayı `@import` ile alır.
- **AxBoT:** paket derlemesinde (`scripts/axbot-hazirla.mjs`) dosyanın kopyasını alır.

## Klavye

- **Ctrl+K:** Her yerde komut paletini açar.
- **Esc:** Bottayken odak Studio menüsüne döner. Açık bir pencere varsa önce o pencere kapanır.
- **Ctrl+Z:**
  - Odak bottaysa botun son değişikliğini geri alır.
  - Odak Studio'dayken bot sayfası açıksa da aynısını yapar; ileti `geri-al` olarak gider.
  - Odak bir yazı alanındaysa tarayıcının kendi geri alması çalışır.
- **F6 kullanılmaz:** OBS sahne kısayollarıyla çakışır.
