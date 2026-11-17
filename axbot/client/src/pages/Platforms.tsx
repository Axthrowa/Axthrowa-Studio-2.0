
import {
  Save,
  Check,
  RefreshCw,
  Key,
  MessageSquare,
  Hash,
  Send,
  ExternalLink,
  Zap,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Lock,
  HelpCircle,
  Copy
} from 'lucide-react';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { sunucuPortu } from '../lib/widget-style.js'; import { usePlatformBaglantilari } from './usePlatformBaglantilari';
import { Anahtar, Panel } from '../ui/index.js';

export interface KickVerificationResult {
  success: boolean;
  channelSlug: string;
  chatroomId?: number;
  broadcasterUserId?: number;
  followersCount?: number;
  isVerified?: boolean;
  canSendChat?: boolean;
  error?: string;
}

export function Platforms({ focusPlatform }: { focusPlatform?: string | null }) {
  const { canliKick, channels, copiedLink, handleChange, handleCopyOAuthLink, handleKickConnect, handleKickOAuth, handleKickTestMessage, handleSave, kickChannelInput, kickClientIdInput, kickClientSecretInput, kickConnecting, kickFeedback, kickGirisi, kickMethod, kickResult, kickTestFeedback, kickTestSending, kickTokenInput, loading, oauthUrlForCopy, otherPlatforms, savedPlatform, setCopiedLink, setKickChannelInput, setKickClientIdInput, setKickClientSecretInput, setKickMethod, setKickTokenInput, setTrovoClientId, trovoClientId } = usePlatformBaglantilari({ focusPlatform });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          <span>Platform Bağlantıları & API Yönetimi</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#53fc18]/20 text-[#53fc18] border border-[#53fc18]/30 font-black">
            Kick API Aktif
          </span>
        </h1>
        <p className="text-sm text-gray-400">
          AxBoT'u yayın yaptığınız platformlara bağlayın. Kick.com için resmi API, OAuth ve hızlı moderatör modu tam desteklidir.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 DEDICATED KICK API CONNECTION WIZARD (PROMINENT & COMPLETE) */}
      {/* ========================================================================= */}
      <div
        id="platform-kick"
        className={`p-6 rounded-3xl bg-gradient-to-br from-black/80 via-emerald-950/20 to-black/90 border-2 border-[#53fc18]/40 shadow-2xl shadow-[#53fc18]/10 space-y-6 ${focusPlatform === 'kick' ? 'ring-2 ring-[#53fc18] ring-offset-2 ring-offset-[#090b10]' : ''}`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-[#53fc18] text-black flex items-center justify-center p-2.5 shadow-lg shadow-[#53fc18]/30">
              <PlatformLogo platform="kick" size={26} className="text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Kick.com API Bağlama Merkezi</h2>
                <span className="px-2 py-0.5 rounded bg-[#53fc18]/20 text-[#53fc18] text-[10px] font-black tracking-wider uppercase border border-[#53fc18]/30">
                  Resmi API v1 + Pusher V2
                </span>
              </div>
              <p className="text-xs text-gray-300">
                Canlı sohbet okuma/yazma, abone, hediye abonelik, takipçi ve Kick bildirimlerini bağlayın.
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            {kickResult?.success ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#53fc18]/10 border border-[#53fc18]/40 text-[#53fc18] text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Bağlı: @{kickResult.channelSlug}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>Henüz Bağlanmadı</span>
              </div>
            )}
          </div>
        </div>

        {/* Method Selector Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setKickMethod('quick')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
              kickMethod === 'quick'
                ? 'bg-[#53fc18]/15 border-[#53fc18] text-white shadow-lg shadow-[#53fc18]/10'
                : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-1.5 text-white">
                <Zap className="w-4 h-4 text-[#53fc18]" />
                1. Hızlı Bağlantı
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-bold">Önerilen</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Yalnızca kanal adınızı girin. Canlı sohbet, takipçi ve abonelikleri anında dinlemeye başlar.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setKickMethod('oauth')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
              kickMethod === 'oauth'
                ? 'bg-[#53fc18]/15 border-[#53fc18] text-white shadow-lg shadow-[#53fc18]/10'
                : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-1.5 text-white">
                <Key className="w-4 h-4 text-[#53fc18]" />
                2. Kick Developer OAuth
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#53fc18]/20 text-[#53fc18] font-bold">Resmi API</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Kick Developer Portal (Client ID & Secret) ile tam yetkili resmi API bağlantısı.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setKickMethod('token')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
              kickMethod === 'token'
                ? 'bg-[#53fc18]/15 border-[#53fc18] text-white shadow-lg shadow-[#53fc18]/10'
                : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-1.5 text-white">
                <Lock className="w-4 h-4 text-[#53fc18]" />
                3. Manuel Bot Tokeni
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-bold">Gelişmiş</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Bot hesabınızın Bearer tokenini doğrudan yapıştırarak sohbete yazma iznini açın.
            </p>
          </button>
        </div>

        {/* Informative Guidance Banner */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-gray-300 space-y-2">
          <div className="font-bold text-white flex items-center gap-2 text-xs">
            <Sparkles className="w-4 h-4 text-[#53fc18]" />
            <span>Kick Bağlantı Rehberi: Hangi Yöntemi Seçmeliyim?</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-gray-400">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="font-bold text-[#53fc18] block mb-0.5">✅ 1. Canlı Sohbet Okuma & OBS Uyarıları (Tokensiz)</span>
              <span>Yalnızca kanal adınızı girerek <b>Hızlı Bağlantı</b>'yı seçin. OBS ChatBox, Takipçi/Abone/Hediye sesli uyarıları, Şarkı İsteği (!sr) ve Çekiliş (!cekilis) şifresiz ve tokensiz anında çalışır!</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="font-bold text-purple-400 block mb-0.5">💬 2. Botun Sohbete Cevap Yazması (Token Gerekli)</span>
              <span>Botun chate komut cevabı yazabilmesi için Kick hesabı yetkilendirmesi (OAuth veya Token) gereklidir. Ayrıca bot hesabınızı kanalınızda <code className="text-[#53fc18] font-bold">/mod &lt;bot_adı&gt;</code> komutuyla moderatör yapmalısınız.</span>
            </div>
          </div>
        </div>

        {/* Bot hesabı bir kez girilir ve kayıtlı kalır; yayın kanalı ayrıca girilir */}
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ['bot', 'Bot hesabı', canliKick?.botHesabi || (channels.kick?.token ? 'kayıtlı' : ''), 'Sohbete yazan hesap. Bir kez girilir, kayıtlı kalır.'],
            ['kanal', 'Yayın kanalı girişi', canliKick?.kanalHesabi || '', 'Temizleme, başlık ve kategori gibi yayıncı işleri için.']
          ] as const).map(([hedef, ad, hesap, aciklama]) => (
            <div key={hedef} className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{ad}</span>
                <span className="text-xs text-[#53fc18] truncate">{hesap ? (hesap === 'kayıtlı' ? hesap : `@${hesap}`) : ''}</span>
                <button type="button" onClick={() => void kickGirisi(hedef)} className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#53fc18] text-black cursor-pointer shrink-0">
                  {hesap ? 'Değiştir' : 'Giriş yap'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400">{aciklama}</p>
            </div>
          ))}
        </div>

        {/* Input Fields According to Method */}
        <div className="p-5 rounded-2xl bg-black/60 border border-white/10 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-[#53fc18]" />
              Kick Kanal Kullanıcı Adınız (Yayın Kanalı)
            </label>
            <input
              type="text"
              value={kickChannelInput}
              onChange={e => setKickChannelInput(e.target.value)}
              placeholder="Örn: yayinci (kick.com/yayinci)"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#53fc18]"
            />
          </div>

          {kickMethod === 'oauth' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Kick App Client ID
                </label>
                <input aria-label="Kick App Client ID"
                  type="text"
                  value={kickClientIdInput}
                  onChange={e => setKickClientIdInput(e.target.value)}
                  placeholder="Kick Developer Client ID..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-mono text-xs focus:outline-none focus:border-[#53fc18]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Kick App Client Secret
                </label>
                <input aria-label="Kick App Client Secret"
                  type="password"
                  value={kickClientSecretInput}
                  onChange={e => setKickClientSecretInput(e.target.value)}
                  placeholder="Kick Developer Client Secret..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-mono text-xs focus:outline-none focus:border-[#53fc18]"
                />
              </div>

              <div className="md:col-span-2 p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#53fc18]" />
                    OAuth Yetkilendirme Adımları:
                  </span>
                  <a href="https://kick.com/settings/developer" target="_blank" rel="noreferrer" className="text-[#53fc18] font-bold hover:underline inline-flex items-center gap-1">
                    kick.com/settings/developer <ExternalLink className="w-3 h-3"/>
                  </a>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-300 text-[11px] leading-relaxed">
                  <li>Yukarıdaki linkten Kick Developer Portal'a gidin ve <b>"Create App"</b> butonuna basın.</li>
                  <li>Redirect URI alanına şunu girin: <code className="bg-black/60 px-1.5 py-0.5 rounded text-[#53fc18] font-mono select-all">{`http://localhost:${sunucuPortu()}/api/auth/kick/callback`}</code></li>
                  <li>Oluşan <b>Client ID</b> ve <b>Client Secret</b> değerlerini yukarıdaki kutulara yapıştırın.</li>
                  <li>Aşağıdaki butonlardan biriyle yetkilendirmeyi tamamlayın:</li>
                </ol>

                {/* 💡 Özel Bot Hesabı Giriş Rehberi (Gizli Sekme Çözümü) */}
                <div className="p-3 bg-black/60 border border-[#53fc18]/30 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#53fc18] flex items-center gap-1.5 text-xs">
                      <Lock className="w-3.5 h-3.5" />
                      Bot Hesabıyla Giriş Rehberi (Önerilen):
                    </span>
                    {copiedLink && (
                      <span className="flex items-center gap-1 text-[11px] bg-[#53fc18]/20 px-2 py-0.5 rounded text-[#53fc18] font-bold animate-pulse">
                        <Check className="w-3 h-3" /> Link Kopyalandı!
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Tarayıcınızda ana yayıncı hesabınız açık olduğu için Kick otomatik olarak o hesabı seçebilir. Yayıncı hesabınızdan <b>çıkış yapmadan bot hesabınızı bağlamak için:</b>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300">
                      <b className="text-white block mb-0.5">1. Linki Kopyalayın</b>
                      Mor butona basarak Kick OAuth giriş linkini panoya kopyalayın.
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300">
                      <b className="text-[#53fc18] block mb-0.5">2. Gizli Pencere Açın</b>
                      Klavyeden <kbd className="bg-black px-1.5 py-0.5 rounded text-white font-mono text-[10px] border border-white/20">Ctrl + Shift + N</kbd> yapın ve linki yapıştırın.
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300">
                      <b className="text-white block mb-0.5">3. Bot ile Giriş Yapın</b>
                      Açılan temiz Kick giriş ekranında <b>Bot Hesabınızla</b> oturum açın ve onay verin!
                    </div>
                  </div>

                  {oauthUrlForCopy && (
                    <div className="pt-1">
                      <label className="text-[10px] text-gray-400 block mb-1">Oluşturulan OAuth Giriş Linki:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={oauthUrlForCopy}
                          className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-emerald-300 font-mono select-all focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(oauthUrlForCopy);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 4000);
                          }}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" /> Kopyala
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyOAuthLink}
                    className="px-4 py-2 rounded-xl bg-purple-600/30 border border-purple-500/50 hover:bg-purple-600/50 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5 text-purple-300" />
                    {copiedLink ? '✓ Link Panoya Kopyalandı' : '🕵️‍♂️ Bot Hesabıyla Giriş Yap (Gizli Sekme Linki)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleKickOAuth}
                    className="px-4 py-2 rounded-xl bg-[#53fc18] text-black font-black text-xs hover:bg-[#45d914] transition-all flex items-center gap-1.5 shadow-md shadow-[#53fc18]/20 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Kick ile Yetkilendir (Doğrudan Aç)
                  </button>
                </div>
              </div>
            </div>
          )}

          {kickMethod === 'token' && (
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-[#53fc18]" />
                  Bot Yetki Tokeni / Bearer Token
                </span>
                <span className="text-[11px] text-[#53fc18] font-bold">En Hızlı & Kolay Yöntem</span>
              </label>
              <input
                type="password"
                value={kickTokenInput}
                onChange={e => setKickTokenInput(e.target.value)}
                placeholder="Bearer eyJhbGciOi... veya hesap tokeni"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono text-xs focus:outline-none focus:border-[#53fc18]"
              />
              <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-gray-400 space-y-1">
                <span className="font-bold text-gray-200 block">💡 Developer App Olmadan Token Nasıl Alınır?</span>
                <p className="leading-relaxed">
                  Kick.com'da bot hesabınızla giriş yapın. Klavyeden <b>F12</b> (Geliştirici Araçları) tuşuna basın, <b>Ağ (Network)</b> sekmesine geçin. Herhangi bir sayfayı yeniledikten sonra listedeki bir API isteğine tıklayıp <code>Headers -&gt; Authorization: Bearer eyJ...</code> kısmını kopyalayarak buraya yapıştırın. Developer Portal ile uğraşmadan botunuz anında sohbete yazar!
                </p>
              </div>
            </div>
          )}

          {kickMethod === 'oauth' && (
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-[#53fc18]" />
                  Alınan Access Token (OAuth Sonrası Otomatik Dolar)
                </span>
              </label>
              <input
                type="password"
                value={kickTokenInput}
                onChange={e => setKickTokenInput(e.target.value)}
                placeholder="OAuth ile bağlandığınızda otomatik doldurulacaktır"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono text-xs focus:outline-none focus:border-[#53fc18]"
              />
            </div>
          )}

          {/* Connect & Verify Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleKickConnect}
                disabled={kickConnecting}
                className="px-6 py-2.5 rounded-xl bg-[#53fc18] hover:bg-[#45d914] text-black font-black text-sm flex items-center gap-2 shadow-lg shadow-[#53fc18]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {kickConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>{kickConnecting ? 'Kick API Bağlanıyor...' : 'Kick API\'yi Bağla ve Aktifleştir'}</span>
              </button>

              {kickResult?.success && (
                <button
                  type="button"
                  onClick={handleKickTestMessage}
                  disabled={kickTestSending}
                  className="px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Send className={`w-3.5 h-3.5 ${kickTestSending ? 'animate-pulse' : ''}`} />
                  <span>{kickTestSending ? 'Gönderiliyor...' : 'Chat Test Mesajı Gönder'}</span>
                </button>
              )}
            </div>

            <div className="text-[11px] text-gray-400 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-[#53fc18]" />
              <span>Botun chatte engellenmemesi için kanalınızda <code className="text-[#53fc18] font-bold">/mod AxBoT</code> yazabilirsiniz.</span>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {kickFeedback && (
          <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            kickFeedback.type === 'success' 
              ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300' 
              : 'bg-red-950/50 border border-red-500/40 text-red-300'
          }`}>
            {kickFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{kickFeedback.text}</span>
          </div>
        )}

        {/* Live Diagnostics & Channel Badges */}
        {kickResult && kickResult.success && (
          <div className="p-4 rounded-2xl bg-[#53fc18]/5 border border-[#53fc18]/30 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-gray-400 text-[11px]">Kanal Kullanıcısı</div>
              <div className="text-white font-black text-sm flex items-center gap-1">
                <span>@{kickResult.channelSlug}</span>
                {kickResult.isVerified && (
                  <span className="px-1 py-0.2 rounded bg-[#53fc18] text-black text-[9px] font-black">VERIFIED</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-gray-400 text-[11px]">Chatroom ID</div>
              <div className="text-white font-mono font-bold text-sm">#{kickResult.chatroomId}</div>
            </div>

            <div>
              <div className="text-gray-400 text-[11px]">Takipçi Sayısı</div>
              <div className="text-white font-bold text-sm">{kickResult.followersCount?.toLocaleString()}</div>
            </div>

            <div>
              <div className="text-gray-400 text-[11px]">Bot Sohbet Durumu</div>
              <div className="font-bold text-xs">
                {kickResult.canSendChat ? (
                  <span className="text-[#53fc18] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Yazma & Okuma Aktif
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Yalnızca Canlı Dinleme
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {kickTestFeedback && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            kickTestFeedback.includes('başarıyla') || kickTestFeedback.includes('iletildi')
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : kickTestFeedback.includes('ℹ️')
              ? 'bg-blue-950/60 border-blue-500/40 text-blue-200'
              : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
          }`}>
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span className="leading-relaxed">{kickTestFeedback}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* OTHER PLATFORMS (TWITCH, YOUTUBE, DISCORD, TIKTOK) */}
      {/* ========================================================================= */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <span>Diğer Platformlar</span>
          <span className="text-xs text-gray-500">Twitch, YouTube, Discord, TikTok</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {otherPlatforms.map(p => {
            const conf = channels[p.key] || {
              channel_name: '',
              token: '',
              account_id: '',
              is_active: 1
            };
            const isSaved = savedPlatform === p.key;

            return (
              <Panel
                id={`platform-${p.key}`}
                key={p.key}
                className={`p-6 rounded-2xl flex flex-col justify-between space-y-4 ${focusPlatform === p.key ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#090b10]' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2.5">
                      <PlatformLogo platform={p.key} size={15} variant="badge" showLabel={true} />
                      <span className="text-xs text-gray-400 font-medium">{p.description}</span>
                    </div>

                    {/* Active Switch */}
                    <Anahtar acik={conf.is_active !== 0} onChange={(v) => handleChange(p.key, 'is_active', v ? 1 : 0)} ad={`${p.name} etkin`} />
                  </div>

                  <div className="space-y-3 mt-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-gray-400" />
                        {p.nameLabel}
                      </label>
                      <input
                        type="text"
                        value={conf.channel_name || ''}
                        onChange={e => handleChange(p.key, 'channel_name', e.target.value)}
                        placeholder="Kanal veya kullanıcı adı..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-gray-400" />
                        {p.tokenLabel}
                      </label>
                      <input
                        type="password"
                        value={conf.token || ''}
                        onChange={e => handleChange(p.key, 'token', e.target.value)}
                        placeholder="Token / Gizli Anahtar..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {p.key === 'trovo' && (
                      <div>
                        <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-gray-400" />
                          Trovo Client-ID (zorunlu)
                        </label>
                        <input
                          type="text"
                          value={trovoClientId}
                          onChange={e => setTrovoClientId(e.target.value)}
                          placeholder="developer.trovo.live → uygulamanızın Client ID'si"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    )}

                    <p className="text-[11px] text-gray-500 italic">
                      ℹ️ {p.helpText}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => handleSave(p.key)}
                    disabled={loading}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isSaved
                        ? 'bg-emerald-600 text-white'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
                    }`}
                  >
                    {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {isSaved ? 'Kaydedildi & Bağlandı' : 'Kaydet ve Bağlan'}
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Platforms;
