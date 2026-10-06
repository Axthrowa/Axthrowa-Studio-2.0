# FAZ 0 raporu — Kararlar ve lisans temeli (YOL G)

> Tarih: 2026-09-28 · Plan: [PLAN_PROMPT_OZGUN_YAYIN_MOTORU](PLAN_PROMPT_OZGUN_YAYIN_MOTORU.md) · Karar:
> [ADR-005](ADR-005-DAGITIM-VE-OZGUN-MOTOR.md)

## Yapılanlar

| Madde | Sonuç | Doğrulama |
|---|---|---|
| ADR-005 (dağıtım VAR, tüm ürün GPL-2.0-or-later, libobs motoru korunur) | yazıldı | — |
| ADR-004 "yerine geçildi" | işaretlendi | — |
| Kök `LICENSE` (GPL-2.0 metni), `package.json`/`Cargo.toml` `license` alanı, README lisans + marka notu | eklendi | — |
| Lisans kapısı: `scripts/lisans-denetimi.mjs` panel **ve motor** crate'lerini GPL-2.0-or-later uyumluluğuna göre denetler (AGPL, SSPL, GPL-2.0-only, tescilli yasak) | VERIFIED_LOCAL | `node scripts/lisans-denetimi.mjs` → panel 579, motor 28 crate, "tamam". Bulgu: `jpeg-encoder` IJG lisansı (GPL uyumlu, atıf ister → bildirimlere eklendi) |
| npm lisans testi aynı politikaya göre (`src/lib/licenses.test.ts`) | VERIFIED_LOCAL | vitest 3/3 |
| `THIRD_PARTY_NOTICES.txt` + CycloneDX 1.5 SBOM (`cikti/sbom.cdx.json`) üretici: `scripts/ucuncu-taraf-bildirimleri.mjs` — yalnız dağıtılan bileşenler (Rust çalışma zamanı bağımlılıkları, npm `dev` olmayanlar), her bileşenin kendi lisans dosyaları, yinelenen metinler bir kez | VERIFIED_LOCAL | 460 bileşen (Rust 383, npm 77), 278 ayrı lisans metni, 14 bileşende lisans dosyası yok (SPDX adı yazılı), 832 KB |
| Sürüm derlemesi: lisans kapısı + bildirim üretimi ön yüzden önce, kapı başarısızsa derleme durur; taşınabilir pakete `LICENSE.txt` ve `THIRD_PARTY_NOTICES.txt` | eklendi | bir sonraki sürüm derlemesinde |
| Uygulamada Yardım › Hakkında ve lisanslar (GPL metni, bildirimler aranabilir, marka notu) | eklendi | tip denetimi |

## Yapılmayanlar (bilinçli)

- `cekirdek/` çalışma alanı, IPC şeması yenilemesi: YOL G'de gerekmez (ADR-005 §5); mevcut stdio JSON protokolü sürer.
- `cargo-deny`: ek araç kurulumu yerine mevcut çevrimdışı denetim betiği genişletildi (aynı işlev: lisans kapısı).
- Kaynak arşivi (source offer) otomatik üretimi: depo yayımlanana kadar bildirimlerde "dağıtıcıdan talep" yazar;
  depoyu herkese açmak ürün sahibinin kararıdır (ADR-005 §6).
