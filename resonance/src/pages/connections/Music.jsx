import { useState } from 'react'
import { gomuluMu } from '../../components/layout/DashboardLayout'
import { copyText } from '../../lib/clipboard'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { openExternalViaHost } from '../../lib/hostBridge'
import { SetupGuide, SPOTIFY_STEPS, YTMD_STEPS } from '../../components/SetupGuide'
import { useAuth } from '../../context/AuthContext'
import { useYtmd } from '../../context/YtmdContext'
import { useConfig } from '../../context/ConfigContext'
import { useLanguage } from '../../context/LanguageContext'
import {
  BROKER_REDIRECT_URIS,
  getBrokerRedirectUri,
  setBrokerRedirectUri,
  getClientId,
  setClientId,
  getRedirectUri,
  getSpotifyAuthorizeUrl,
  connectSpotifyWithPastedUrl,
  connectSpotifyWithRefreshToken,
  isValidBrokerRedirect,
  redirectToSpotifyAuthorize,
} from '../../lib/spotifyAuth'

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#1db954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34a.749.749 0 01-1.031.25c-2.822-1.723-6.375-2.111-10.56-1.157a.751.751 0 01-.334-1.464c4.576-1.045 8.5-.595 11.674 1.34.353.215.465.676.251 1.031zm1.47-3.269a.937.937 0 01-1.29.312c-3.23-1.985-8.156-2.56-11.98-1.4a.938.938 0 01-.545-1.794c4.368-1.325 9.799-.683 13.503 1.593a.938.938 0 01.312 1.289zm.126-3.402C15.24 8.478 8.82 8.271 5.1 9.412a1.125 1.125 0 01-.652-2.153c4.269-1.296 11.362-1.046 15.847 1.617a1.125 1.125 0 11-1.178 1.917z" />
    </svg>
  )
}

// "Bağlı" yazması veri aktığı anlamına gelmiyordu: eşleşme token'ı ile canlı
// Socket.IO akışı ayrı şeyler. Kullanıcının hangisinin eksik olduğunu
// görebilmesi için akış durumunu ayrıca gösteriyoruz.
const STREAM_LABELS = {
  idle: ['bg-[var(--color-text-muted)]', 'Akış bekleniyor — Müzik kaynağı olarak YouTube Music seçili olmalı'],
  connecting: ['bg-amber-400', 'Companion Server’a bağlanılıyor…'],
  live: ['bg-emerald-400', 'Canlı akış çalışıyor'],
  error: ['bg-red-400', 'Akış hatası'],
}

function YtmdStream({ ytmd }) {
  const [dot, label] = STREAM_LABELS[ytmd.socketState] || STREAM_LABELS.idle
  return (
    <div className="mt-2 rounded-xl border border-[var(--color-border)] px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-white">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      {ytmd.socketError && <p className="mt-2 text-xs text-red-300">{ytmd.socketError}</p>}
    </div>
  )
}

