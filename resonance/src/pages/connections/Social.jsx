import { MessageCircle } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { useLanguage } from '../../context/LanguageContext'

export default function SocialConnections() {
  const { t } = useLanguage()

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-white">{t('sidebar.social')}</h1>

      <Card className="mt-6">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-[#5865f2]" />
          <h3 className="text-lg font-semibold text-white">Discord</h3>
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('social.body')}</p>
      </Card>
    </div>
  )
}
