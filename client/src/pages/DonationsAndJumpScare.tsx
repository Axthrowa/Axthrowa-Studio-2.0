import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Copy,
  Check,
  Skull,
  Play,
  Save,
  Clock
} from 'lucide-react';

interface JumpScareSettings {
  isEnabled: boolean;
  minAmount: number;
  mediaType: 'video' | 'image' | 'audio';
  mediaUrl: string;
  audioUrl?: string;
  durationMs: number;
  volume: number;
}

export default function DonationsAndJumpScare() {
  const [copiedByno, setCopiedByno] = useState(false);
  const [copiedGeneric, setCopiedGeneric] = useState(false);
  const [copiedObs, setCopiedObs] = useState(false);

  const [jsSettings, setJsSettings] = useState<JumpScareSettings>({
    isEnabled: true,
    minAmount: 50,
    mediaType: 'video',
    mediaUrl: 'https://assets.mixkit.co/videos/preview/mixkit-creepy-monster-in-dark-room-41717-large.mp4',
    audioUrl: 'https://cdn.freesound.org/previews/387/387232_1474204-lq.mp3',
    durationMs: 4000,
    volume: 1.0
  });

  const [recentDonations, setRecentDonations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Simulation state
  const [simName, setSimName] = useState('EfsaneBağışçı');
  const [simAmount, setSimAmount] = useState(75);
  const [simMessage, setSimMessage] = useState('Yayın harika gidiyor, başarılar!');
  const [simulating, setSimulating] = useState(false);

  const origin = window.location.origin;
  const [webhookToken, setWebhookToken] = useState('');
  const [disAdres, setDisAdres] = useState('');
  const [disAdresTaslak, setDisAdresTaslak] = useState('');
  const [disAdresHata, setDisAdresHata] = useState('');
  const webhookUrl = (uc: string) => `${disAdres || origin}/api/donations/${uc}?token=${webhookToken}`;
  const bynoWebhookUrl = webhookUrl('bynogame');
  const genericWebhookUrl = webhookUrl('webhook');
  const jumpscareObsUrl = `${origin}/widgets/jumpscare`;

  const fetchData = async () => {
    try {
      const [jsRes, donRes, ayar] = await Promise.all([
        fetch('/api/donations/jumpscare').then(r => r.json()),
        fetch('/api/donations/recent').then(r => r.json()),
        fetch('/api/donations/webhook-ayar').then(r => r.json())
      ]);
      setWebhookToken(ayar?.token || '');
      setDisAdres(ayar?.disAdres || '');
      setDisAdresTaslak(ayar?.disAdres || '');
      if (jsRes) setJsSettings(jsRes);
      if (Array.isArray(donRes)) setRecentDonations(donRes);
    } catch {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  const disAdresKaydet = async () => {
    setDisAdresHata('');
    const r = await fetch('/api/donations/webhook-ayar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disAdres: disAdresTaslak })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setDisAdresHata(j.error || 'Adres kaydedilemedi.');
    setDisAdres(j.disAdres);
    setDisAdresTaslak(j.disAdres);
  };

  const handleCopy = (text: string, type: 'byno' | 'generic' | 'obs') => {
    navigator.clipboard.writeText(text);
    if (type === 'byno') {
      setCopiedByno(true);
      setTimeout(() => setCopiedByno(false), 2000);
    } else if (type === 'generic') {
      setCopiedGeneric(true);
      setTimeout(() => setCopiedGeneric(false), 2000);
    } else {
      setCopiedObs(true);
      setTimeout(() => setCopiedObs(false), 2000);
    }
  };

  const handleSaveJumpScare = async () => {
    setSaving(true);
    setStatusMsg('');
    try {
      const res = await fetch('/api/donations/jumpscare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsSettings)
      });
      if (res.ok) {
        setStatusMsg('✅ JumpScare ayarları kaydedildi!');
        setTimeout(() => setStatusMsg(''), 4000);
      }
    } catch {
      setStatusMsg('❌ Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    try {
      const res = await fetch('/api/donations/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName: simName,
          amount: simAmount,
          currency: 'TL',
          message: simMessage
        })
      });
      if (res.ok) {
        const data = await res.json();
        fetchData();
        setStatusMsg(data.result?.jumpscareFired ? 'Test bağışı gönderildi — JumpScare tetiklendi.' : 'Test bağışı gönderildi — Alert + TTS + kupa çalıştı.');
        setTimeout(() => setStatusMsg(''), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatusMsg(data.error || 'Simülasyon başarısız.');
      }
    } catch {} finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/50 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">
                AxBoT Bağış & Alert Ekosistemi
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-emerald-400" />
              BynoGame, Webhook Bağışları & JumpScare
            </h1>
            <p className="text-gray-300 text-sm mt-1 max-w-2xl">
              BynoGame IPN veya harici bağış servislerinden gelen bağışlar anında AlertBox'ı, Bağış Kupasını (TheCup) ve TTS sesli okumasını tetikler. Belirlediğiniz eşik üzerindeki bağışlarda OBS'te JumpScare patlar!
            </p>
          </div>
        </div>
      </div>

      {/* Bağış sitesi localhost'a ulaşamaz: bildirim tünelden gelir */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-lg">
        <h2 className="text-md font-bold text-white">Bağış sitesinin bu bilgisayara ulaşması</h2>
        <p className="text-xs text-gray-400">
          BynoGame ve Ko-fi bildirimi kendi sunucusundan yollar; bu bilgisayarın yerel adresine ulaşamaz. Bir tünel açın
          (ör. <code className="text-emerald-300">cloudflared tunnel --url http://localhost:3001</code>) ve verdiği https adresini buraya yazın.
          Tünelden yalnız aşağıdaki gizli anahtarlı iki bağış adresine ulaşılabilir; paneli ve diğer uçları dışarıdan kimse göremez.
          Tünelin Host başlığını localhost yapan ayarını açmayın: o zaman bu koruma çalışmaz.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            aria-label="Tünel adresi"
            value={disAdresTaslak}
            onChange={e => setDisAdresTaslak(e.target.value)}
            placeholder="https://ornek.trycloudflare.com"
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
          />
          <button
            onClick={() => void disAdresKaydet()}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 rounded-xl cursor-pointer transition-all"
          >
            Kaydet
          </button>
        </div>
        {disAdresHata && <p role="alert" className="text-xs text-red-400">{disAdresHata}</p>}
        {!disAdres && (
          <p className="text-xs text-amber-300">Tünel adresi yok: aşağıdaki adresler yalnız bu bilgisayardan çalışır, bağış sitesine yapıştırılırsa bağış gelmez.</p>
        )}
        <p className="text-[11px] text-gray-500">Adresler gizli anahtar içerir, ekranda göstermeyin. Geçici tünelin adresi her açılışta değişir; değişince burayı ve bağış sitesini güncelleyin.</p>
      </div>

      {/* Webhook URLs & Setup Guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BynoGame Webhook */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              BynoGame Bildirim (IPN) Entegrasyonu
            </h2>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">Otomatik</span>
          </div>

          <p className="text-xs text-gray-400">
            BynoGame yayıncı panelinde <strong>"Bağış Bildirimi / Webhook"</strong> alanına aşağıdaki adresi yapıştırın:
          </p>

          <div className="flex gap-2">
            <input aria-label="BynoGame bildirim adresi"
              type="text"
              readOnly
              value={bynoWebhookUrl}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none"
            />
            <button
              onClick={() => handleCopy(bynoWebhookUrl, 'byno')}
              className="bg-emerald-700 hover:bg-emerald-600 text-white p-2.5 rounded-xl cursor-pointer transition-all"
              title="Kopyala"
            >
              {copiedByno ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[11px] text-gray-400 space-y-1">
            <p className="font-semibold text-gray-300">💡 BynoGame Kurulum Adımları:</p>
            <p>1. bynogame.com hesabınıza giriş yapıp Yayıncı Paneli &gt; Bildirim Ayarlarına gidin.</p>
            <p>2. "POST Bildirim URL" kutusuna yukarıdaki URL'yi yapıştırın ve kaydedin.</p>
          </div>
        </div>

        {/* Generic Webhook */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              Genel Bağış Webhook'u (Ko-fi ve diğer sağlayıcılar)
            </h2>
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">JSON API</span>
          </div>

          <p className="text-xs text-gray-400">
            Ko-fi veya kendi özel entegrasyonunuzdan gelen bağışları bu adrese POST edin:
          </p>

          <div className="flex gap-2">
            <input aria-label="Genel bağış adresi"
              type="text"
              readOnly
              value={genericWebhookUrl}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-blue-400 focus:outline-none"
            />
            <button
              onClick={() => handleCopy(genericWebhookUrl, 'generic')}
              className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl cursor-pointer transition-all"
              title="Kopyala"
            >
              {copiedGeneric ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[11px] text-gray-400">
            JSON formatında <code className="text-blue-300">{"{ donorName, amount, currency, message }"}</code> gönderildiğinde alertler anında oynatılır. Ko-fi'nin kendi biçimi de okunur.
          </div>
        </div>
      </div>

      {/* JumpScare Settings & Simulation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* JumpScare Configuration (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <Skull className="w-5 h-5 text-red-500" />
              OBS JumpScare Overlay Katmanı
            </h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={jsSettings.isEnabled}
                onChange={e => setJsSettings({ ...jsSettings, isEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-red-600 focus:ring-0"
              />
              <span className="text-xs font-bold text-white">JumpScare Aktif</span>
            </label>
          </div>

          <p className="text-xs text-gray-400">
            OBS sahnenize <strong>Tarayıcı Kaynağı (Browser Source)</strong> olarak ekleyin (1920x1080):
          </p>

          <div className="flex gap-2">
            <input aria-label="JumpScare OBS adresi"
              type="text"
              readOnly
              value={jumpscareObsUrl}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-red-400 focus:outline-none"
            />
            <button
              onClick={() => handleCopy(jumpscareObsUrl, 'obs')}
              className="bg-red-600 hover:bg-red-500 text-white p-2.5 rounded-xl cursor-pointer transition-all"
              title="Kopyala"
            >
              {copiedObs ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Tetiklenecek Minimum Bağış Tutarı (TL):
              </label>
              <input aria-label="Tetiklenecek Minimum Bağış Tutarı (TL)"
                type="number"
                min="1"
                value={jsSettings.minAmount}
                onChange={e => setJsSettings({ ...jsSettings, minAmount: parseInt(e.target.value, 10) || 50 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Ekranda Kalma Süresi (ms):
              </label>
              <input aria-label="Ekranda Kalma Süresi (ms)"
                type="number"
                min="1000"
                step="500"
                value={jsSettings.durationMs}
                onChange={e => setJsSettings({ ...jsSettings, durationMs: parseInt(e.target.value, 10) || 4000 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Korkutucu Video / GIF URL:
            </label>
            <input aria-label="Korkutucu Video / GIF URL"
              type="text"
              value={jsSettings.mediaUrl}
              onChange={e => setJsSettings({ ...jsSettings, mediaUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:border-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Çığlık / Efekt Ses URL (İsteğe bağlı):
            </label>
            <input aria-label="Çığlık / Efekt Ses URL (İsteğe bağlı)"
              type="text"
              value={jsSettings.audioUrl || ''}
              onChange={e => setJsSettings({ ...jsSettings, audioUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:border-red-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleSaveJumpScare}
              disabled={saving}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer transition-all shadow-lg shadow-red-600/30"
            >
              <Save className="w-4 h-4" /> {saving ? 'Kaydediliyor...' : 'JumpScare Ayarlarını Kaydet'}
            </button>

            {statusMsg && <span className="text-xs text-emerald-400 font-semibold">{statusMsg}</span>}
          </div>
        </div>

        {/* Live Donation Simulator (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 space-y-4 shadow-lg">
          <h2 className="text-md font-bold text-white flex items-center gap-2">
            <Play className="w-5 h-5 text-emerald-400" />
            Canlı Bağış & Alert Testi
          </h2>
          <p className="text-xs text-gray-300">
            Bağış simülasyonu çalıştırarak AlertBox, TheCup, TTS ve JumpScare'in çalışmasını test edin.
          </p>

          <form onSubmit={handleSimulateDonation} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Bağışçı Adı:</label>
              <input aria-label="Bağışçı Adı"
                type="text"
                value={simName}
                onChange={e => setSimName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 mb-1">Miktar (TL):</label>
              <input aria-label="Miktar (TL)"
                type="number"
                min="1"
                value={simAmount}
                onChange={e => setSimAmount(parseInt(e.target.value, 10) || 50)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                {simAmount >= jsSettings.minAmount ? '🔥 JumpScare tetiklenecek!' : '⚠️ JumpScare tetiklenmeyecek (eşik altı)'}
              </span>
            </div>

            <div>
              <label className="block text-xs text-gray-300 mb-1">Bağış Mesajı (TTS ile okunacak):</label>
              <textarea aria-label="Bağış Mesajı (TTS ile okunacak)"
                rows={2}
                value={simMessage}
                onChange={e => setSimMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={simulating}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <DollarSign className="w-5 h-5" />
              {simulating ? 'Gönderiliyor...' : 'Test Bağışı Gönder (Alert + TTS + Kupa)'}
            </button>
          </form>
        </div>
      </div>

      {/* Recent Donations Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h2 className="text-md font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          Son Gelen Bağışlar
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-gray-400">
                <th className="pb-3 font-semibold">Bağışçı</th>
                <th className="pb-3 font-semibold">Miktar</th>
                <th className="pb-3 font-semibold">Mesaj</th>
                <th className="pb-3 font-semibold">Platform</th>
                <th className="pb-3 font-semibold">JumpScare</th>
                <th className="pb-3 font-semibold">Zaman</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentDonations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    Henüz bağış kaydı bulunmuyor.
                  </td>
                </tr>
              ) : (
                recentDonations.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-800/30">
                    <td className="py-3 font-bold text-white">{d.donor_name}</td>
                    <td className="py-3 font-extrabold text-emerald-400">{d.amount} {d.currency}</td>
                    <td className="py-3 text-gray-300 max-w-xs truncate">{d.message || '-'}</td>
                    <td className="py-3 uppercase text-gray-400 font-semibold">{d.platform}</td>
                    <td className="py-3">
                      {d.jumpscare_triggered ? (
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <Skull className="w-3.5 h-3.5" /> Tetiklendi
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-500">{new Date(d.created_at).toLocaleTimeString('tr-TR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
