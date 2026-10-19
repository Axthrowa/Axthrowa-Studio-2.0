import { Card } from '../components/ui/Card'
import { useLanguage } from '../context/LanguageContext'

const ENTRIES = {
  en: [
    {
      date: 'September 1, 2026',
      title: 'YouTube Music, Turkish, and unlocked everything',
      sections: [
        {
          heading: '🚀 New',
          items: [
            'YouTube Music Desktop support via its Companion Server, with real-time updates over WebSocket.',
            'Bring-your-own Spotify Client ID — link your own Spotify app from Connections > Music instead of sharing one app-wide.',
            'Full Turkish translation, switchable from the top bar.',
            'Local profile: a display name greets you without needing Spotify.',
            'Every feature unlocked — no Pro paywall.',
          ],
        },
        {
          heading: '⚠️ Known Issues',
          items: [
            "Spotify Free: due to Spotify's current Development Mode policy, linking a Spotify app requires the account that owns the app's Client ID to have an active Premium subscription. This affects every app in this situation, not just Resonance.",
            'YouTube Music Desktop requires re-enabling "Authorization requests" in its settings each time you connect a new session.',
          ],
        },
      ],
    },
  ],
  tr: [
    {
      date: '1 Eylül 2026',
      title: 'YouTube Music, Türkçe ve kısıtlamasız erişim',
      sections: [
        {
          heading: '🚀 Yenilikler',
          items: [
            "YouTube Music Desktop desteği — Companion Server üzerinden, WebSocket ile gerçek zamanlı güncelleme.",
            "Kendi Spotify Client ID'ni kullan — Connections > Music sayfasından kendi Spotify uygulamanı bağlayabilirsin, artık paylaşılan tek bir uygulamaya bağımlı değilsin.",
            'Tam Türkçe çeviri, üst bardan İngilizce ile değiştirilebilir.',
            'Yerel profil: Spotify olmadan da seni adınla karşılayan bir profil.',
            'Tüm özellikler açık — Pro ödeme duvarı yok.',
          ],
        },
        {
          heading: '⚠️ Bilinen Sorunlar',
          items: [
            "Spotify Free: Spotify'ın güncel Development Mode politikası gereği, bir Spotify uygulamasını bağlamak için o uygulamanın Client ID'sinin sahibi olan hesabın aktif Premium aboneliği olması gerekiyor. Bu sadece Resonance'a özgü değil, aynı durumdaki her uygulamayı etkiliyor.",
            'YouTube Music Desktop, her yeni oturumda bağlanmadan önce ayarlarındaki "Authorization requests"in yeniden açılmasını istiyor.',
          ],
        },
      ],
    },
  ],
}

export default function WhatsNew() {
  const { t, language } = useLanguage()
  const entries = ENTRIES[language] || ENTRIES.en

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-white">{t('sidebar.whatsNew')}</h1>

      {entries.map((entry) => (
        <Card key={entry.date} className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {entry.date}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">{entry.title}</h2>
          {entry.sections.map((section) => (
            <div key={section.heading} className="mt-4">
              <h3 className="font-medium text-white">{section.heading}</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--color-text-muted)]">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      ))}
    </div>
  )
}