export default function MusicConnections() {
  const { t } = useLanguage()
  const { isAuthenticated, user, logout, hostMode, hostStatus, refreshUser } = useAuth()
  const ytmd = useYtmd()
  const { updateConfig } = useConfig()
  const [clientIdInput, setClientIdInput] = useState(getClientId())
  const [redirectUri, setRedirectUri] = useState(getBrokerRedirectUri())
  const [copied, setCopied] = useState(false)
  const [connectError, setConnectError] = useState(null)
  // Tarayıcı otomatik açılmazsa: adresi elle aç, dönen linki yapıştır
  const [manualOpen, setManualOpen] = useState(false)
  const [authorizeUrl, setAuthorizeUrl] = useState('')
  const [pastedUrl, setPastedUrl] = useState('')
  const [manualBusy, setManualBusy] = useState(false)
  const hostBase = BROKER_REDIRECT_URIS[0].replace('/resonance/callback', '')
  const [refreshInput, setRefreshInput] = useState('')
  const [tokenBusy, setTokenBusy] = useState(false)

  const connectWithToken = async () => {
    setConnectError(null)
    setTokenBusy(true)
    setClientId(clientIdInput)
    updateConfig({ musicService: 'spotify' })
    try {
      await connectSpotifyWithRefreshToken(refreshInput)
      setRefreshInput('')
      setManualOpen(false)
      refreshUser()
    } catch (err) {
      setConnectError(err.message)
    } finally {
      setTokenBusy(false)
    }
  }

  const startManual = async () => {
    setConnectError(null)
    setClientId(clientIdInput)
    updateConfig({ musicService: 'spotify' })
    try {
      setAuthorizeUrl(await getSpotifyAuthorizeUrl())
      setManualOpen(true)
    } catch (err) {
      setConnectError(err.message)
    }
  }

  const finishManual = async () => {
    setConnectError(null)
    setManualBusy(true)
    try {
      await connectSpotifyWithPastedUrl(pastedUrl)
      setPastedUrl('')
      setManualOpen(false)
      refreshUser()
    } catch (err) {
      setConnectError(err.message)
    } finally {
      setManualBusy(false)
    }
  }

  const openDashboard = () => {
    openExternalViaHost('https://developer.spotify.com/dashboard').catch(() =>
      window.open('https://developer.spotify.com/dashboard', '_blank', 'noopener'),
    )
  }

  const copyRedirect = async () => {
    const value = hostMode ? redirectUri : getRedirectUri()
    try {
      await copyText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setConnectError('Panoya kopyalanamadı — adresi elle seçip kopyalayın.')
    }
  }

  const connectSpotify = async () => {
    setConnectError(null)
    setClientId(clientIdInput)
    // Bağlanılan servisi aktif kaynak yap — aksi halde bağlantı kuruluyor ama
    // widget hâlâ diğer servisi dinlediği için "bağlandı ama çalışmıyor" olur.
    updateConfig({ musicService: 'spotify' })
    try {
      await redirectToSpotifyAuthorize()
      if (hostMode) refreshUser()
    } catch (err) {
      setConnectError(err.message)
    }
  }

  const connectYtmdService = async () => {
    updateConfig({ musicService: 'youtube-music' })
    await ytmd.connect()
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Studio içinde başlık sekme adında: marka başlığı tekrarlanmaz */}
      {!gomuluMu() && <h1 className="text-3xl font-bold text-white">{t('connectionsPage.title')}</h1>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <SpotifyIcon />
            <h3 className="text-lg font-semibold text-white">{t('connectionsPage.spotifyTitle')}</h3>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('login.subtitle')}</p>

          {isAuthenticated ? (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-white">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {t('connectionsPage.spotifyConnectedAs').replace('{name}', user?.display_name || '')}
              </span>
              <Button variant="outline" onClick={logout}>
                {t('connectionsPage.disconnect')}
              </Button>
            </div>
          ) : null}
          {isAuthenticated && (
            // Bağlıyken de erişilebilir olsun: yeniden bağlanırken veya
            // redirect adresini kontrol ederken lazım oluyor.
            <SetupGuide title="Kurulum adımlarını göster (resimli)" steps={SPOTIFY_STEPS(redirectUri)} />
          )}
          {!isAuthenticated && (
            <>
              <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <p className="text-xs font-semibold text-white">Kendi Spotify uygulaman gerekli</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-[var(--color-text-muted)]">
                  <li>
                    Spotify Developer Dashboard&apos;da <b>Create app</b> ile bir uygulama aç.
                  </li>
                  <li>
                    Aşağıdaki <b>Redirect URI</b>&apos;yi ekle, <b>Add</b> ve sonra <b>Save</b>&apos;e bas.
                  </li>
                  <li>Uygulamanın <b>Client ID</b>&apos;sini kopyalayıp aşağıya yapıştır.</li>
                </ol>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Client ID başkasının uygulamasına aitse redirect adresini ekleyemezsin ve
                  Spotify hep &quot;Not matching configuration&quot; der.
                </p>
                <button
                  type="button"
                  onClick={openDashboard}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                >
                  Dashboard&apos;ı aç <ExternalLink className="h-3 w-3" />
                </button>
                <SetupGuide
                  title="Adım adım göster (resimli)"
                  steps={SPOTIFY_STEPS(redirectUri)}
                  defaultOpen={!clientIdInput.trim()}
                />
              </div>

              <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Client ID
              </p>
              <input
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="Spotify Client ID"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]"
              />
              <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Redirect URI
              </p>
              {hostMode ? (
                <>
                  <input
                    value={redirectUri}
                    onChange={(e) => {
                      setRedirectUri(e.target.value)
                      setBrokerRedirectUri(e.target.value)
                    }}
                    placeholder={BROKER_REDIRECT_URIS[0]}
                    className={`w-full rounded-xl border bg-[var(--color-surface-2)] px-4 py-3 text-sm text-white outline-none ${
                      isValidBrokerRedirect(redirectUri)
                        ? 'border-[var(--color-border)] focus:border-[var(--color-accent)]'
                        : 'border-red-400/70'
                    }`}
                  />
                  {!isValidBrokerRedirect(redirectUri) && (
                    <p className="mt-1 text-xs text-red-300">
                      Bu adres desteklenmiyor — aşağıdaki seçeneklerden birini kullanın.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {BROKER_REDIRECT_URIS.map((uri) => (
                      <button
                        key={uri}
                        type="button"
                        onClick={() => {
                          setRedirectUri(uri)
                          setBrokerRedirectUri(uri)
                        }}
                        className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-muted)] hover:text-white"
                      >
                        {uri.replace(hostBase, '') || '/'}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <code className="block break-all rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-xs text-[var(--color-text)]">
                  {getRedirectUri()}
                </code>
              )}
              <button
                type="button"
                onClick={copyRedirect}
                className="mt-2 text-xs font-semibold text-[var(--color-accent)] hover:underline"
              >
                {copied ? 'Kopyalandı ✓' : 'Adresi kopyala'}
              </button>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Bu adresin <b>birebir aynısı</b> Spotify Dashboard &gt; Settings &gt; Redirect URIs
                listesinde kayıtlı olmalı, sonra <b>Save</b>. Kayıtlı değilse giriş sonrası
                &quot;redirect_uri: Not matching configuration&quot; hatası alırsınız. Sunucu bu
                adresin herhangi bir yolunu karşılar — Dashboard&apos;da ne kayıtlıysa onu yazın.
              </p>
              <button
                type="button"
                onClick={openDashboard}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
              >
                Spotify Dashboard&apos;ı aç <ExternalLink className="h-3 w-3" />
              </button>
              {hostMode && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Onay ekranı sistem tarayıcınızda açılır; onayladıktan sonra bu sayfa kendiliğinden
                  güncellenir.
                </p>
              )}
              <div className="mt-3 rounded-xl border border-[var(--color-border)] p-3">
                <button
                  type="button"
                  onClick={() => (manualOpen ? setManualOpen(false) : startManual())}
                  className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                >
                  {manualOpen ? 'Elle bağlanmayı kapat' : 'Tarayıcı açılmıyor mu? Elle bağlan'}
                </button>
                {manualOpen && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      1. Aşağıdaki adresi kopyalayıp tarayıcıda aç, Spotify onayını ver.
                    </p>
                    <textarea
                      readOnly
                      value={authorizeUrl}
                      rows={3}
                      onFocus={(e) => e.target.select()}
                      className="w-full break-all rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[11px] text-[var(--color-text)] outline-none"
                    />
                    <p className="text-xs text-[var(--color-text-muted)]">
                      2. Onaydan sonra tarayıcının adres çubuğundaki linki buraya yapıştır.
                      (Uygulama açıksa bağlantı kendiliğinden tamamlanır; olmazsa bu yol çalışır.)
                    </p>
                    <input
                      value={pastedUrl}
                      onChange={(e) => setPastedUrl(e.target.value)}
                      placeholder="http://127.0.0.1:8843/resonance/callback?code=..."
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-accent)]"
                    />
                    <Button onClick={finishManual} disabled={manualBusy || !pastedUrl.trim()}>
                      {manualBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bağlantıyı tamamla'}
                    </Button>

                    <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Elinde hazır bir <b>refresh token</b> varsa onay adımına hiç girmeden
                        bağlanabilirsin. Redirect adresi gerekmez. (Token bu Client ID ile
                        alınmış olmalı.)
                      </p>
                      <input
                        value={refreshInput}
                        onChange={(e) => setRefreshInput(e.target.value)}
                        placeholder="Spotify refresh token"
                        className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-accent)]"
                      />
                      <Button
                        className="mt-2"
                        onClick={connectWithToken}
                        disabled={tokenBusy || !refreshInput.trim() || !clientIdInput.trim()}
                      >
                        {tokenBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Token ile bağlan'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {!clientIdInput.trim() && (
                <p className="mt-2 text-xs text-amber-300">
                  Önce kendi uygulamanın Client ID&apos;sini gir.
                </p>
              )}
              {connectError && <p className="mt-2 text-xs text-red-300">{connectError}</p>}
              {/* Sunucunun kaydettiği son durum/hata — onay tarayıcıda
                  verildiği için hata mesajı aksi halde kaybolup gidiyordu. */}
              {!connectError && hostStatus?.note && (
                <p className="mt-2 break-words text-xs text-amber-300">{hostStatus.note}</p>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  as="a"
                  href="https://developer.spotify.com/dashboard"
                  target="_blank"
                  variant="outline"
                  className="flex-1"
                >
                  Guide <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  className="flex-1 !bg-[#1db954] hover:!bg-[#1ed760]"
                  disabled={!clientIdInput.trim()}
                  onClick={connectSpotify}
                >
                  {t('connectionsPage.connect')}
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-white">{t('connectionsPage.ytmdTitle')}</h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('pulse.ytmdNotConnected')}</p>

          {ytmd.connected ? (
            <>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-white">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {t('pulse.ytmdConnected')}
                </span>
                <Button variant="outline" onClick={ytmd.disconnect}>
                  {t('connectionsPage.disconnect')}
                </Button>
              </div>
              <YtmdStream ytmd={ytmd} />
            </>
          ) : (
            <>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  disabled={ytmd.status === 'requesting' || ytmd.status === 'waiting-approval'}
                  onClick={connectYtmdService}
                >
                  {(ytmd.status === 'requesting' || ytmd.status === 'waiting-approval') && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {ytmd.status === 'waiting-approval' ? t('pulse.ytmdWaitingApproval') : t('connectionsPage.connect')}
                </Button>
              </div>
              {ytmd.error && <p className="mt-2 text-xs text-red-300">{ytmd.error}</p>}
              <SetupGuide
                title="Adım adım göster (resimli)"
                steps={YTMD_STEPS}
                defaultOpen={Boolean(ytmd.error)}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
