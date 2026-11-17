import { CanliDuzenlemeSeridi } from '../components/CanliDuzenlemeSeridi.js';
import { Layers, Bell, CheckCircle2, MessageSquare, Monitor } from 'lucide-react';
import { useOverlayStudio } from './useOverlayStudio';
import { TekUrlSekmesi } from './TekUrlSekmesi';
import { GaleriSekmesi, SohbetAyarSekmesi, UyariSekmesi } from './OverlayStudioSekmeleri';

export function OverlayStudio() {
  const y = useOverlayStudio();
  const { activeTab, setActiveTab, testNotification, widgetGalleryItemsTr } = y;

  return (
    <div className="space-y-6">
      <CanliDuzenlemeSeridi />
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">Tek adresle bütün yayın ya da tek tek widget'lar.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all_in_one')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'all_in_one'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Tek URL</span>
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'gallery'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Widget'lar ({widgetGalleryItemsTr.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('chat_settings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'chat_settings'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat Overlay Ayarları</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'alerts'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>AlertBox & Bildirimler</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {testNotification && (
        <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 p-3.5 bg-[#1b1430] border border-purple-500/40 rounded-xl shadow-xl text-purple-200 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{testNotification}</span>
        </div>
      )}

      {/* TAB 1: ALL-IN-ONE SINGLE OBS OVERLAY STUDIO */}
      {activeTab === 'all_in_one' && (
        <TekUrlSekmesi {...y} />
      )}

      {/* TAB 2: WIDGET GALLERY (23 WIDGETS) */}
      {activeTab === 'gallery' && (
        <GaleriSekmesi {...y} />
      )}

      {/* TAB 3: CHAT OVERLAY SETTINGS (IMAGE 1 SPECIFICATIONS) */}
      {activeTab === 'chat_settings' && (
        <SohbetAyarSekmesi {...y} />
      )}

      {/* TAB 4: ALERTBOX SETTINGS & SIMULATOR */}
      {activeTab === 'alerts' && (
        <UyariSekmesi {...y} />
      )}
    </div>
  );
}

export default OverlayStudio;
