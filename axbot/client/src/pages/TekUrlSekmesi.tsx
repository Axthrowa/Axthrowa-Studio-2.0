/** Overlay Stüdyosu: tek URL (hepsi bir arada) sekmesi — tuval, katmanlar, hizalama */
import { Copy, Check, Bell, Sparkles, Move, Eye, EyeOff, Settings2, RefreshCw } from 'lucide-react';
import { WidgetSettingsForm } from './WidgetSettingsForm.js';
import { GALERI_KATMANI, KATMANLAR, OverlayKatmanlari } from '../widgets/OverlayLayers.js';
import { arkasiniGizlerMi, cakisincaGizlenirMi } from '../lib/katmanCakisma.js';
import { merkezdeBoyutla } from '../lib/hizala.js';
import { cubukTurleri } from '../lib/widget-defaults.js';
import { TEST_ADI, HizaIzgarasi, KATMAN_EMOJISI, KATMAN_AYAR_ID } from './overlayStudioVerileri';
import type { OverlayStudioSonucu } from './useOverlayStudio';
import { Anahtar, Panel, Secim } from '../ui/index.js';

export function TekUrlSekmesi(p: OverlayStudioSonucu) {
  const { allInOne, baseUrl, copiedUrl, copyToClipboard, handleCekilisPointerDown, handlePointerMove, handlePointerUp, handleResetWidget, handleResizePointerDown, handleSaveAllInOne, handleToggleTestMode, handleWidgetPointerDown, hizalaCekilis, hizalaSecili, katmaniTestEt, kenarPayi, kilavuz, modalActionStatus, obsGorunumu, seciliAyarId, selectedCanvasWidget, setAllInOne, setKenarPayi, setObsGorunumu, setSelectedCanvasWidget, singleOverlayUrl, tekUrlYenile, testKatmanlari, triggerWidgetTest, tuvalAnahtari, tuvalOlcek, tuvalRef, widgetGalleryItems, widgetKontrolleri, yerlesimDurumu } = p;
  return (
    <>
      <div className="space-y-6">
        {/* Master OBS Link Card */}
        <Panel className="p-5 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-black flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${allInOne.testMode ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              <h3 className="text-sm font-medium text-white">OBS adresi</h3>
              {allInOne.testMode && (
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md font-bold animate-pulse">
                  Test modu açık
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">Bu adresi OBS'e 1920×1080 Tarayıcı Kaynağı olarak ekleyin.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={handleToggleTestMode}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                allInOne.testMode
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
              title="OBS'te bileşenlerin konumunu rahatça ayarlamak için örnek verileri açıp kapatın"
            >
              {allInOne.testMode ? <Eye className="w-4 h-4 text-amber-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
              <span>{allInOne.testMode ? 'Test modunu kapat' : 'Test modu'}</span>
            </button>

            <input aria-label="Tek OBS adresi" 
              type="text" 
              readOnly 
              value={singleOverlayUrl} 
              className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono w-full sm:w-64 select-all"
            />
            <button
              onClick={() => copyToClipboard(singleOverlayUrl)}
              className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-purple-600/30"
            >
              {copiedUrl === singleOverlayUrl ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedUrl === singleOverlayUrl ? 'Kopyalandı' : 'Kopyala'}</span>
            </button>
          </div>
        </Panel>

        {/* Interactive Screen Preview & Controls Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: 16:9 Stream Canvas Preview with Interactive Drag & Drop */}
          <Panel className="lg:col-span-8 lg:sticky lg:top-0 lg:self-start p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Move className="w-4 h-4 text-purple-400" />
                  Yayın ekranı
                </h3>
                <p className="text-xs text-gray-400">
                  Sürükleyerek taşıyın. Köşe widget'ı büyütür, kenarlar kutuyu değiştirir.
                </p>
              </div>
              <span
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                  yerlesimDurumu === 'hata'
                    ? 'bg-red-500/15 border-red-500/40 text-red-300'
                    : yerlesimDurumu === 'kaydedildi'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-gray-300'
                }`}
                title="Tuvaldeki konum/boyut değişiklikleri kendiliğinden kaydedilir ve OBS'teki overlay'e anında yansır"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {yerlesimDurumu === 'kaydediliyor' || yerlesimDurumu === 'bekliyor'
                    ? 'Kaydediliyor…'
                    : yerlesimDurumu === 'hata'
                      ? 'Kaydedilemedi'
                      : 'OBS ile eşit'}
                </span>
              </span>
            </div>

            {/* Önizleme kipi: örnek veri mi, OBS'in o an gösterdiği mi? Kullanıcı
                "önizlemede görünenler OBS'te görünmüyor" dedi: tuval her bileşeni
                örnek veriyle (ve kapalı katmanları soluk) gösteriyordu; OBS ise
                yalnız AÇIK katmanları, gerçek olay geldikçe çiziyor. */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <div role="tablist" aria-label="Önizleme kipi" className="flex gap-1">
                {([
                  [false, 'Örnek verilerle', 'Her bileşeni örnek içerikle gösterir (yerleşim için)'],
                  [true, "OBS'te görüneceği gibi", "OBS'in şu an gösterdiğinin aynısı: kapalı katmanlar yok, örnekler yalnız OBS Test Modu açıksa"]
                ] as const).map(([deger, ad, ipucu]) => (
                  <button
                    key={ad}
                    type="button"
                    role="tab"
                    aria-selected={obsGorunumu === deger}
                    title={ipucu}
                    onClick={() => {
                      setObsGorunumu(deger);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      obsGorunumu === deger ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {ad}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void tekUrlYenile()}
                title="OBS'teki Tek URL kaynağını ve bu önizlemeyi yeniden yükler"
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Yenile
              </button>
              <p className="text-xs text-gray-400 max-w-md">
                {obsGorunumu
                  ? allInOne.testMode
                    ? 'OBS Test Modu açık: OBS de örnek verileri gösteriyor.'
                    : 'Gerçek veri: uyarı, anket, çark gibi bileşenler olay geldiğinde görünür.'
                  : 'Örnekler yalnız burada; OBS’te de görmek için “OBS Test Modunu Aç”.'}
              </p>
            </div>

            {/* Açık katmanların testleri: yayında görünür, bitince önceki hâline döner */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 mr-1">Test:</span>
              {KATMANLAR.filter((k) => (allInOne as any)[k.anahtar]?.enabled).map((k) => (
                <button
                  key={k.anahtar}
                  type="button"
                  onClick={() => void katmaniTestEt(k.anahtar, k.etiket, TEST_ADI[KATMAN_AYAR_ID[k.anahtar]] || `ornek-${k.anahtar}`)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                >
                  {KATMAN_EMOJISI[k.anahtar] || '🧩'} {k.etiket}
                </button>
              ))}
            </div>

            {/* 16:9 Screen Simulation Box (Interactive Drag Canvas) */}
            <div 
              ref={tuvalRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="axt-onizleme relative w-full aspect-video bg-[#07090e] rounded-lg border border-white/10 overflow-hidden select-none cursor-default mx-auto"
              // Pencere alçakken tuval ekrandan taşmasın: yükseklik görünür alana sığar, 16:9 korunur
              style={{ touchAction: 'none', maxWidth: 'max(320px, calc((100vh - 180px) * 16 / 9))' }}
            >
              {/* Background Stream Grid Pattern & Aspect Ratio Watermark */}
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(#8b5cf6 1px, transparent 1px)', backgroundSize: '24px 24px' }}
              />

              {/* TUVAL = OBS ÇIKTISI
                  Eskiden burada her katman için elle yazılmış sahte
                  maketler vardı ("03:45:20", "🪙 x12", "Lv. 2 %80"), OBS
                  ise gerçek widget'ları yüklüyordu — bu yüzden önizleme
                  ile yayın birbirini tutmuyordu.
                  Artık ikisi de OverlayLayers.tsx'i kullanıyor. Tuval
                  1920×1080 çizilip CSS ile küçültülüyor, böylece ölçek ve
                  konum birebir aynı. */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 1920,
                  height: 1080,
                  transform: `scale(${tuvalOlcek})`,
                  transformOrigin: 'top left'
                }}
              >
                <OverlayKatmanlari
                  key={tuvalAnahtari}
                  config={allInOne as any}
                  onizleme={obsGorunumu ? Boolean(allInOne.testMode) : true}
                  canliKatmanlar={testKatmanlari}
                  sarmala={(katman, icerik, stil) => {
                    const item = (allInOne as any)[katman.anahtar];
                    const secili = selectedCanvasWidget === katman.anahtar;
                    // OBS görünümü: kapalı katman OBS'te hiç çizilmez, burada da yok
                    if (obsGorunumu && !item?.enabled) return null;
                    // Düzenleme görünümü: kapalı katman yalnız seçiliyken (konumlandırmak için) soluk çizilir;
                    // tam ekran katmanlar (JumpScare, ekranda emote) seçili değilken çizilmez. Eskiden 28
                    // katmanın hepsi çiziliyor, açık JumpScare tuvali kaplayıp tüm tıklamaları yutuyordu.
                    if (!obsGorunumu && !secili && !testKatmanlari.includes(katman.anahtar) && (!item?.enabled || katman.tamEkran)) return null;
                    const tiklanir = !katman.tamEkran || secili;
                    return (
                      <div
                        onPointerDown={tiklanir ? (e) => handleWidgetPointerDown(e, katman.anahtar) : undefined}
                        onDoubleClick={() => setSelectedCanvasWidget(katman.anahtar)}
                        title={secili ? katman.etiket : `${katman.etiket} — seçmek için çift tıkla`}
                        style={{
                          ...stil,
                          // Seçili widget düzenlemede üstte: başka widget'ın altında kalsa da tutulabilsin
                          ...(secili && !obsGorunumu ? { zIndex: 9000 } : null),
                          cursor: secili ? 'move' : 'default',
                          // OBS görünümünde seçili widget öne alınmaz: üstündekiler tutmayı engellemesin
                          pointerEvents: tiklanir && (secili || !obsGorunumu) ? undefined : 'none',
                          // Kapalı katman tuvalde soluk görünür ki
                          // konumlandırılabilsin; OBS'te hiç çizilmez.
                          outline: secili ? `3px ${item?.enabled ? 'solid' : 'dashed'} #a78bfa` : '1px dashed rgba(167,139,250,0.35)',
                          outlineOffset: 2,
                          borderRadius: 6
                        }}
                      >
                        {item?.enabled ? (
                          <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>{icerik}</div>
                        ) : (
                          // Kaldırılan (Tek URL'ye dahil olmayan) widget içeriğiyle çizilmez: eskiden seçili kaldığı
                          // için soluk hâliyle tuvalde duruyor, kaldırılmamış sanılıyordu. Yalnız yeri belli olur.
                          <div style={{ pointerEvents: 'none', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(167,139,250,0.08)', color: '#c4b5fd', fontSize: 22, fontWeight: 800, textAlign: 'center', padding: 8 }}>
                            {katman.etiket} — kapalı (Tek URL'de yok)
                          </div>
                        )}
                        {secili && (() => {
                          // Tutamaçlar ekranda hep aynı boyda: tuval ve widget ölçeğinden bağımsız
                          const boy = 14 / (tuvalOlcek * (typeof item?.scale === 'number' && item.scale > 0 ? item.scale : 1));
                          const seritRengi = 'rgba(167,139,250,.45)';
                          return (
                            <>
                              <div title="Kutuyu genişlet" onPointerDown={(e) => handleResizePointerDown(e, katman.anahtar, 'en')} style={{ position: 'absolute', top: 0, right: 0, bottom: boy, width: boy * 0.6, background: seritRengi, cursor: 'ew-resize', touchAction: 'none' }} />
                              <div title="Kutuyu uzat" onPointerDown={(e) => handleResizePointerDown(e, katman.anahtar, 'boy')} style={{ position: 'absolute', left: 0, right: boy, bottom: 0, height: boy * 0.6, background: seritRengi, cursor: 'ns-resize', touchAction: 'none' }} />
                              <div title="Widget'ı büyüt / küçült" onPointerDown={(e) => handleResizePointerDown(e, katman.anahtar, 'olcek')} style={{ position: 'absolute', right: 0, bottom: 0, width: boy, height: boy, background: '#a78bfa', cursor: 'nwse-resize', borderTopLeftRadius: boy / 3, touchAction: 'none' }} />
                            </>
                          );
                        })()}
                      </div>
                    );
                  }}
                />
                {selectedCanvasWidget === 'giveaway' && (allInOne as any).giveaway?.cekilis && (
                  <div
                    onPointerDown={handleCekilisPointerDown}
                    style={{
                      position: 'absolute',
                      left: (allInOne as any).giveaway.cekilis.x,
                      top: (allInOne as any).giveaway.cekilis.y,
                      width: (allInOne as any).giveaway.width,
                      height: (allInOne as any).giveaway.height,
                      transform: `scale(${(allInOne as any).giveaway.scale || 1})`,
                      transformOrigin: 'top left',
                      border: '4px dashed #f59e0b',
                      background: 'rgba(245,158,11,.15)',
                      color: '#fde68a',
                      font: '800 28px sans-serif',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'move',
                      touchAction: 'none',
                      zIndex: 500
                    }}
                  >
                    Çekiliş anı konumu
                  </div>
                )}
                {kilavuz.dikey.map((x) => (
                  <div key={'d' + x} style={{ position: 'absolute', left: x - 1, top: 0, width: 2, height: 1080, background: '#f472b6', zIndex: 9999, pointerEvents: 'none' }} />
                ))}
                {kilavuz.yatay.map((y) => (
                  <div key={'y' + y} style={{ position: 'absolute', top: y - 1, left: 0, height: 2, width: 1920, background: '#f472b6', zIndex: 9999, pointerEvents: 'none' }} />
                ))}
              </div>

            </div>
          </Panel>

          {/* Right: Detailed Component Positioning & Settings Panel */}
          <Panel className="lg:col-span-4 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="pb-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-purple-400" />
                  Seçili widget
                </h3>
                <p className="text-xs text-gray-400">Konumu ve görünürlüğü buradan ayarlanır.</p>
              </div>
            </div>

            {/* Widget Selector Dropdown */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">
                Düzenlenecek Bileşen:
              </label>
              <Secim aria-label="Düzenlenecek Bileşen"
                value={selectedCanvasWidget}
                onChange={e => setSelectedCanvasWidget(e.target.value)}
 className="w-full"
              >
                <option value="chat">💬 Canlı Sohbet (Chat)</option>
                <option value="alerts">🔔 AlertBox Bildirimleri</option>
                <option value="goals">🎯 Hedef Çubuğu (Goal)</option>
                <option value="subathon">⏳ Subathon Sayacı</option>
                <option value="trivia">🧠 Bil Bakalım</option>
                <option value="eventLabels">🏷️ Event Labels (Üst Şerit)</option>
                <option value="theCup">🏆 The Cup (Jeton Kavanozu)</option>
                <option value="polls">📊 Canlı Anket (Polls)</option>
                <option value="wheel">🎡 Çarkıfelek</option>
                <option value="hypeTrain">🚂 Hype Treni</option>
                <option value="nowPlaying">🎵 Resonance (şu an çalan)</option>
                <option value="emoteCombo">🔥 Emote Kombo</option>
                <option value="lyrics">🎤 Canlı Şarkı Sözleri (Lyrics)</option>
                <option value="king">👑 Tahtın Kralı (King System)</option>
                <option value="jumpScare">👻 JumpScare Katmanı</option>
                {KATMANLAR.slice(KATMANLAR.findIndex((k) => k.anahtar === 'activityFeed')).filter((k) => k.anahtar !== 'jumpScare').map((k) => (
                  <option key={k.anahtar} value={k.anahtar}>
                    {KATMAN_EMOJISI[k.anahtar] || '🧩'} {k.etiket}
                  </option>
                ))}
              </Secim>
            </div>


            {/* Selected Widget Card */}
            {(() => {
              // Yeni katmanların kayıtlı yerleşimi yoksa varsayılanından başlanır
              const tanim = KATMANLAR.find((k) => k.anahtar === selectedCanvasWidget);
              const cur = (allInOne as any)[selectedCanvasWidget] || (tanim ? { enabled: false, scale: 1, ...tanim.varsayilan } : null);
              if (!cur) return null;

              const updateCur = (patch: any) => {
                setAllInOne(prev => ({
                  ...prev,
                  [selectedCanvasWidget]: {
                    ...((prev as any)[selectedCanvasWidget] || cur),
                    ...patch
                  }
                }));
              };

              const kendiUrl =
                selectedCanvasWidget === 'soundBoard'
                  ? `${baseUrl}/widgets/pano`
                  : widgetGalleryItems.find((w) => w.id === seciliAyarId || GALERI_KATMANI[w.id]?.anahtar === selectedCanvasWidget)?.url;

              return (
                <div className="space-y-4">
                  {kendiUrl && (
                    <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 space-y-1.5">
                      <span className="text-xs font-bold text-white block">Bu widget'ın kendi adresi</span>
                      <span className="text-xs text-gray-400 block">OBS'te Tek URL olmadan ayrı kaynak olarak eklemek için</span>
                      <div className="space-y-1.5">
                        <p
                          data-widget-adresi
                          className="bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-purple-300 font-mono break-all select-all"
                        >
                          {kendiUrl}
                        </p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(kendiUrl)}
                          className="w-full justify-center px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          {copiedUrl === kendiUrl ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedUrl === kendiUrl ? 'Kopyalandı' : 'Kopyala'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Include in Single OBS URL Toggle */}
                  <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Yayında göster</span>
                      <span className="text-xs text-gray-400">Kapalıysa OBS'te görünmez</span>
                    </div>
                    <Anahtar acik={Boolean(cur.enabled)} onChange={(v) => updateCur({ enabled: v })} ad="Yayında göster" />
                  </div>

                  {selectedCanvasWidget === 'emoteCombo' && (
                    <label className="p-3 bg-[#11131a] rounded-xl border border-white/10 flex items-center justify-between gap-3 cursor-pointer">
                      <span>
                        <span className="text-xs font-bold text-white block">Etki tüm ekranı kaplasın</span>
                        <span className="text-xs text-gray-400">Emote'lar ekranın her yerinden gelir ve her yere saçılır. Ortadaki emote kutunun yerinde kalır</span>
                      </span>
                      <Anahtar acik={Boolean(cur.etkiTamEkran)} onChange={(v) => updateCur({ etkiTamEkran: v })} />
                    </label>
                  )}

                  {selectedCanvasWidget === 'giveaway' && (
                    <label className="p-3 bg-[#11131a] rounded-xl border border-white/10 flex items-center justify-between gap-3 cursor-pointer">
                      <span>
                        <span className="text-xs font-bold text-white block">Çekilirken farklı konumda dursun</span>
                        <span className="text-xs text-gray-400">Tuvalde turuncu kesikli kutuyu sürükle. Çekiliş başlayınca widget oraya geçer, bitince geri döner.</span>
                      </span>
                      <Anahtar acik={Boolean(cur.cekilis)} onChange={(v) => updateCur({ cekilis: v ? { x: cur.x, y: Math.max(0, cur.y - 240) } : undefined })} />
                    </label>
                  )}

                  {selectedCanvasWidget === 'giveaway' && cur.cekilis && (
                    <div className="p-3 bg-[#11131a] rounded-xl border border-orange-400/40 space-y-2">
                      <span className="text-xs font-bold text-white block">Çekiliş anı konumunu hizala</span>
                      <HizaIzgarasi onSec={hizalaCekilis} pay={kenarPayi} payDegisti={setKenarPayi} />
                    </div>
                  )}

                  {!tanim?.tamEkran && (
                    <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 space-y-2.5">
                      <label className="flex items-center justify-between gap-3 cursor-pointer">
                        <span>
                          <span className="text-xs font-bold text-white block">Öne bir şey gelince gizlen</span>
                          <span className="text-xs text-gray-400">Uyarı, anket gibi widget bunun üstüne gelince gizlenir, bitince geri gelir</span>
                        </span>
                        <Anahtar acik={cakisincaGizlenirMi(selectedCanvasWidget, cur)} onChange={(v) => updateCur({ cakisincaGizle: v })} />
                      </label>
                      <label className="flex items-center justify-between gap-3 cursor-pointer">
                        <span>
                          <span className="text-xs font-bold text-white block">Ekrana gelince arkasındakileri gizle</span>
                          <span className="text-xs text-gray-400">Sürekli görünen widget'ta açarsan arkası hep gizli kalır</span>
                        </span>
                        <Anahtar acik={arkasiniGizlerMi(selectedCanvasWidget, cur)} onChange={(v) => updateCur({ arkasiniGizle: v })} />
                      </label>
                    </div>
                  )}

                  {/* Numeric Coordinate and Size Inputs */}
                  <div className="p-3.5 bg-[#11131a] rounded-xl border border-white/10 space-y-3">
                    <div className="text-xs font-bold text-purple-300 flex items-center justify-between">
                      <span>Konum ve boyut</span>
                      <span className="text-xs text-gray-400 font-mono">
                        X:{cur.x} Y:{cur.y} | {cur.width}x{cur.height}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">X Konumu (px)</label>
                        <input aria-label="X Konumu (px)"
                          type="number"
                          value={cur.x ?? 0}
                          onChange={e => updateCur({ x: parseInt(e.target.value, 10) || 0 })}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">Y Konumu (px)</label>
                        <input aria-label="Y Konumu (px)"
                          type="number"
                          value={cur.y ?? 0}
                          onChange={e => updateCur({ y: parseInt(e.target.value, 10) || 0 })}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">Genişlik (px)</label>
                        <input aria-label="Genişlik (px)"
                          type="number"
                          value={cur.width ?? 300}
                          onChange={e => updateCur(merkezdeBoyutla(cur, { width: parseInt(e.target.value, 10) || 100 }))}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">Yükseklik (px)</label>
                        <input aria-label="Yükseklik (px)"
                          type="number"
                          value={cur.height ?? 200}
                          onChange={e => updateCur(merkezdeBoyutla(cur, { height: parseInt(e.target.value, 10) || 50 }))}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Scale Slider */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-xs text-gray-400">Ölçek (Scale)</span>
                        <span className="text-xs font-mono text-purple-300 font-bold">{cur.scale ?? 1}x</span>
                      </div>
                      <input aria-label="Ölçek"
                        type="range"
                        min="0.25"
                        max="3"
                        step="0.05"
                        value={cur.scale ?? 1}
                        onChange={e => updateCur(merkezdeBoyutla(cur, { scale: parseFloat(e.target.value) || 1 }))}
                        className="w-full accent-purple-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                      />
                    </div>

                    {/* Alignment Action Buttons */}
                    <HizaIzgarasi onSec={hizalaSecili} pay={kenarPayi} payDegisti={setKenarPayi} />
                    <p className="text-xs text-gray-500 leading-snug">
                      Sürüklerken kenarlara, ortaya ve diğer katmanlara yapışır (Alt basılı: serbest). Ok tuşları 1 px, Shift+ok 10 px kaydırır.
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        onClick={() => handleResetWidget(selectedCanvasWidget)}
                        className="px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-amber-300 transition-colors"
                      >
                        🔄 Sıfırla
                      </button>
                    </div>
                  </div>

                  {/* Detailed AlertBox Settings (when alerts is selected) */}
                  {selectedCanvasWidget === 'alerts' && (
                    <div className="p-3.5 bg-[#11131a] rounded-xl border border-amber-500/20 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5" />
                          Ayrıntılı AlertBox Ayarları
                        </span>
                        <span className="text-xs text-gray-400 font-mono">OBS Bildirimleri</span>
                      </div>

                      {/* Düzen, animasyon, süre ve ses eskiden burada AYRI alanlardı ama hiçbir
                          bileşen onları okumuyordu (OBS'e yansımıyordu). Gerçek ayarlar aşağıdaki
                          "Seçili Bileşen Ayarları"nda; OBS ile önizleme aynı kaydı kullanır. */}
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Düzen, animasyon, yazı efekti ve ses düzeyi aşağıdaki <b className="text-cyan-300">Seçili Bileşen Ayarları</b> bölümünden değişir ve anında OBS'e gider.
                      </p>

                      {/* Quick Test Trigger Buttons */}
                      <div className="pt-2 border-t border-white/5 space-y-1.5">
                        <label className="text-xs font-bold text-gray-400 block">OBS Canlı Bildirim Testi:</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => triggerWidgetTest('follow', { username: 'EmreCan' })}
                            className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold"
                          >
                            💜 Takip Testi
                          </button>
                          <button
                            onClick={() => triggerWidgetTest('sub', { username: 'Ahmet_Kaya' })}
                            className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold"
                          >
                            ⭐ Abone Testi
                          </button>
                          <button
                            onClick={() => triggerWidgetTest('tip', { username: 'Caner', amount: 100, currency: 'TL' })}
                            className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold"
                          >
                            💰 Bağış Testi
                          </button>
                          <button
                            onClick={() => triggerWidgetTest('raid', { username: 'ProGamer', viewers: 120 })}
                            className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-bold"
                          >
                            🚀 Raid Testi
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hedef türü: tuvaldeki hedef çubuğunun HANGİ hedefi göstereceği. Başlık, hedef ve
                      mevcut değer o hedefin kendi ayarlarındadır (aşağıda) — eskiden buradaki kopya
                      alanlar hiçbir yere bağlı değildi. */}
                  {selectedCanvasWidget === 'goals' && (
                    <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 space-y-1.5 text-xs">
                      <label className="text-xs text-gray-400 block font-bold">Ekrandaki hedef çubukları</label>
                      {cubukTurleri(cur).map((tur) => (
                        <div key={tur} className="flex items-center justify-between gap-2 rounded-lg bg-black/40 px-2 py-1">
                          <span>{tur === 'follower' ? 'Takipçi' : tur === 'sub' ? 'Abone' : tur === 'kicks' ? 'KICKs' : 'Bağış'}</span>
                          {cubukTurleri(cur).length > 1 && (
                            <button
                              type="button"
                              className="text-xs text-red-300"
                              onClick={() => {
                                const kalan = cubukTurleri(cur).filter((t) => t !== tur);
                                updateCur({ cubuklar: kalan, type: kalan[0], height: Math.max(70, kalan.length * 78) });
                              }}
                            >
                              Kaldır
                            </button>
                          )}
                        </div>
                      ))}
                      {(['follower', 'sub', 'tip', 'kicks'] as const).some((t) => !cubukTurleri(cur).includes(t)) && (
                        <Secim
                          aria-label="Hedef çubuğu ekle"
                          value=""
                          onChange={(e) => {
                            const tur = e.target.value;
                            if (!tur) return;
                            const liste = [...cubukTurleri(cur), tur];
                            updateCur({ cubuklar: liste, type: liste[0], height: Math.max(Number(cur.height) || 70, liste.length * 78) });
                          }}
 className="w-full"
                        >
                          <option value="">Çubuk ekle…</option>
                          {(['follower', 'sub', 'tip', 'kicks'] as const)
                            .filter((t) => !cubukTurleri(cur).includes(t))
                            .map((t) => (
                              <option key={t} value={t}>{t === 'follower' ? 'Takipçi' : t === 'sub' ? 'Abone' : t === 'kicks' ? 'KICKs' : 'Bağış'}</option>
                            ))}
                        </Secim>
                      )}
                      <p className="text-xs text-gray-500">Takipçi sayısı Kick’ten, abone, bağış ve KICKs gelen olaylardan her açılışta yazılır.</p>
                    </div>
                  )}

                </div>
              );
            })()}

            {/* Seçili bileşenin KENDİ ayarları — değişiklik anında OBS'e gider. */}
            {seciliAyarId && (
              <div className="pt-1">
                <div className="flex items-center justify-between pb-2">
                  <h4 className="text-xs axt-etiket font-black text-cyan-300">
                    Seçili Bileşen Ayarları
                  </h4>
                  <span className="text-xs text-emerald-400">otomatik kaydedilir</span>
                </div>
                <div className="space-y-2 pb-3">
                  {widgetKontrolleri(seciliAyarId)}
                  {modalActionStatus && <div className="text-xs font-bold text-emerald-400">{modalActionStatus}</div>}
                </div>
                <WidgetSettingsForm
                  key={seciliAyarId}
                  widgetId={seciliAyarId}
                  baseUrl={baseUrl}
                />
              </div>
            )}

            <button
              onClick={handleSaveAllInOne}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Şimdi Kaydet</span>
            </button>
            <p className={`text-xs text-center ${yerlesimDurumu === 'hata' ? 'text-red-400' : 'text-gray-500'}`}>
              {yerlesimDurumu === 'kaydediliyor'
                ? 'Kaydediliyor…'
                : yerlesimDurumu === 'bekliyor'
                  ? 'Değişiklik birazdan kaydedilecek…'
                  : yerlesimDurumu === 'hata'
                    ? 'Kaydedilemedi — AxBoT çalışıyor mu? Tekrar deneyin.'
                    : 'Konum ve boyut değişiklikleri kendiliğinden kaydedilir ve OBS\'e yansır.'}
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
