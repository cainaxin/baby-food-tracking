export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDateTime(iso: string): string {
  return `${todayKey(new Date(iso))} ${formatTime(iso)}`
}

export function formatDuration(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const mins = Math.max(0, Math.round((end - start) / 60000))
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export function formatDayLabel(key: string): string {
  const today = todayKey()
  const yesterday = todayKey(new Date(Date.now() - 86400000))
  if (key === today) return '今天'
  if (key === yesterday) return '昨天'
  const [, m, d] = key.split('-')
  return `${Number(m)} 月 ${Number(d)} 日`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** 本地日 00:00 的 Date */
export function startOfLocalDay(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00`)
}

/** 本地日次日 00:00 的 Date */
export function endOfLocalDay(dayKey: string): Date {
  const d = startOfLocalDay(dayKey)
  d.setDate(d.getDate() + 1)
  return d
}

/** 事件是否与某本地日有重叠（跨夜睡眠两边都会出现） */
export function eventOverlapsDay(
  startAt: string,
  endAt: string | null | undefined,
  dayKey: string,
  options?: { openEndedIsOngoing?: boolean },
  now: number = Date.now(),
): boolean {
  const start = new Date(startAt).getTime()
  // 无 endAt：区间事件（睡觉等）算持续到现在；点状事件只算开始那天
  const end = endAt
    ? new Date(endAt).getTime()
    : options?.openEndedIsOngoing
      ? now
      : start
  const dayStart = startOfLocalDay(dayKey).getTime()
  const dayEnd = endOfLocalDay(dayKey).getTime()
  return start < dayEnd && end >= dayStart
}

/**
 * 事件在某本地日内的睡眠分钟数（按重叠区间拆分）。
 * 未填结束时间的睡眠算到「当前时刻」，历史日会自然截断；
 * 同时单次上限 18 小时，避免忘填结束导致历史虚高。
 */
export function sleepMinutesOnDay(
  startAt: string,
  endAt: string | null | undefined,
  dayKey: string,
  now: number = Date.now(),
): number {
  const start = new Date(startAt).getTime()
  let end = endAt ? new Date(endAt).getTime() : now
  if (!endAt) end = Math.min(end, start + 18 * 3600000)
  const dayStart = startOfLocalDay(dayKey).getTime()
  const dayEnd = endOfLocalDay(dayKey).getTime()
  const overlap = Math.min(end, dayEnd) - Math.max(start, dayStart)
  return Math.max(0, Math.round(overlap / 60000))
}

export function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString()
}
