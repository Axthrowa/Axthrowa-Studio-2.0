import { Link } from 'react-router-dom'
import { Clock, Music } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, CardTitle, CardSubtitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useListeningStats } from '../hooks/useListeningStats'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../context/ProfileContext'
import { useLanguage } from '../context/LanguageContext'

const tooltipStyle = {
  background: '#0f1015',
  border: '1px solid #212227',
  borderRadius: 8,
  color: '#cbccd2',
  fontSize: 12,
}

export default function Home() {
  const { user, isAuthenticated } = useAuth()
  const { username } = useProfile()
  const { t } = useLanguage()
  const { totalMinutes, totalSongs, byDay, loading } = useListeningStats()
  const greetingName = user?.display_name || username

  const chartData = byDay.map((d) => ({ ...d, label: t(`days.${d.dayKey}`) }))

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold text-white">
        {t('home.title')}
        {greetingName ? `, ${greetingName}` : ''}
      </h1>

      {!isAuthenticated && (
        <Card className="mt-8">
          <CardTitle>{t('home.connectTitle')}</CardTitle>
          <CardSubtitle className="mt-1">{t('home.connectBody')}</CardSubtitle>
          <Button as={Link} to="/login" variant="default" className="mt-4 w-fit !bg-[#1db954] hover:!bg-[#1ed760]">
            {t('home.connectButton')}
          </Button>
        </Card>
      )}

      {isAuthenticated && (
        <>
          <h2 className="mb-4 mt-8 text-xl font-semibold text-white">{t('home.statistics')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <div className="flex items-start justify-between">
                <CardSubtitle>{t('home.totalMinutes')}</CardSubtitle>
                <Clock className="h-5 w-5 text-[var(--color-text-muted)]" />
              </div>
              <p className="mt-3 text-3xl font-bold text-white">
                {loading ? '—' : totalMinutes.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('home.basedOnLast50')}</p>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <CardSubtitle>{t('home.totalSongs')}</CardSubtitle>
                <Music className="h-5 w-5 text-[var(--color-text-muted)]" />
              </div>
              <p className="mt-3 text-3xl font-bold text-white">{loading ? '—' : totalSongs}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('home.basedOnLast50')}</p>
            </Card>
          </div>

          <Card className="mt-6">
            <CardTitle>{t('home.listeningTime')}</CardTitle>
            <CardSubtitle>{t('home.minutesPerDay')}</CardSubtitle>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#212227" vertical={false} />
                  <XAxis dataKey="label" stroke="#8b8d98" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8b8d98" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="minutes"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#8b5cf6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="mt-6">
            <CardTitle>{t('home.songsPlayed')}</CardTitle>
            <CardSubtitle>{t('home.songsPerDay')}</CardSubtitle>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#212227" vertical={false} />
                  <XAxis dataKey="label" stroke="#8b8d98" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8b8d98" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="songs" fill="#06e0e0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
