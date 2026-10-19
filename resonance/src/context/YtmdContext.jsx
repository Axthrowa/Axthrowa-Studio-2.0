import { createContext, useCallback, useContext, useState } from 'react'
import {
  connectYtmd,
  getYtmdToken,
  clearYtmdToken,
  getYtmdHost,
  getYtmdPort,
  setYtmdConnection,
} from '../lib/ytmdAuth'
import { isHostAvailable, notifyHostChanged, putYtmdSession } from '../lib/hostBridge'

const YtmdContext = createContext(null)

export function YtmdProvider({ children }) {
  const [connected, setConnected] = useState(() => Boolean(getYtmdToken()))
  const [status, setStatus] = useState('idle') // idle | requesting | waiting-approval | error
  const [error, setError] = useState(null)
  // Eşleşme token'ı olması "veri akıyor" demek değil: gerçek durum
  // Socket.IO bağlantısından gelir. İkisini ayrı izlemezsek kullanıcı
  // "bağlı ama çalmıyor" ekranıyla baş başa kalıyor.
  const [socketState, setSocketState] = useState('idle') // idle | connecting | live | error
  const [socketError, setSocketError] = useState(null)
  const [lastUpdateAt, setLastUpdateAt] = useState(0)

  const reportSocket = useCallback((next, err = null) => {
    setSocketState(next)
    setSocketError(err)
    if (next === 'live') setLastUpdateAt(Date.now())
  }, [])

  const connect = async (host = getYtmdHost(), port = getYtmdPort()) => {
    setYtmdConnection(host, port)
    setError(null)
    setStatus('requesting')
    try {
      setStatus('waiting-approval')
      const token = await connectYtmd()
      setConnected(true)
      setStatus('idle')
      // Token'ı host'a da bırak: panel kontrol çubuğu ve overlay'ler
      // Resonance sekmesi açık olmasa da komut gönderebilsin.
      if (await isHostAvailable()) {
        await putYtmdSession({ host, port, token }).catch(() => {})
        notifyHostChanged('ytmd')
      }
    } catch (err) {
      setError(err.message)
      setStatus('error')
      setConnected(false)
    }
  }

  const disconnect = async () => {
    clearYtmdToken()
    setConnected(false)
    setStatus('idle')
    setError(null)
    reportSocket('idle')
    if (await isHostAvailable()) {
      await putYtmdSession({ host: getYtmdHost(), port: getYtmdPort(), token: '' }).catch(() => {})
      notifyHostChanged('ytmd')
    }
  }

  return (
    <YtmdContext.Provider
      value={{
        connected,
        status,
        error,
        socketState,
        socketError,
        lastUpdateAt,
        reportSocket,
        connect,
        disconnect,
        host: getYtmdHost(),
        port: getYtmdPort(),
      }}
    >
      {children}
    </YtmdContext.Provider>
  )
}

export function useYtmd() {
  const ctx = useContext(YtmdContext)
  if (!ctx) throw new Error('useYtmd must be used within YtmdProvider')
  return ctx
}
