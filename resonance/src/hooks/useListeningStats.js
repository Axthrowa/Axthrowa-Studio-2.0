import { getRecentlyPlayed } from '../lib/spotifyApi'
import { getRecentlyPlayedViaHost, isHostAvailable } from '../lib/hostBridge'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function emptyWeek() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ key: d.toDateString(), dayKey: DAY_KEYS[d.getDay()], minutes: 0, songs: 0 })
  }
  return days
}

export function useListeningStats() {
  const { isAuthenticated } = useAuth()
  const [stats, setStats] = useState({
    totalMinutes: 0,
    totalSongs: 0,
    byDay: emptyWeek(),
    loading: true,
  })

  useEffect(() => {
    if (!isAuthenticated) {
      setStats((prev) => ({ ...prev, loading: false }))
      return
    }

    let cancelled = false

    async function load() {
      try {
        let data = null
        if (await isHostAvailable()) {
          try {
            data = await getRecentlyPlayedViaHost(50)
          } catch {
            data = null
          }
        }
        if (!data) {
          data = await getRecentlyPlayed(50)
        }
        if (cancelled) return
        if (!Array.isArray(data?.items)) {
          setStats((prev) => ({ ...prev, loading: false }))
          return
        }

        const week = emptyWeek()
        const dayIndex = new Map(week.map((d, i) => [d.key, i]))
        let totalMs = 0

        for (const item of data.items) {
          const duration = Number(item?.track?.duration_ms) || 0
          const playedAt = item?.played_at ? new Date(item.played_at) : null
          totalMs += duration
          if (playedAt && !Number.isNaN(playedAt.getTime())) {
            const key = playedAt.toDateString()
            if (dayIndex.has(key)) {
              const i = dayIndex.get(key)
              week[i].minutes += duration / 60000
              week[i].songs += 1
            }
          }
        }

        setStats({
          totalMinutes: Math.round(totalMs / 60000),
          totalSongs: data.items.length,
          byDay: week.map((d) => ({ ...d, minutes: Math.round(d.minutes) })),
          loading: false,
        })
      } catch {
        if (!cancelled) setStats((prev) => ({ ...prev, loading: false }))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  return stats
}
