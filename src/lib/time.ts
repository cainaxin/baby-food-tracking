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

export function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString()
}
