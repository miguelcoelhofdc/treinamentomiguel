import { db, getSetting, saveDailyLog } from '@/db'
import plan from '@/data/activePlan'
import { journeyStats } from '@/lib/journey'
import { isDateKey, localDateKey } from '@/lib/date'
import type { DailyLog } from '@/types'

// Only an explicit action made today can trigger a celebration; imports never do.
export async function saveDailyActivity(log: DailyLog) {
  const today = localDateKey()
  if (log.date !== today || (!log.checkInDone && !log.workoutDone)) return saveDailyLog(log)
  const storedStartDate = await getSetting('startDate')
  const startDate = storedStartDate && isDateKey(storedStartDate) ? storedStartDate : plan.profile.startDate
  const before = journeyStats(await db.dailyLogs.toArray(), plan, startDate, today)
  await saveDailyLog(log)
  const after = journeyStats(await db.dailyLogs.toArray(), plan, startDate, today)
  const unlocked = after.unlocked.filter(id => !before.unlocked.includes(id))
  if (unlocked.length) window.dispatchEvent(new CustomEvent('training-achievement', { detail: unlocked }))
}
