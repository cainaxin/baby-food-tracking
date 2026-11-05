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

/** 解析 YYYY-MM-DD 为本地年月日，兼容无前导零格式 */
function parseDateParts(dateStr: string): { y: number; m: number; d: number } | null {
  const m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return { y: +m[1], m: +m[2] - 1, d: +m[3] }
}

/** 从生日算月龄，如 "3 个月"、"1 岁 2 个月" */
export function formatMonthAge(birthDate: string | null | undefined): string {
  if (!birthDate) return ''
  const b = parseDateParts(birthDate)
  if (!b) return ''
  const now = new Date()
  let months = (now.getFullYear() - b.y) * 12 + (now.getMonth() - b.m)
  if (now.getDate() < b.d) months--
  if (months < 0) return ''
  if (months < 12) return `${months} 个月`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m ? `${y} 岁 ${m} 个月` : `${y} 岁`
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
 * 事件在某本地日内的分钟数（按重叠区间拆分）。
 * 未填结束时间的区间事件算到「当前时刻」，历史日会自然截断；
 * 同时单次上限 maxHours 小时，避免忘填结束导致历史虚高。
 */
export function spanMinutesOnDay(
  startAt: string,
  endAt: string | null | undefined,
  dayKey: string,
  maxHours = 18,
  now: number = Date.now(),
): number {
  const start = new Date(startAt).getTime()
  let end = endAt ? new Date(endAt).getTime() : now
  if (!endAt) end = Math.min(end, start + maxHours * 3600000)
  const dayStart = startOfLocalDay(dayKey).getTime()
  const dayEnd = endOfLocalDay(dayKey).getTime()
  const overlap = Math.min(end, dayEnd) - Math.max(start, dayStart)
  return Math.max(0, Math.round(overlap / 60000))
}

/** 睡眠在某本地日内的分钟数 */
export function sleepMinutesOnDay(
  startAt: string,
  endAt: string | null | undefined,
  dayKey: string,
  now: number = Date.now(),
): number {
  return spanMinutesOnDay(startAt, endAt, dayKey, 18, now)
}

/** 外出在某本地日内的分钟数（外出不跨天：只算开始那天，且不超过当天 24 点） */
export function outingMinutesOnDay(
  startAt: string,
  endAt: string | null | undefined,
  dayKey: string,
  now: number = Date.now(),
): number {
  const start = new Date(startAt).getTime()
  // 只算「开始那天」：其他日子一律 0
  if (todayKey(new Date(start)) !== dayKey) return 0
  const end = endAt ? new Date(endAt).getTime() : now
  // 外出不跨天：截断到当天 24:00
  const cap = endOfLocalDay(dayKey).getTime()
  const dayStart = startOfLocalDay(dayKey).getTime()
  const overlap = Math.min(end, cap) - Math.max(start, dayStart)
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
