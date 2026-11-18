/** Overlay Stüdyosu: galeri, sohbet ayarları ve uyarı sekmeleri */
import { Copy, Check, Bell, Play, Search, Monitor, X } from 'lucide-react';
import { WidgetSettingsForm } from './WidgetSettingsForm.js';
import { WidgetOnizleme } from '../components/WidgetOnizleme.js';
import { GALERI_KATMANI } from '../widgets/OverlayLayers.js';
import { ChatBoxWidget } from '../widgets/ChatBoxWidget.js';
import { OBS_EKLEME, WIDGET_IPUCLARI } from '../lib/widget-ipuclari.js';
import { KATEGORI_ADI, onizlemeBoyutu, testAdiBul } from './overlayStudioVerileri';
import type { OverlayStudioSonucu } from './useOverlayStudio';
import { Panel, Secim } from '../ui/index.js';

export function GaleriSekmesi(p: OverlayStudioSonucu) {
  const { baseUrl, categoryFilter, copiedUrl, copyToClipboard, filteredWidgets, hedefNo, hedefSayisi, hedefTabani, modalActionStatus, modalId, modalUrl, searchQuery, selectedWidgetModal, setCategoryFilter, setHedefNo, setSearchQuery, setSelectedWidgetModal, tekUrlyeEkle, triggerWidgetTest, widgetKontrolleri, yeniHedefCubugu } = p;
  return (
    <>
      <div className="space-y-6">
        {/* Gallery Header & Search */}
        <Panel className="p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              Widget Galerisi
              <span className="text-xs font-normal text-gray-400">({filteredWidgets.length} Widget)</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Yayını güçlendiren, gelir getiren ve kişiselleştiren temel araç seti.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Widget ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <Secim aria-label="Kategori filtresi"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}

            >
              <option value="All">Tüm Kategoriler</option>
              <option value="Goals">Hedefler</option>
              <option value="Engagement">Etkileşim</option>
              <option value="On-Stream">Ekran Üstü</option>
              <option value="Audio & AI">Ses & Yapay Zekâ</option>
            </Secim>
          </div>
        </Panel>

        {/* 4-Column Responsive Grid matching Image 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredWidgets.map(widget => {
            const Icon = widget.icon;
            return (
              <Panel
                key={widget.id}
                onClick={() => setSelectedWidgetModal(widget)}
                className="p-5 rounded-2xl border border-white/10 hover:border-purple-500/50 bg-[#12141a]/90 hover:bg-[#181b24] transition-all flex flex-col justify-between group cursor-pointer relative"
              >

                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="text-sm font-extrabold text-white group-hover:text-purple-300 transition-colors">
                    {widget.title}
                  </h3>

                  <p className="text-xs text-gray-400 mt-1 line-clamp-3 leading-relaxed">
                    {widget.description}
                  </p>
                  {WIDGET_IPUCLARI[widget.id]?.[0] && (
                    <p className="text-xs text-purple-200/80 mt-2 leading-snug line-clamp-2">💡 {WIDGET_IPUCLARI[widget.id][0]}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-xs font-medium text-gray-500">{KATEGORI_ADI[widget.category] || widget.category}</span>
                  <div className="flex items-center gap-1">
                  {testAdiBul(widget.id) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void triggerWidgetTest(testAdiBul(widget.id)!);
                      }}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-purple-300 transition-colors text-xs font-bold"
                      title="Hızlı test: OBS'te örnek göster"
                      aria-label="Hızlı test"
                    >
                      ▶
                    </button>
                  )}
                  {GALERI_KATMANI[widget.id] && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        tekUrlyeEkle(widget.id);
                      }}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-emerald-300 transition-colors"
                      title="Tek OBS URL'sine ekle"
                      aria-label="Tek OBS URL'sine ekle"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(widget.url);
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    title="OBS URL'sini Kopyala"
                  >
                    {copiedUrl === widget.url ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>

        {/* Interactive Widget Settings & Test Modal */}
        {selectedWidgetModal && (
          // Ayarlar kendiliğinden kaydedilir: boşluğa tıklamak kapatır (içerideki seçimden sürükleyip dışarıda bırakmak kapatmaz)
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelectedWidgetModal(null);
            }}
          >
            <div className="bg-[#14161f] border border-white/15 rounded-2xl max-w-6xl w-full p-6 space-y-5 shadow-2xl animate-fadeIn max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <selectedWidgetModal.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      {selectedWidgetModal.title}
                    </h3>
                    <span className="text-xs text-gray-400">{KATEGORI_ADI[selectedWidgetModal.category] || selectedWidgetModal.category}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedWidgetModal(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                {selectedWidgetModal.description}
              </p>

              {/* Nasıl çalışır? */}
              {WIDGET_IPUCLARI[selectedWidgetModal.id] && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-1.5">
                  <h4 className="text-xs font-bold text-purple-200">💡 Nasıl çalışır?</h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc pl-4">
                    {WIDGET_IPUCLARI[selectedWidgetModal.id].map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                    <li className="text-gray-400">{OBS_EKLEME}</li>
                  </ul>
                </div>
              )}

              {hedefTabani && (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Hedef çubukları">
                  {Array.from({ length: hedefSayisi }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setHedefNo(n)}
                      aria-pressed={hedefNo === n}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${hedefNo === n ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}
                    >
                      {n}. çubuk
                    </button>
                  ))}
                  {hedefSayisi < 20 && (
                    <button onClick={() => void yeniHedefCubugu()} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white">
                      + Yeni hedef çubuğu
                    </button>
                  )}
                  {hedefNo > 1 && <span className="text-xs text-gray-400">Bu çubuğun kendi adresi var; OBS'e ayrı kaynak olarak ekleyin.</span>}
                </div>
              )}

              {selectedWidgetModal.id === 'now-playing' ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-gray-300 space-y-2">
                  <p>Görünüm (tema, renk, animasyon, kapak biçimi) Resonance’ın kendi ekranında ayarlanır; OBS adresi aynı kalır.</p>
                  <a href="/resonance/" target="_blank" rel="noreferrer" className="inline-block px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold">
                    🎵 Resonance’ı aç
                  </a>
                </div>
              ) : (
                // Ayarlar solda (geniş), önizleme sağda sabit genişlikte (kaydırırken görünür kalır)
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
                  <WidgetSettingsForm key={modalId} widgetId={modalId} baseUrl={baseUrl} />
                  <div className="lg:sticky lg:top-0">
                    <WidgetOnizleme url={modalUrl} testAdi={hedefNo > 1 ? modalId : testAdiBul(selectedWidgetModal.id)} boyut={onizlemeBoyutu(selectedWidgetModal.id)} />
                  </div>
                </div>
              )}

              {/* Standalone OBS URL Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400">Bağımsız OBS Browser Source URL:</label>
                <div className="flex items-center gap-2">
                  <input aria-label="Bağımsız OBS adresi" 
                    type="text" 
                    readOnly 
                    value={modalUrl}
                    className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono w-full select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(modalUrl)}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {copiedUrl === modalUrl ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedUrl === modalUrl ? 'Kopyalandı' : 'Kopyala'}</span>
                  </button>
                </div>
                {GALERI_KATMANI[selectedWidgetModal.id] && hedefNo === 1 && (
                  <button
                    onClick={() => tekUrlyeEkle(selectedWidgetModal.id)}
                    className="mt-2 w-full px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Tek OBS URL'sine ekle (ayrı kaynak gerekmez)</span>
                  </button>
                )}
              </div>

              {/* Widget Specific Action & Test Panel */}
              <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                <h4 className="text-xs font-bold text-gray-200">Canlı İşlev & Test Kontrolleri</h4>
                {testAdiBul(selectedWidgetModal.id) ? (
                  <button
                    onClick={() => triggerWidgetTest(hedefNo > 1 ? modalId : testAdiBul(selectedWidgetModal.id)!)}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                  >
                    ▶ Hızlı test (OBS'te örnek göster)
                  </button>
                ) : (
                  <p className="text-xs text-gray-500">Bu widget gerçek olayla çalışır; örnek görünüm yukarıdaki önizlemede.</p>
                )}

                {widgetKontrolleri(selectedWidgetModal.id)}

                {/* Universal Fallback Test Button */}
                <button 
                  onClick={() => triggerWidgetTest(modalId)}
                  className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 text-purple-400" />
                  <span>OBS'te Canlı Olayı Test Et</span>
                </button>

                {modalActionStatus && (
                  <div className="text-xs font-bold text-emerald-400 mt-2">
                    {modalActionStatus}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedWidgetModal(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function SohbetAyarSekmesi(p: OverlayStudioSonucu) {
  const { baseUrl, copiedUrl, copyToClipboard } = p;
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Settings Form (Exact replication of Image 1) */}
        <Panel className="lg:col-span-6 p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="pb-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-white">Chat Overlay Özelleştirme</h2>
              <p className="text-xs text-gray-400">OBS sohbet kutunuzun görünüm ve kaybolma davranışlarını belirleyin.</p>
            </div>
            <span className="text-xs font-mono bg-purple-600/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">
              OBS 450x700 px
            </span>
          </div>

          {/* Eskiden burada ayrı bir form vardı ve `chat_overlay_settings` kaydına yazıyordu;
              OBS'teki sohbet bileşeni o kaydı HİÇ okumuyordu ("önizlemede başka, OBS'te başka").
              Artık gerçek bileşenin kendi ayarları: değişiklik kendiliğinden kaydedilir ve OBS'e gider. */}
          <WidgetSettingsForm widgetId="chat-overlay" baseUrl={baseUrl} />
        </Panel>

        {/* Right: Live Chatbox Simulation */}
        <Panel className="lg:col-span-6 p-6 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                Canlı Önizleme (OBS ile aynı bileşen)
              </h3>
              <span className="text-xs text-gray-400 font-mono">OBS Önizleme (400x550)</span>
            </div>

            {/* GERÇEK sohbet bileşeni (OBS'tekiyle aynı kod ve ayarlar); sohbet boşken örnek mesajlar */}
            <div
              className="mt-4 rounded-2xl border border-white/10 overflow-hidden relative bg-[#07090e]"
              style={{ height: 420, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
            >
              <ChatBoxWidget embedded previewMode />
            </div>
          </div>

          {/* OBS Browser Source URL */}
          <div className="p-3.5 bg-black/50 border border-white/10 rounded-xl space-y-2">
            <span className="text-xs font-bold text-gray-300">OBS Bağımsız Chatbox URL:</span>
            <div className="flex items-center gap-2">
              <input aria-label="Bağımsız sohbet adresi"
                type="text"
                readOnly
                value={`${baseUrl}/widgets/chatbox`}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono select-all"
              />
              <button
                onClick={() => copyToClipboard(`${baseUrl}/widgets/chatbox`)}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
              >
                {copiedUrl === `${baseUrl}/widgets/chatbox` ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>Kopyala</span>
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function UyariSekmesi(p: OverlayStudioSonucu) {
  const { alerts, baseUrl, copiedUrl, copyToClipboard, selectedAlert, setSelectedAlert, triggerWidgetTest } = p;
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Alert Presets */}
        <Panel className="lg:col-span-5 p-6 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-base font-extrabold text-white">Bildirim Şablonları</h2>
          <div className="space-y-2.5">
            {alerts.map(preset => (
              <div
                key={preset.id}
                onClick={() => setSelectedAlert(preset)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedAlert?.id === preset.id
                    ? 'bg-purple-600/20 border-purple-500/50 shadow-lg shadow-purple-600/20'
                    : 'bg-[#12141a] border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: preset.accent_color || '#8b5cf6' }}
                  />
                  <div>
                    <h4 className="text-xs font-extrabold text-white capitalize">{preset.event_type}</h4>
                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{preset.title_template}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-gray-500">{(preset.duration_ms || 5000) / 1000}s</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Right: Alert Test & Simulator */}
        <Panel className="lg:col-span-7 p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              AlertBox Canlı Test Paneli
            </h3>
            <span className="text-xs text-gray-400">Tek tıkla test bildirimleri fırlatın</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => triggerWidgetTest('follow', { username: 'EmreCan' })}
              className="p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-xs font-bold text-purple-200 transition-all text-center"
            >
              💜 Takipçi Testi
            </button>
            <button
              onClick={() => triggerWidgetTest('sub', { username: 'Elif_Nur' })}
              className="p-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-200 transition-all text-center"
            >
              ⭐ Abone Testi
            </button>
            <button
              onClick={() => triggerWidgetTest('tip', { username: 'Mert', amount: 150, currency: 'TL' })}
              className="p-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-200 transition-all text-center"
            >
              💰 Bağış Testi
            </button>
            <button
              onClick={() => triggerWidgetTest('raid', { username: 'ProStreamer', viewers: 85 })}
              className="p-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-xs font-bold text-red-200 transition-all text-center"
            >
              🚀 Raid Testi
            </button>
          </div>

          {/* Standalone AlertBox URL */}
          <div className="p-4 bg-black/50 border border-white/10 rounded-xl space-y-2 mt-4">
            <span className="text-xs font-bold text-gray-300">OBS Bağımsız AlertBox URL:</span>
            <div className="flex items-center gap-2">
              <input aria-label="Bağımsız uyarı adresi"
                type="text"
                readOnly
                value={`${baseUrl}/widgets/alertbox`}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono select-all"
              />
              <button
                onClick={() => copyToClipboard(`${baseUrl}/widgets/alertbox`)}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
              >
                {copiedUrl === `${baseUrl}/widgets/alertbox` ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>Kopyala</span>
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
