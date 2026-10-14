import { useState, useEffect } from 'react';
import { CustomCommand } from '../types.js';
import { Terminal, Plus, Edit2, Trash2, Check, Sparkles, Search } from 'lucide-react';

const DEFAULT_COMMANDS = [
  { name: 'puan', response: 'Puanını gösterir', user_level: 'everyone', category: 'Ekonomi' },
  { name: 'liderlik', response: 'Puan sıralaması', user_level: 'everyone', category: 'Ekonomi' },
  { name: 'seviye', response: 'Seviye / rank profili', user_level: 'everyone', category: 'Ekonomi' },
  { name: 'watchtime', response: 'İzleme süresi', user_level: 'everyone', category: 'Ekonomi' },
  { name: 'market', response: 'Sadakat mağazası', user_level: 'everyone', category: 'Ekonomi' },
  { name: 'al', response: 'Ödül satın al', user_level: 'everyone', category: 'Ekonomi' },
  { name: 'katil', response: 'Çekilişe katıl', user_level: 'everyone', category: 'Çekiliş' },
  { name: 'clip', response: 'Son klipten paylaş', user_level: 'everyone', category: 'Extras' },
  { name: 'permit', response: 'Kullanıcıya link izni ver', user_level: 'mod', category: 'Moderasyon' },
  { name: 'title', response: 'Başlığı gösterir · mod: !title <yeni başlık>', user_level: 'everyone', category: 'Yayın' },
  { name: 'game', response: 'Kategoriyi gösterir · mod: !game <kategori>', user_level: 'everyone', category: 'Yayın' },
  { name: 'followage', response: 'Takip süresini gösterir', user_level: 'everyone', category: 'Yayın' },
  { name: 'accountage', response: 'Hesap yaşını gösterir', user_level: 'everyone', category: 'Yayın' },
  { name: 'uptime', response: 'Gerçek yayın süresi (kapalıysa söyler)', user_level: 'everyone', category: 'Yayın' },
  { name: 'komutlar', response: 'Komut listesi', user_level: 'everyone', category: 'Genel' },
  { name: 'quote', response: 'Rastgele alıntı', user_level: 'everyone', category: 'Extras' },
  { name: 'addquote', response: 'Alıntı ekle', user_level: 'mod', category: 'Extras' },
  { name: 'count', response: 'Sayaç göster/arttır', user_level: 'everyone', category: 'Extras' }
];

