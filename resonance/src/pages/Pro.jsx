import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { useLanguage } from '../context/LanguageContext'

export default function Pro() {
  const { t } = useLanguage()
  const [openFaq, setOpenFaq] = useState(null)
  const features = t('pro.features')
  const faq = t('pro.faq')

  return (
    <div className="mx-auto max-w-3xl">
      <div className="waveform-backdrop relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[color-mix(in_srgb,var(--color-accent-2)_22%,var(--color-surface))] via-[var(--color-surface)] to-[var(--color-surface)] p-10 text-center">
        <Sparkles className="relative mx-auto mb-4 h-8 w-8 text-[var(--color-accent)]" />
        <h1 className="text-4xl font-extrabold text-white">
          {t('pro.title')} <span className="gradient-text">{t('pro.titleAccent')}</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-text-muted)]">{t('pro.subtitle')}</p>
        <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 px-4 py-2 text-sm font-medium text-white">
          <Check className="h-4 w-4 text-[var(--color-accent)]" />
          {t('pro.badge')}
        </div>
      </div>

      <Card className="mt-6">
        <h3 className="text-lg font-semibold text-white">{t('pro.featuresTitle')}</h3>
        <ul className="mt-4 space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <Check className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              {f}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6">
        <h3 className="text-lg font-semibold text-white">{t('pro.faqTitle')}</h3>
        <div className="mt-3 divide-y divide-[var(--color-border)]">
          {faq.map((item, i) => (
            <div key={item.q} className="py-3">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between text-left text-sm font-medium text-white"
              >
                {item.q}
                <span className="text-[var(--color-text-muted)]">{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
