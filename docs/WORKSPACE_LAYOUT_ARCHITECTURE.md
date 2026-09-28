# Yayın çalışma alanı yerleşimi

```
┌ Menü çubuğu: Dosya · Düzen · Görünüm · Docklar · Profil · Sahne Koleksiyonu · Araçlar · Yayın · Hedefler · … ┐
├ Tuval sekmesi (Yatay / Dikey) · Güvenli kip göstergesi                                                        │
├ Önizleme ─────────────────────────────── (Studio Mode: Önizleme | Geçiş → Kes → Takas ⇄ | Program) ─────────┤
│                     canlı JPEG kare + düzenleme katmanı (SVG, tuval koordinatları)                             │
├──────────── yükseklik ayırıcısı (sürükle) ────────────────────────────────────────────────────────────────────┤
│ Sahneler ┃ Kaynaklar ┃ Ses Mikseri ┃ Sahne Geçişleri ┃ Denetimler ┃ (Hedefler) ┃ (İstatistikler)              │
├ Durum çubuğu: motor · koleksiyon · CANLI süre · KAYIT süre · hedef sağlığı · CPU · FPS · geciken/atlanan · kbps ┤
```

- Bileşenler `src/components/broadcast/`: `YayinCalismaAlani` (durum, menü, klavye, geri al), `OnizlemeAlani`,
  `SahnelerDock`, `KaynaklarDock`, `MikserDock`, `GecislerDock`, `DenetimlerDock`, `HedeflerDock` (+ İstatistik),
  diyaloglar (`DonusumDiyalogu`, `FiltrelerDiyalogu`, `GelismisSesDiyalogu`, `KaynakEkleDiyalogu`,
  `KoleksiyonYoneticisi`, `YayinAyarlari`, `SihirbazDiyalogu`, `KomutPaleti`), `ortak.tsx` (pencere, ad istemi,
  onay, menü çubuğu).
- Saf modüller (testli): `lib/sahneAgaci.ts` (ağaç, kutu geometrisi, isabet, yapışma, boyutlandırma),
  `lib/dockDuzeni.ts`, `lib/geriAl.ts`, `lib/sesMatematik.ts`, `lib/motorCanli.ts`, `lib/projektor.ts`.
- **Dock düzeni**: görünür docklar, oranlar, alt sıra yüksekliği, kilit → `localStorage` (`yya.yayin.docklar.v1`,
  yalnız görünüm tercihi; bozuksa varsayılan). Docklar menüsü: göster/gizle, kilitle, sıfırla, ayrı pencerede aç.
- **Ayrı pencere** (Tauri webview, `lib/projektor.ts`): `/dock?id=mikser|sahneler|hedefler|istatistik` ve
  `/projektor?tuval=…` (monitör seçilirse tam ekran). Konum hatırlanır; kayıtlı konum artık hiçbir monitörde değilse
  ana monitöre alınır. Bu pencerelerin yetkisi yalnız kendini kapatmak ve konum okumaktır (`capabilities/projektor.json`).
- **Veri akışı**: durum 1 sn, sahneler/ses 1,5 sn yoklama; ölçer ve kareler `/ws/motor` (yalnız yerel, abone
  sayımlı: motor yalnız izleyen varken üretir). Düzenleyen sahne: normalde program, Studio Mode'da önizleme.
- **Motor kapalı**: tek kart — dikey tuval, kare hızı, başlat / güvenli kipte başlat / yayın ayarları; çökme
  sonrası karar seçenekleri.