export function Commands() {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [search, setSearch] = useState('');
  const [editingCmd, setEditingCmd] = useState<CustomCommand | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [tab, setTab] = useState<'my' | 'default'>('my');
  const [disabledDefaults, setDisabledDefaults] = useState<string[]>([]);

  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = () => {
    fetch('/api/commands')
      .then(r => r.json())
      .then(d => setCommands(d))
      .catch(() => {});
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        try { setDisabledDefaults(JSON.parse(d.default_commands_disabled || '[]')); } catch { setDisabledDefaults([]); }
      })
      .catch(() => {});
  };

  const [kayitHatasi, setKayitHatasi] = useState('');

  // Eskiden sonuç denetlenmiyordu: sunucu 500 dönse de pencere "kaydedildi"
  // gibi kapanıyordu (düzenleme aslında her seferinde başarısızdı).
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCmd) return;
    setKayitHatasi('');

    const r = await fetch(isNew ? '/api/commands' : `/api/commands/${editingCmd.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingCmd)
    }).catch(() => null);

    if (!r || !r.ok) {
      const g = r ? await r.json().catch(() => ({})) : {};
      setKayitHatasi(String((g as any)?.error || 'Kaydedilemedi — sunucuya ulaşılamadı.'));
      return;
    }

    setEditingCmd(null);
    loadCommands();
  };

  const PLATFORM_SECENEKLERI = [
    { id: 'kick', ad: 'Kick' },
    { id: 'twitch', ad: 'Twitch' },
    { id: 'youtube', ad: 'YouTube' },
    { id: 'tiktok', ad: 'TikTok' },
    { id: 'discord', ad: 'Discord' },
    { id: 'trovo', ad: 'Trovo' }
  ];

  const seciliPlatformlar = (c: CustomCommand) =>
    String(c.platforms || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const ERISIM_ETIKETI: Record<string, string> = {
    online: 'yayında',
    offline: 'yayın kapalıyken'
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu komutu silmek istediğinize emin misiniz?')) {
      await fetch(`/api/commands/${id}`, { method: 'DELETE' });
      loadCommands();
    }
  };

  const insertVariable = (tag: string) => {
    if (!editingCmd) return;
    setEditingCmd({
      ...editingCmd,
      response: `${editingCmd.response || ''} ${tag}`.trim()
    });
  };

  const filteredCommands = commands.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.response.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Komutlar</h1>
          <p className="text-sm text-gray-400">
            Özel komutlarınız ve varsayılan komutlarınız.
          </p>
        </div>

        <button
          onClick={() => {
            setIsNew(true);
            setKayitHatasi('');
            setEditingCmd({
              id: '',
              name: '',
              response: '',
              user_level: 'everyone',
              cooldown: 5,
              aliases: '[]',
              is_enabled: 1,
              use_count: 0,
              description: '',
              cooldown_mode: 'global',
              user_cooldown: 0,
              cost_points: 0,
              min_level: 0,
              platforms: '',
              trigger_type: 'command',
              access_mode: 'always'
            });
          }}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
        >
          <Plus className="w-4 h-4" /> Yeni Komut Ekle
        </button>
      </div>

      <div className="flex gap-1 bg-black/30 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('my')} className={`px-3 py-2 rounded-lg text-xs font-bold ${tab === 'my' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Komutlarım</button>
        <button onClick={() => setTab('default')} className={`px-3 py-2 rounded-lg text-xs font-bold ${tab === 'default' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Varsayılan Komutlar</button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Komut adı veya cevabında ara..."
          className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
        />
      </div>

      {tab === 'default' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-xs font-bold text-gray-400 uppercase">
              <tr><th className="py-3 px-4">Komut</th><th className="py-3 px-4">Açıklama</th><th className="py-3 px-4">Yetki</th><th className="py-3 px-4">Kategori</th><th className="py-3 px-4">Açık</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {DEFAULT_COMMANDS.filter(c => c.name.includes(search.toLowerCase()) || c.response.toLowerCase().includes(search.toLowerCase())).map(cmd => (
                <tr key={cmd.name}>
                  <td className="py-3 px-4 font-bold text-purple-400">!{cmd.name}</td>
                  <td className="py-3 px-4 text-gray-300">{cmd.response}</td>
                  <td className="py-3 px-4 text-xs">{cmd.user_level}</td>
                  <td className="py-3 px-4 text-xs">{cmd.category}</td>
                  <td className="py-3 px-4">
                    <input type="checkbox" checked={!disabledDefaults.includes(cmd.name)} onChange={async e => {
                      const next = e.target.checked ? disabledDefaults.filter(n => n !== cmd.name) : [...disabledDefaults, cmd.name];
                      setDisabledDefaults(next);
                      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ default_commands_disabled: JSON.stringify(next) }) });
                    }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'my' && <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/10">
            <tr>
              <th className="py-3 px-4">Komut</th>
              <th className="py-3 px-4">Yanıt / Eylem</th>
              <th className="py-3 px-4">Yetki</th>
              <th className="py-3 px-4">Bekleme</th>
              <th className="py-3 px-4">Kullanım</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredCommands.map(cmd => (
              <tr key={cmd.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4 font-bold text-purple-400">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-gray-400" />
                    {cmd.trigger_type === 'keyword' ? `"${cmd.name}"` : `!${cmd.name}`}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cmd.trigger_type === 'keyword' && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[9px] font-black">ANAHTAR KELİME</span>
                    )}
                    {cmd.access_mode && cmd.access_mode !== 'always' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-black">
                        yalnız {ERISIM_ETIKETI[cmd.access_mode]}
                      </span>
                    )}
                    {!!cmd.cost_points && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] font-black">
                        {cmd.cost_points} puan
                      </span>
                    )}
                    {!!cmd.platforms && (
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-300 text-[9px] font-black">{cmd.platforms}</span>
                    )}
                    {!cmd.is_enabled && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 text-[9px] font-black">KAPALI</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-300 max-w-md truncate">
                  {cmd.response}
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-gray-300">
                    {cmd.user_level}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-400 text-xs">
                  {cmd.cooldown} sn{cmd.cooldown_mode === 'user' ? ` · kişi ${cmd.user_cooldown || cmd.cooldown} sn` : ''}
                </td>
                <td className="py-3 px-4 text-gray-400 text-xs">
                  {cmd.use_count} kez
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => {
                      setIsNew(false);
                      setKayitHatasi('');
                      setEditingCmd(cmd);
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cmd.id)}
                    className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {/* Modal for Add / Edit */}
      {editingCmd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl border border-white/20 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              {isNew ? 'Yeni Komut Oluştur' : `Komutu Düzenle (!${editingCmd.name})`}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Etkinleştirme</label>
                  <select
                    value={editingCmd.trigger_type || 'command'}
                    onChange={e => setEditingCmd({ ...editingCmd, trigger_type: e.target.value as any })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="command">Sadece komut (!ad)</option>
                    <option value="keyword">Sohbet anahtar kelimesi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Erişim</label>
                  <select
                    value={editingCmd.access_mode || 'always'}
                    onChange={e => setEditingCmd({ ...editingCmd, access_mode: e.target.value as any })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="always">Her zaman</option>
                    <option value="online">Yalnız yayın açıkken</option>
                    <option value="offline">Yalnız yayın kapalıyken</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  {editingCmd.trigger_type === 'keyword'
                    ? 'Anahtar kelime veya öbek (mesajın içinde geçince çalışır)'
                    : 'Komut adı (! olmadan yazın)'}
                </label>
                <input
                  type="text"
                  required
                  value={editingCmd.name}
                  onChange={e => setEditingCmd({ ...editingCmd, name: e.target.value })}
                  placeholder={editingCmd.trigger_type === 'keyword' ? 'Örn: iyi yayınlar' : 'Örn: discord'}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
                {editingCmd.trigger_type === 'keyword' && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Bütün kelime olarak eşleşir ("selam", "selamlar" içinde tetiklenmez), Türkçe büyük/küçük harf fark etmez.
                    Anahtar kelimeyle tetiklenince puan alınmaz ve yetki reddi sessizdir. Botun kendi mesajı tetiklemez.
                  </p>
                )}
                {editingCmd.access_mode && editingCmd.access_mode !== 'always' && (
                  <p className="text-[10px] text-amber-300/80 mt-1">
                    Yayın durumu Kick, Twitch (jetonla), YouTube (video kimliğiyle), TikTok ve Trovo'dan okunur. Hiçbir platform
                    durum bildirmiyorsa komut engellenmez.
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-300">
                    Bot Yanıtı
                  </label>
                  <span className="text-[11px] text-purple-400 font-semibold">Tıklayarak değişken ekleyin:</span>
                </div>

                {/* Variable Pills */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    '$(user)',
                    '$(touser)',
                    '$(query)',
                    '$(count)',
                    '$(uptime)',
                    '$(random.1-100)',
                    '$(puan)',
                    '$(sor $(query))'
                  ].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertVariable(tag)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <textarea
                  required
                  rows={3}
                  value={editingCmd.response}
                  onChange={e => setEditingCmd({ ...editingCmd, response: e.target.value })}
                  placeholder="Botun sohbete yazacağı mesaj veya cevap..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Kullanıcı Yetkisi
                  </label>
                  <select
                    value={editingCmd.user_level}
                    onChange={e => setEditingCmd({ ...editingCmd, user_level: e.target.value as any })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="everyone">Herkes (Everyone)</option>
                    <option value="regular">Düzenli izleyiciler (!regulars ile eklenenler + VIP + mod)</option>
                    <option value="sub">Aboneler (Subscriber)</option>
                    <option value="vip">VIP</option>
                    <option value="mod">Moderatörler</option>
                    <option value="broadcaster">Yalnızca Yayıncı</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Bekleme süresi (sn)</label>
                  <input
                    type="number"
                    min={0}
                    max={86400}
                    value={editingCmd.cooldown}
                    onChange={e => setEditingCmd({ ...editingCmd, cooldown: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Bekleme modu</label>
                  <select
                    value={editingCmd.cooldown_mode || 'global'}
                    onChange={e => setEditingCmd({ ...editingCmd, cooldown_mode: e.target.value as any })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="global">Genel (herkes için tek sayaç)</option>
                    <option value="user">Kullanıcı başına</option>
                  </select>
                </div>
                {editingCmd.cooldown_mode === 'user' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">Kişi başı bekleme (sn)</label>
                    <input
                      type="number"
                      min={0}
                      max={86400}
                      value={editingCmd.user_cooldown ?? 0}
                      onChange={e => setEditingCmd({ ...editingCmd, user_cooldown: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Fiyat (puan)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingCmd.cost_points ?? 0}
                    onChange={e => setEditingCmd({ ...editingCmd, cost_points: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Yetersiz bakiyede komut çalışmaz; yayıncıdan alınmaz.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">En düşük seviye</label>
                  <input
                    type="number"
                    min={0}
                    value={editingCmd.min_level ?? 0}
                    onChange={e => setEditingCmd({ ...editingCmd, min_level: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">0 = şart yok. Seviye sistemi kapalıysa uygulanmaz.</p>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-gray-300 mb-1">Platformlar (hiçbiri seçili değilse hepsi)</span>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_SECENEKLERI.map((pl) => {
                    const secili = seciliPlatformlar(editingCmd).includes(pl.id);
                    return (
                      <label
                        key={pl.id}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${
                          secili ? 'bg-purple-600/30 border-purple-500 text-white' : 'bg-black/30 border-white/10 text-gray-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={secili}
                          onChange={(e) => {
                            const liste = new Set(seciliPlatformlar(editingCmd));
                            if (e.target.checked) liste.add(pl.id);
                            else liste.delete(pl.id);
                            setEditingCmd({ ...editingCmd, platforms: [...liste].join(',') });
                          }}
                        />
                        {pl.ad}
                      </label>
                    );
                  })}
                </div>
              </div>
              <label className="block text-xs font-bold text-gray-300">Takma adlar (virgülle)
                <input value={(() => { try { return JSON.parse(editingCmd.aliases || '[]').join(', '); } catch { return ''; } })()} onChange={e => setEditingCmd({ ...editingCmd, aliases: JSON.stringify(e.target.value.split(',').map(s => s.trim()).filter(Boolean)) })} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm mt-1" />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                <input type="checkbox" checked={editingCmd.is_enabled !== 0} onChange={e => setEditingCmd({ ...editingCmd, is_enabled: e.target.checked ? 1 : 0 })} /> Komut açık
              </label>

              {kayitHatasi && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{kayitHatasi}</p>
              )}

              <div className="pt-3 border-t border-white/10 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingCmd(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
                >
                  <Check className="w-4 h-4" /> Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Commands;
