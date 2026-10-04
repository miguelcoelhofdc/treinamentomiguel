import { useEffect, useState } from 'react'
import { localDateKey } from '@/lib/date'

export function useLocalDay() {
  const [date, setDate] = useState(localDateKey)
  useEffect(() => {
    let timer: number
    const refresh = () => {
      window.clearTimeout(timer)
      setDate(localDateKey())
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = window.setTimeout(refresh, midnight.getTime() - now.getTime() + 100)
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return date
}
