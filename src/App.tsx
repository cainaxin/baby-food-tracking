import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Baby, BabyEvent, EventType } from './types'
import {
  DIAPER_TAGS,
  EVENT_META,
  MILK_KINDS,
  QUICK_TYPES,
} from './types'
import { loadSolidTypes, saveSolidTypes } from './lib/solidTypes'
import {
  addBaby,
  deleteBaby,
  deleteEvent,
  ensureFamily,
  isCloudConfigured,
  joinFamilyByInvite,
  loadData,
  saveEvent,
  signIn,
  signOut,
  signUp,
  subscribeFamily,
  updateBaby,
  updateDisplayName,
  type AppData,
  type SessionUser,
} from './lib/backend'
import {
  formatTime,
  formatDuration,
  formatDayLabel,
  nowIso,
  todayKey,
  toLocalInputValue,
  fromLocalInputValue,
} from './lib/time'

type Tab = 'home' | 'history' | 'settings'
type Sheet =
  | { kind: 'event'; type: EventType; editId?: string }
  | { kind: 'baby'; babyId?: string }
  | { kind: 'switch' }
  | { kind: 'join' }
  | null

function Avatar({
  baby,
  size = 'md',
}: {
  baby: Pick<Baby, 'name' | 'avatarColor' | 'avatarUrl'>
  size?: 'md' | 'lg'
}) {
  return (
    <div
      className={`avatar${size === 'lg' ? ' avatar-lg' : ''}`}
      style={{ background: baby.avatarColor }}
      aria-hidden
    >
      {baby.avatarUrl ? <img src={baby.avatarUrl} alt="" /> : baby.name.slice(0, 1)}
    </div>
  )
}

function eventSubtitle(ev: BabyEvent): string {
  const parts: string[] = []
  if ((ev.type === 'milk' || ev.type === 'water') && ev.amountMl != null) {
    parts.push(`${ev.amountMl} ml`)
  }
  if (ev.type === 'milk' && ev.endAt) {
    parts.push(`${formatTime(ev.startAt)} – ${formatTime(ev.endAt)}`)
    parts.push(formatDuration(ev.startAt, ev.endAt))
  }
  if (ev.type === 'sleep' && ev.endAt) {
    parts.push(`${formatTime(ev.startAt)} – ${formatTime(ev.endAt)}`)
    parts.push(formatDuration(ev.startAt, ev.endAt))
  } else if (ev.type === 'sleep') {
    parts.push(`从 ${formatTime(ev.startAt)} 起 · ${formatDuration(ev.startAt)}`)
  } else if (ev.type === 'outing' && ev.endAt) {
    parts.push(`${formatTime(ev.startAt)} – ${formatTime(ev.endAt)}`)
  }
  if (ev.note) parts.push(ev.note)
  if (ev.createdBy) parts.push(ev.createdBy)
  return parts.join(' · ') || formatTime(ev.startAt)
}

function ElapsedHint({ label, from }: { label: string; from: string | null }) {
  if (!from) return null
  return (
    <div className="elapsed-hint">{`${label} ${formatDuration(from)}`}</div>
  )
}

function sleepMinutes(ev: BabyEvent): number {
  const start = new Date(ev.startAt).getTime()
  const end = ev.endAt ? new Date(ev.endAt).getTime() : Date.now()
  return Math.max(0, Math.round((end - start) / 60000))
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return '0 分钟'
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

function dayStats(events: BabyEvent[]) {
  const milkMl = events
    .filter((e) => e.type === 'milk')
    .reduce((s, e) => s + (e.amountMl ?? 0), 0)
  const waterMl = events
    .filter((e) => e.type === 'water')
    .reduce((s, e) => s + (e.amountMl ?? 0), 0)
  const sleepMin = events
    .filter((e) => e.type === 'sleep')
    .reduce((s, e) => s + sleepMinutes(e), 0)
  return {
    milkMl,
    waterMl,
    sleepMin,
    diaper: events.filter((e) => e.type === 'diaper').length,
    solid: events.filter((e) => e.type === 'solid').length,
    outing: events.filter((e) => e.type === 'outing').length,
  }
}

type TrendMetric = 'milk' | 'sleep' | 'diaper' | 'water'

const TREND_METRICS: { key: TrendMetric; label: string; unit: string }[] = [
  { key: 'milk', label: '奶量', unit: 'ml' },
  { key: 'sleep', label: '睡眠', unit: '分钟' },
  { key: 'diaper', label: '换尿布', unit: '次' },
  { key: 'water', label: '喝水', unit: 'ml' },
]

function DayStats({ events }: { events: BabyEvent[] }) {
  const s = dayStats(events)
  return (
    <div className="summary-grid">
      <div className="summary-tile">
        <div className="label">奶量</div>
        <div className="value">{s.milkMl} ml</div>
      </div>
      <div className="summary-tile">
        <div className="label">睡眠</div>
        <div className="value" style={{ fontSize: 18 }}>
          {formatMinutes(s.sleepMin)}
        </div>
      </div>
      <div className="summary-tile">
        <div className="label">换尿布</div>
        <div className="value">{s.diaper} 次</div>
      </div>
      <div className="summary-tile">
        <div className="label">喝水</div>
        <div className="value">{s.waterMl} ml</div>
      </div>
      <div className="summary-tile">
        <div className="label">辅食</div>
        <div className="value">{s.solid} 次</div>
      </div>
      <div className="summary-tile">
        <div className="label">外出</div>
        <div className="value">{s.outing} 次</div>
      </div>
    </div>
  )
}

function TrendChart({
  events,
  endDate,
  selectedDay,
  range,
  metric,
  onPickDay,
}: {
  events: BabyEvent[]
  endDate: string
  selectedDay: string
  range: 7 | 30
  metric: TrendMetric
  onPickDay?: (day: string) => void
}) {
  const days: { key: string; label: string; value: number }[] = []
  const end = new Date(`${endDate}T12:00:00`)
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    const key = todayKey(d)
    const dayEvents = events.filter((e) => todayKey(new Date(e.startAt)) === key)
    let value = 0
    if (metric === 'milk') {
      value = dayEvents
        .filter((e) => e.type === 'milk')
        .reduce((s, e) => s + (e.amountMl ?? 0), 0)
    } else if (metric === 'water') {
      value = dayEvents
        .filter((e) => e.type === 'water')
        .reduce((s, e) => s + (e.amountMl ?? 0), 0)
    } else if (metric === 'sleep') {
      value = dayEvents
        .filter((e) => e.type === 'sleep')
        .reduce((s, e) => s + sleepMinutes(e), 0)
    } else {
      value = dayEvents.filter((e) => e.type === 'diaper').length
    }
    days.push({
      key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      value,
    })
  }

  const values = days.map((d) => d.value)
  const max = Math.max(1, ...values)
  const min = Math.min(...values)
  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  const meta = TREND_METRICS.find((m) => m.key === metric)
  const picked = days.findIndex((d) => d.key === selectedDay)

  const W = 340
  const H = 168
  const padL = 8
  const padR = 8
  const padT = 22
  const padB = 24
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const gap = range === 7 ? 12 : 4
  const barW = Math.max(4, (innerW - gap * (days.length - 1)) / days.length)

  const fmt = (v: number) => {
    if (metric === 'sleep') return formatMinutes(v)
    return `${v} ${meta?.unit ?? ''}`
  }

  const pickedDay = picked >= 0 ? days[picked] : null

  return (
    <div className="trend-panel">
      <div className="trend-head">
        <div>
          <div className="trend-title">
            {pickedDay ? pickedDay.label : meta?.label}
          </div>
          <div className="trend-sub">
            {pickedDay ? '点柱子可切换日期' : `近 ${range} 天平均`}
          </div>
        </div>
        <div className="trend-hero">
          <strong>{pickedDay ? fmt(pickedDay.value) : fmt(avg)}</strong>
        </div>
      </div>

      <svg
        className="trend-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${meta?.label}趋势图`}
      >
        <line
          x1={padL}
          y1={padT + innerH}
          x2={W - padR}
          y2={padT + innerH}
          stroke="var(--separator)"
          strokeWidth="1"
        />
        {days.map((d, i) => {
          const h = d.value <= 0 ? 2 : Math.max(4, (d.value / max) * innerH)
          const x = padL + i * (barW + gap)
          const y = padT + innerH - h
          const isPicked = picked === i
          const showLabel =
            range === 7
              ? true
              : i === 0 || i === days.length - 1 || i === Math.floor(days.length / 2)
          const showValue = range === 7 || isPicked
          return (
            <g
              key={d.key}
              className="trend-bar-hit"
              onClick={() => onPickDay?.(d.key)}
            >
              <rect
                x={x - gap / 2}
                y={padT}
                width={barW + gap}
                height={innerH}
                fill="transparent"
              />
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={Math.min(4, barW / 2)}
                fill="var(--blue)"
                opacity={d.value > 0 ? (isPicked ? 1 : 0.35) : 0.18}
              />
              {showValue && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={range === 7 ? 10 : 11}
                  fontWeight="600"
                  fill={isPicked ? 'var(--blue)' : 'var(--ink-secondary)'}
                >
                  {metric === 'sleep' ? Math.round(d.value) : d.value}
                </text>
              )}
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isPicked ? 'var(--blue)' : 'var(--ink-tertiary)'}
                >
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="trend-stats">
        <div className="trend-stat">
          <div className="k">最高</div>
          <div className="v">{fmt(max)}</div>
        </div>
        <div className="trend-stat">
          <div className="k">平均</div>
          <div className="v">{fmt(avg)}</div>
        </div>
        <div className="trend-stat">
          <div className="k">最低</div>
          <div className="v">{fmt(min)}</div>
        </div>
      </div>
    </div>
  )
}

function SummaryTiles({ events }: { events: BabyEvent[] }) {
  const milkTotal = events
    .filter((e) => e.type === 'milk')
    .reduce((sum, e) => sum + (e.amountMl ?? 0), 0)
  const lastMilk = events.find((e) => e.type === 'milk')
  const lastSleep = events.find((e) => e.type === 'sleep')
  const wake = events.find((e) => e.type === 'wake')

  // 上次吃奶结束时刻（没填结束时间就用开始）
  const lastMilkAt = lastMilk ? (lastMilk.endAt ?? lastMilk.startAt) : null
  // 上次清醒时刻：起床事件，或上一觉睡醒
  const lastAwakeAt = wake?.startAt ?? lastSleep?.endAt ?? null

  return (
    <div className="summary-grid">
      <div className="summary-tile">
        <div className="label">今日奶量</div>
        <div className="value">{milkTotal} ml</div>
      </div>
      <div className="summary-tile">
        <div className="label">最近吃奶</div>
        <div className="value">
          {lastMilk
            ? `${formatTime(lastMilk.startAt)}${lastMilk.amountMl != null ? ` · ${lastMilk.amountMl}` : ''}`
            : '—'}
        </div>
        <ElapsedHint label="距上次" from={lastMilkAt} />
      </div>
      <div className="summary-tile">
        <div className="label">最近睡眠</div>
        <div className="value" style={{ fontSize: 18 }}>
          {lastSleep
            ? lastSleep.endAt
              ? `${formatTime(lastSleep.startAt)}–${formatTime(lastSleep.endAt)}`
              : `睡着中 · ${formatDuration(lastSleep.startAt)}`
            : '—'}
        </div>
        <ElapsedHint label="已清醒" from={lastAwakeAt} />
      </div>
      <div className="summary-tile">
        <div className="label">今日起床</div>
        <div className="value">{wake ? formatTime(wake.startAt) : '—'}</div>
      </div>
    </div>
  )
}

function AuthScreen({
  onReady,
}: {
  onReady: (user: SessionUser) => void
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'join'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [invite, setInvite] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { user, error: err } = await signIn(email.trim(), password)
        if (err || !user) {
          setError(err || '登录失败')
          return
        }
        // 后台手动建的账号可能还没有家庭：自动创建，而不是要求邀请码
        if (!user.familyId) {
          const { error: ensureErr } = await ensureFamily(name.trim() || user.displayName)
          if (ensureErr) {
            setError(ensureErr)
            return
          }
        }
        const data = await loadData()
        onReady(data.user!)
        return
      }
      if (mode === 'signup') {
        const { user, error: err } = await signUp(
          email.trim(),
          password,
          name.trim() || '家人',
        )
        if (err || !user) {
          setError(err || '注册失败')
          return
        }
        onReady(user)
        return
      }
      // join：加入已有家庭
      const { user, error: err } = await signIn(email.trim(), password)
      if (err || !user) {
        setError(err || '登录失败')
        return
      }
      const { error: joinErr } = await joinFamilyByInvite(invite, name.trim() || '家人')
      if (joinErr) {
        setError(joinErr)
        return
      }
      const data = await loadData()
      onReady(data.user!)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="page">
        <div style={{ textAlign: 'center', padding: '48px 12px 28px' }}>
          <div style={{ fontSize: 48 }}>👶</div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 28 }}>宝宝日记</h1>
          <p className="muted" style={{ margin: 0 }}>
            全家共用的作息记录
          </p>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            <button
              type="button"
              className={`chip${mode === 'login' ? ' active' : ''}`}
              onClick={() => setMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              className={`chip${mode === 'signup' ? ' active' : ''}`}
              onClick={() => setMode('signup')}
            >
              注册并建家庭
            </button>
            <button
              type="button"
              className={`chip${mode === 'join' ? ' active' : ''}`}
              onClick={() => setMode('join')}
            >
              加入家人家庭
            </button>
          </div>

          <div className="field">
            <label>邮箱</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例如：nana@example.com"
            />
          </div>
          <div className="field">
            <label>密码</label>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
            />
          </div>

          {(mode === 'signup' || mode === 'join') && (
            <div className="field">
              <label>我的称呼</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：妈妈、奶奶"
              />
            </div>
          )}

          {mode === 'join' && (
            <div className="field">
              <label>家庭邀请码</label>
              <input
                value={invite}
                onChange={(e) => setInvite(e.target.value.toUpperCase())}
                placeholder="向家人索取 6 位邀请码"
              />
            </div>
          )}

          {error && (
            <div className="danger-text small" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 18 }}
            disabled={loading || !email.trim() || password.length < 6}
            onClick={submit}
          >
            {loading ? '请稍候…' : mode === 'signup' ? '创建我的家庭' : mode === 'join' ? '加入家庭' : '登录'}
          </button>

          {!isCloudConfigured && (
            <div className="banner" style={{ marginTop: 14 }}>
              当前为本机演示模式（数据存在此设备）。配置 Supabase 后即可全家同步。
            </div>
          )}
        </div>

        <p className="muted small" style={{ textAlign: 'center', marginTop: 16 }}>
          注册后会得到邀请码，发给家人一起用
        </p>
      </div>
    </div>
  )
}

function EventSheet({
  type,
  edit,
  defaultBaby,
  profileName,
  onCancel,
  onSave,
  onDelete,
}: {
  type: EventType
  edit?: BabyEvent | null
  defaultBaby?: Baby | null
  profileName: string
  onCancel: () => void
  onSave: (payload: Partial<BabyEvent> & { type: EventType }) => void
  onDelete?: () => void
}) {
  const meta = EVENT_META[type]
  const [startAt, setStartAt] = useState(toLocalInputValue(edit?.startAt ?? nowIso()))
  const [endAt, setEndAt] = useState(edit?.endAt ? toLocalInputValue(edit.endAt) : '')
  const [amountMl, setAmountMl] = useState(
    edit?.amountMl ?? (type === 'water' ? 30 : 120),
  )
  const [note, setNote] = useState(edit?.note ?? '')
  const [solidTypes, setSolidTypes] = useState<string[]>(() => loadSolidTypes())
  const [solidSelected, setSolidSelected] = useState<string[]>(() => {
    const parts = (edit?.note ?? '')
      .split(/[、,，]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const presets = loadSolidTypes()
    return parts.filter((p) => presets.includes(p))
  })
  const [solidCustom, setSolidCustom] = useState(() => {
    const parts = (edit?.note ?? '')
      .split(/[、,，]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const presets = loadSolidTypes()
    return parts.filter((p) => !presets.includes(p)).join('、')
  })
  const [editingSolidTypes, setEditingSolidTypes] = useState(false)
  const [newSolidType, setNewSolidType] = useState('')

  const bathPresets = [
    { label: '洗澡', value: '洗澡' },
    { label: '游泳', value: '游泳' },
  ]
  const amountStep = type === 'water' ? 5 : 10
  const amountMax = type === 'water' ? 500 : 2000
  const showAmount = type === 'milk' || type === 'water'
  const showNoteField = !['bath_swim', 'diaper', 'solid'].includes(type)
  const solidNote = [...solidSelected, ...(solidCustom.trim() ? [solidCustom.trim()] : [])].join(
    '、',
  )

  const toggleSolid = (value: string) => {
    setSolidSelected((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    )
  }

  const addSolidType = () => {
    const value = newSolidType.trim()
    if (!value || solidTypes.includes(value)) return
    const next = [...solidTypes, value]
    setSolidTypes(next)
    saveSolidTypes(next)
    setNewSolidType('')
  }

  const removeSolidType = (value: string) => {
    const next = solidTypes.filter((t) => t !== value)
    setSolidTypes(next)
    saveSolidTypes(next)
    setSolidSelected((prev) => prev.filter((t) => t !== value))
  }

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="row-between">
          <h2 className="sheet-title">
            {edit ? '编辑' : '记一笔'} · {meta.label}
          </h2>
          <button className="btn-ghost" onClick={onCancel}>
            取消
          </button>
        </div>

        <div className="field">
          <label>时间</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </div>

        {(type === 'sleep' || type === 'outing' || type === 'milk') && (
          <div className="field">
            <label>
              {type === 'sleep'
                ? '结束（睡醒后再填）'
                : type === 'milk'
                  ? '结束时间（可选）'
                  : '结束（可选）'}
            </label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
        )}

        {showAmount && (
          <div className="field">
            <label>{type === 'water' ? '水量' : '奶量'}</label>
            <div className="amount-control">
              <button
                type="button"
                className="amount-btn"
                onClick={() => setAmountMl((v) => Math.max(0, v - amountStep))}
                aria-label={`减少 ${amountStep} 毫升`}
              >
                −
              </button>
              <div className="amount-value">
                <strong>{amountMl}</strong>
                <div className="muted small">毫升</div>
              </div>
              <button
                type="button"
                className="amount-btn"
                onClick={() => setAmountMl((v) => Math.min(amountMax, v + amountStep))}
                aria-label={`增加 ${amountStep} 毫升`}
              >
                +
              </button>
            </div>
            <div className="chip-row" style={{ marginTop: 10 }}>
              {(type === 'water' ? [10, 20, 30, 50, 80, 100] : [80, 100, 120, 150, 180, 200]).map(
                (ml) => (
                  <button
                    key={ml}
                    type="button"
                    className={`chip${amountMl === ml ? ' active' : ''}`}
                    onClick={() => setAmountMl(ml)}
                  >
                    {ml}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {type === 'milk' && (
          <div className="field">
            <label>奶的类型</label>
            <div className="chip-row">
              {MILK_KINDS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip${note === p ? ' active' : ''}`}
                  onClick={() => setNote(note === p ? '' : p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'solid' && (
          <div className="field">
            <div className="row-between">
              <label>辅食类型（可多选）</label>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditingSolidTypes((v) => !v)}
              >
                {editingSolidTypes ? '完成' : '编辑类型'}
              </button>
            </div>
            <div className="chip-row">
              {solidTypes.map((p) => (
                <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`chip${solidSelected.includes(p) ? ' active' : ''}`}
                    onClick={() => {
                      if (editingSolidTypes) return
                      toggleSolid(p)
                    }}
                  >
                    {p}
                  </button>
                  {editingSolidTypes && (
                    <button
                      type="button"
                      className="chip"
                      aria-label={`删除 ${p}`}
                      style={{ marginLeft: 4, padding: '0 10px' }}
                      onClick={() => removeSolidType(p)}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {!solidTypes.length && (
                <span className="muted small">还没有辅食类型，先添加一个</span>
              )}
            </div>
            {editingSolidTypes && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  value={newSolidType}
                  onChange={(e) => setNewSolidType(e.target.value)}
                  placeholder="新类型，如：蔬菜泥"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSolidType()
                    }
                  }}
                />
                <button type="button" className="btn btn-primary" onClick={addSolidType}>
                  添加
                </button>
              </div>
            )}
            {!editingSolidTypes && (
              <div className="muted small" style={{ marginTop: 8 }}>
                可同时点选多项；点「编辑类型」可增删选项
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <label>其他 / 备注</label>
              <input
                value={solidCustom}
                onChange={(e) => setSolidCustom(e.target.value)}
                placeholder="例如：南瓜泥"
              />
            </div>
          </div>
        )}

        {type === 'diaper' && (
          <div className="field">
            <label>尿布情况</label>
            <div className="chip-row">
              {DIAPER_TAGS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip${note === p ? ' active' : ''}`}
                  onClick={() => setNote(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'bath_swim' && (
          <div className="field">
            <label>类型</label>
            <div className="chip-row">
              {bathPresets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`chip${(note || '洗澡') === p.value ? ' active' : ''}`}
                  onClick={() => setNote(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showNoteField && (
          <div className="field">
            <label>备注（可选）</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                type === 'milk'
                  ? '例如：亲喂 / 配方奶（也可点上方类型）'
                  : type === 'sleep'
                    ? '例如：午睡'
                    : '选填'
              }
            />
          </div>
        )}

        <div className="stack" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave({
                type,
                startAt: fromLocalInputValue(startAt),
                endAt: endAt ? fromLocalInputValue(endAt) : null,
                amountMl: showAmount ? amountMl : null,
                note: type === 'solid' ? solidNote || null : note || null,
                createdBy: edit?.createdBy || profileName,
              })
            }}
          >
            保存
          </button>
          {edit && onDelete && (
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              删除记录
            </button>
          )}
          {!edit && defaultBaby && (
            <div className="muted small" style={{ textAlign: 'center' }}>
              将记到「{defaultBaby.name}」
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BabySheet({
  baby,
  onCancel,
  onSave,
  onDelete,
}: {
  baby: Baby | null
  onCancel: () => void
  onSave: (data: { name: string; avatarColor: string; avatarUrl: string | null }) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(baby?.name ?? '')
  const [avatarColor, setAvatarColor] = useState(baby?.avatarColor ?? '#0A84FF')
  const [avatarUrl, setAvatarUrl] = useState(baby?.avatarUrl ?? null)
  const colors = ['#0A84FF', '#FF9F0A', '#FF6482', '#5E5CE6', '#30D158', '#BF5AF2']

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="row-between">
          <h2 className="sheet-title">{baby ? '编辑宝宝' : '添加宝宝'}</h2>
          <button className="btn-ghost" onClick={onCancel}>
            取消
          </button>
        </div>

        <div className="field">
          <label>头像</label>
          <div className="row" style={{ marginTop: 8 }}>
            <div className="avatar avatar-lg" style={{ background: avatarColor }}>
              {avatarUrl ? <img src={avatarUrl} alt="" /> : name.slice(0, 1) || '宝'}
            </div>
            <div className="stack" style={{ flex: 1 }}>
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                选择图片
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => setAvatarUrl(String(reader.result))
                    reader.readAsDataURL(file)
                  }}
                />
              </label>
              {avatarUrl && (
                <button type="button" className="btn-ghost" onClick={() => setAvatarUrl(null)}>
                  用名字首字
                </button>
              )}
            </div>
          </div>
          <div className="chip-row" style={{ marginTop: 12 }}>
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`颜色 ${c}`}
                onClick={() => setAvatarColor(c)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: c,
                  boxShadow: avatarColor === c ? '0 0 0 3px #fff, 0 0 0 5px #0A84FF' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label>名字</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：小宝 / 豆豆"
            maxLength={12}
          />
        </div>

        <div className="stack" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() =>
              onSave({ name: name.trim(), avatarColor, avatarUrl })
            }
          >
            保存
          </button>
          {baby && onDelete && (
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              删除宝宝
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function JoinSheet({
  currentInvite,
  onCancel,
  onJoined,
}: {
  currentInvite: string | null
  onCancel: () => void
  onJoined: () => void
}) {
  const [invite, setInvite] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="row-between">
          <h2 className="sheet-title">加入家人家庭</h2>
          <button className="btn-ghost" onClick={onCancel}>
            取消
          </button>
        </div>
        {currentInvite && (
          <div className="banner" style={{ marginTop: 8 }}>
            你当前家庭邀请码：<strong>{currentInvite}</strong>。加入其他家庭后将切换过去。
          </div>
        )}
        <div className="field">
          <label>家庭邀请码</label>
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value.toUpperCase())}
            placeholder="6 位邀请码"
          />
        </div>
        <div className="field">
          <label>我的称呼</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：爸爸"
          />
        </div>
        {error && (
          <div className="danger-text small" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 18 }}
          disabled={loading || invite.trim().length < 4}
          onClick={async () => {
            setLoading(true)
            setError('')
            const { error: err } = await joinFamilyByInvite(invite, name.trim() || '家人')
            setLoading(false)
            if (err) setError(err)
            else onJoined()
          }}
        >
          {loading ? '加入中…' : '加入'}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [booting, setBooting] = useState(true)
  const [data, setData] = useState<AppData | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [historyDay, setHistoryDay] = useState(todayKey())
  const [trendEnd, setTrendEnd] = useState(todayKey())
  const [trendRange, setTrendRange] = useState<7 | 30>(7)
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('milk')

  // 选中某天；若不在当前曲线窗口内，则把曲线窗口移到该天
  const selectHistoryDay = useCallback(
    (day: string) => {
      setHistoryDay(day)
      const end = new Date(`${trendEnd}T12:00:00`)
      const start = new Date(end)
      start.setDate(end.getDate() - (trendRange - 1))
      const target = new Date(`${day}T12:00:00`)
      if (target > end || target < start) setTrendEnd(day)
    },
    [trendEnd, trendRange],
  )
  const [toast, setToast] = useState('')
  // 云端写入中的本地记录，刷新时保留，避免被慢同步冲掉
  const pendingEventsRef = useRef<Map<string, BabyEvent>>(new Map())
  const pendingDeletesRef = useRef<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const next = await loadData()
    setData((prev) => {
      if (!prev) return next
      const keptBabyId =
        prev.currentBabyId && next.babies.some((b) => b.id === prev.currentBabyId)
          ? prev.currentBabyId
          : next.currentBabyId
      const merged = next.events.filter((e) => !pendingDeletesRef.current.has(e.id))
      for (const p of pendingEventsRef.current.values()) {
        const idx = merged.findIndex((e) => e.id === p.id)
        if (idx >= 0) merged[idx] = p
        else merged.push(p)
      }
      merged.sort((a, b) => b.startAt.localeCompare(a.startAt))
      return { ...next, events: merged, currentBabyId: keptBabyId }
    })
    return next
  }, [])

  useEffect(() => {
    void refresh().finally(() => setBooting(false))
  }, [refresh])

  const familyId = data?.user?.familyId ?? null
  useEffect(() => {
    if (!familyId || familyId === 'local-family') return
    let timer: number | null = null
    const unsub = subscribeFamily(familyId, () => {
      // 合并短时间内的多次变更，避免刷太猛
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void refresh()
      }, 250)
    })
    return () => {
      if (timer) window.clearTimeout(timer)
      unsub()
    }
  }, [familyId, refresh])

  // 回到页面时立刻同步一次
  useEffect(() => {
    const syncIfVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', syncIfVisible)
    document.addEventListener('visibilitychange', syncIfVisible)
    return () => {
      window.removeEventListener('focus', syncIfVisible)
      document.removeEventListener('visibilitychange', syncIfVisible)
    }
  }, [refresh])

  // WebSocket 不稳定时的兜底：前台每 25 秒静默拉一次
  useEffect(() => {
    if (!familyId || familyId === 'local-family') return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 25000)
    return () => window.clearInterval(id)
  }, [familyId, refresh])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  const baby = useMemo(() => {
    if (!data) return null
    return data.babies.find((b) => b.id === data.currentBabyId) ?? data.babies[0] ?? null
  }, [data])

  const todayEvents = useMemo(() => {
    if (!data || !baby) return []
    const key = todayKey()
    return data.events
      .filter((e) => e.babyId === baby.id && todayKey(new Date(e.startAt)) === key)
      .sort((a, b) => b.startAt.localeCompare(a.startAt))
  }, [data, baby])

  const historyEvents = useMemo(() => {
    if (!data || !baby) return []
    return data.events
      .filter((e) => e.babyId === baby.id && todayKey(new Date(e.startAt)) === historyDay)
      .sort((a, b) => b.startAt.localeCompare(a.startAt))
  }, [data, baby, historyDay])

  const handleSaveEvent = (
    payload: Partial<BabyEvent> & { type: EventType },
    editId?: string,
  ) => {
    if (!data) return
    const babyId = data.currentBabyId || baby?.id || null
    if (!babyId) {
      setToast('请先添加宝宝')
      return
    }

    const optimisticId = editId ?? `local-${crypto.randomUUID()}`
    const optimistic: BabyEvent = {
      id: optimisticId,
      babyId,
      type: payload.type,
      startAt: payload.startAt ?? nowIso(),
      endAt: payload.endAt ?? null,
      amountMl: payload.amountMl ?? null,
      note: payload.note ?? null,
      createdBy: payload.createdBy || data.displayName,
      createdAt:
        (editId && data.events.find((e) => e.id === editId)?.createdAt) || nowIso(),
    }

    // 先本地秒回：立刻改界面并关掉弹窗，不等网络
    pendingEventsRef.current.set(optimisticId, optimistic)
    setData((prev) => {
      if (!prev) return prev
      if (editId) {
        return {
          ...prev,
          events: prev.events.map((e) => (e.id === editId ? optimistic : e)),
        }
      }
      return { ...prev, events: [optimistic, ...prev.events] }
    })
    setSheet(null)

    // 后台同步云端；失败再提示并拉回真相
    void (async () => {
      const { error, event } = await saveEvent(
        {
          id: editId,
          type: payload.type,
          startAt: optimistic.startAt,
          endAt: optimistic.endAt,
          amountMl: optimistic.amountMl,
          note: optimistic.note,
          createdBy: optimistic.createdBy,
          babyId,
        },
        data.currentBabyId,
        data.displayName,
      )
      pendingEventsRef.current.delete(optimisticId)
      if (error) {
        setToast(error)
        void refresh()
        return
      }
      if (event) {
        setData((prev) => {
          if (!prev) return prev
          const withoutTemp = prev.events.filter((e) => e.id !== optimisticId)
          if (withoutTemp.some((e) => e.id === event.id)) {
            return {
              ...prev,
              events: withoutTemp.map((e) => (e.id === event.id ? event : e)),
            }
          }
          return { ...prev, events: [event, ...withoutTemp] }
        })
      }
    })()
  }

  const handleDeleteEvent = (id: string) => {
    if (!window.confirm('确定删除这条记录吗？')) return
    pendingDeletesRef.current.add(id)
    pendingEventsRef.current.delete(id)
    setData((prev) =>
      prev ? { ...prev, events: prev.events.filter((e) => e.id !== id) } : prev,
    )
    setSheet(null)
    void (async () => {
      const { error } = await deleteEvent(id)
      pendingDeletesRef.current.delete(id)
      if (error) {
        setToast(error)
        void refresh()
      }
    })()
  }

  const handleSaveBaby = async (
    payload: { name: string; avatarColor: string; avatarUrl: string | null },
    babyId?: string,
  ) => {
    const { error } = babyId ? await updateBaby(babyId, payload) : await addBaby(payload)
    if (error) {
      setToast(error)
      return
    }
    setSheet(null)
    await refresh()
    if (!babyId) setToast('已添加宝宝')
  }

  const handleDeleteBaby = async (id: string) => {
    if (!window.confirm('删除宝宝后，TA 的记录也会删除。确定吗？')) return
    const { error } = await deleteBaby(id)
    if (error) setToast(error)
    setSheet(null)
    await refresh()
  }

  const renderTimeline = (events: BabyEvent[]) => {
    if (!events.length) {
      return (
        <div className="card empty">
          <div className="emoji">🌤</div>
          <div>还没有记录</div>
          <div className="small" style={{ marginTop: 6 }}>
            点下面的大按钮，马上记一笔
          </div>
        </div>
      )
    }
    return (
      <div className="card">
        {events.map((ev) => {
          const meta = EVENT_META[ev.type]
          return (
            <button
              key={ev.id}
              type="button"
              className="timeline-item"
              onClick={() => setSheet({ kind: 'event', type: ev.type, editId: ev.id })}
            >
              <div className="dot" style={{ background: `${meta.color}22` }}>
                <span>{meta.icon}</span>
              </div>
              <div className="timeline-body">
                <div className="timeline-title">
                  {meta.label}
                  {(ev.type === 'bath_swim' || ev.type === 'diaper' || ev.type === 'milk') &&
                  ev.note
                    ? ` · ${ev.note}`
                    : ''}
                </div>
                <div className="timeline-meta">
                  {formatTime(ev.startAt)} · {eventSubtitle(ev)}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  if (booting) {
    return (
      <div className="app-shell">
        <div className="empty" style={{ paddingTop: 120 }}>
          <div className="emoji">⏳</div>
          <div>正在打开…</div>
        </div>
      </div>
    )
  }

  if (!data?.user) {
    return <AuthScreen onReady={() => void refresh()} />
  }

  const editingEvent =
    sheet?.kind === 'event' && sheet.editId
      ? data.events.find((e) => e.id === sheet.editId)
      : undefined

  return (
    <div className="app-shell">
      {tab === 'home' && (
        <>
          <header className="header">
            <h1>宝宝日记</h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {formatDayLabel(todayKey())} · {data.mode === 'cloud' ? '全家同步中' : '本机模式'}
            </p>
          </header>
          <div className="page">
            {baby ? (
              <>
                <div className="card">
                  <button
                    type="button"
                    className="baby-switch"
                    onClick={() => setSheet({ kind: 'switch' })}
                  >
                    <Avatar baby={baby} size="lg" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{baby.name}</div>
                      <div className="muted small">点按切换或管理宝宝</div>
                    </div>
                    <div className="muted">切换 ›</div>
                  </button>
                </div>

                <div className="section-title">今日状态</div>
                <SummaryTiles events={todayEvents} />

                <div className="section-title">今日时间线</div>
                {renderTimeline(todayEvents)}

                <div className="section-title">快捷记一笔</div>
                <div className="quick-grid">
                  {QUICK_TYPES.map((t) => {
                    const meta = EVENT_META[t]
                    return (
                      <button
                        key={t}
                        type="button"
                        className="quick-btn"
                        onClick={() => setSheet({ kind: 'event', type: t })}
                      >
                        <div className="quick-icon" style={{ background: `${meta.color}22` }}>
                          {meta.icon}
                        </div>
                        <div className="quick-label">{meta.label}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="card empty">
                <div className="emoji">👶</div>
                <div>先添加一位宝宝吧</div>
                <div className="small" style={{ margin: '8px 0 16px' }}>
                  设置名字和头像后就能开始记录
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setSheet({ kind: 'baby' })}
                >
                  添加宝宝
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'history' && (
        <>
          <header className="header">
            <h1>历史</h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              按天查看{baby ? ` · ${baby.name}` : ''}
            </p>
          </header>
          <div className="page">
            <div className="card history-toolbar">
              <div className="history-date-row">
                <button
                  type="button"
                  className="history-nav-btn"
                  aria-label="前一天"
                  onClick={() => {
                    const d = new Date(`${historyDay}T12:00:00`)
                    d.setDate(d.getDate() - 1)
                    selectHistoryDay(todayKey(d))
                  }}
                >
                  ‹
                </button>
                <input
                  type="date"
                  value={historyDay}
                  onChange={(e) => {
                    if (e.target.value) selectHistoryDay(e.target.value)
                  }}
                  aria-label="选择日期"
                />
                <button
                  type="button"
                  className="history-nav-btn"
                  aria-label="后一天"
                  onClick={() => {
                    const d = new Date(`${historyDay}T12:00:00`)
                    d.setDate(d.getDate() + 1)
                    selectHistoryDay(todayKey(d))
                  }}
                >
                  ›
                </button>
              </div>
              <div className="chip-row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className={`chip${historyDay === todayKey() ? ' active' : ''}`}
                  onClick={() => selectHistoryDay(todayKey())}
                >
                  今天
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() - 1)
                    selectHistoryDay(todayKey(d))
                  }}
                >
                  昨天
                </button>
              </div>
            </div>

            <div className="section-title">{formatDayLabel(historyDay)} · 当日统计</div>
            <DayStats events={historyEvents} />

            <div className="section-title">变化曲线</div>
            <div className="card trend-card">
              <div className="segmented" role="tablist" aria-label="时间范围">
                {([
                  { v: 7 as const, t: '近 7 天' },
                  { v: 30 as const, t: '近 30 天' },
                ]).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="tab"
                    aria-selected={trendRange === o.v}
                    className={`segmented-item${trendRange === o.v ? ' active' : ''}`}
                    onClick={() => setTrendRange(o.v)}
                  >
                    {o.t}
                  </button>
                ))}
              </div>

              <div className="segmented metric-seg" role="tablist" aria-label="统计维度">
                {TREND_METRICS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={trendMetric === m.key}
                    className={`segmented-item${trendMetric === m.key ? ' active' : ''}`}
                    onClick={() => setTrendMetric(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <TrendChart
                events={
                  baby
                    ? data.events.filter((e) => e.babyId === baby.id)
                    : []
                }
                endDate={trendEnd}
                selectedDay={historyDay}
                range={trendRange}
                metric={trendMetric}
                onPickDay={selectHistoryDay}
              />
            </div>

            <div className="section-title">{formatDayLabel(historyDay)} · 明细</div>
            {renderTimeline(historyEvents)}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <>
          <header className="header">
            <h1>我的</h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {data.user.email}
              {data.mode === 'cloud' ? ' · 云端已连接' : ' · 本机模式'}
            </p>
          </header>
          <div className="page">
            <div className="section-title">宝宝</div>
            <div className="card">
              {data.babies.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="list-row"
                  onClick={() => setSheet({ kind: 'baby', babyId: b.id })}
                >
                  <div className="row">
                    <Avatar baby={b} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{b.name}</div>
                      <div className="muted small">点击编辑名字和头像</div>
                    </div>
                  </div>
                  <div className="muted">›</div>
                </button>
              ))}
              <button
                type="button"
                className="list-row"
                onClick={() => setSheet({ kind: 'baby' })}
              >
                <div className="row">
                  <div
                    className="avatar"
                    style={{ background: 'var(--fill)', color: 'var(--blue)' }}
                  >
                    +
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--blue)' }}>添加宝宝</div>
                </div>
              </button>
            </div>

            <div className="section-title">家庭</div>
            <div className="card" style={{ padding: 16 }}>
              <div className="row-between">
                <div>
                  <div style={{ fontWeight: 600 }}>家庭邀请码</div>
                  <div className="muted small">发给家人，一起看宝宝动态</div>
                </div>
                {data.user.inviteCode && (
                  <div className="pill" style={{ fontSize: 18, letterSpacing: '0.12em' }}>
                    {data.user.inviteCode}
                  </div>
                )}
              </div>
              {data.user.inviteCode && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 12 }}
                  onClick={async () => {
                    await navigator.clipboard?.writeText(data.user?.inviteCode || '')
                    setToast('邀请码已复制')
                  }}
                >
                  复制邀请码
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => setSheet({ kind: 'join' })}
              >
                加入其他家庭
              </button>
            </div>

            <div className="section-title">账号</div>
            <div className="card" style={{ padding: 16 }}>
              <div className="field" style={{ marginTop: 0 }}>
                <label>我的称呼（记录里会显示）</label>
                <input
                  value={data.displayName}
                  onChange={(e) =>
                    setData((prev) =>
                      prev ? { ...prev, displayName: e.target.value || '家人' } : prev,
                    )
                  }
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 12 }}
                onClick={async () => {
                  const { error } = await updateDisplayName(data.displayName)
                  if (error) setToast(error)
                  else {
                    await refresh()
                    setToast('已保存')
                  }
                }}
              >
                保存称呼
              </button>
            </div>

            <div className="section-title">数据</div>
            <div className="card">
              <button
                type="button"
                className="list-row"
                onClick={() => {
                  try {
                    const events = data?.events ?? []
                    const babies = data?.babies ?? []
                    const payload = {
                      app: '宝宝日记',
                      format: 'baby-diary-backup',
                      version: 1,
                      exportedAt: nowIso(),
                      displayName: data?.displayName ?? '',
                      babies,
                      events,
                      solidTypes: loadSolidTypes(),
                    }
                    const text = JSON.stringify(payload, null, 2)
                    if (!text || text === '{}' || (!babies.length && !events.length)) {
                      setToast('没有可导出的数据')
                      return
                    }
                    const blob = new Blob([text], {
                      type: 'application/json;charset=utf-8',
                    })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `宝宝日记-${todayKey()}.json`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                    setToast(`已导出 ${events.length} 条记录`)
                  } catch (e) {
                    setToast(e instanceof Error ? e.message : '导出失败')
                  }
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>导出备份</div>
                  <div className="muted small">下载 JSON 文件</div>
                </div>
                <div className="muted">›</div>
              </button>
              <button
                type="button"
                className="list-row"
                onClick={async () => {
                  if (!window.confirm('确定退出登录吗？')) return
                  await signOut()
                  setData(null)
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }} className="danger-text">
                    退出登录
                  </div>
                </div>
                <div className="muted">›</div>
              </button>
            </div>

            <p className="muted small" style={{ textAlign: 'center', marginTop: 24 }}>
              宝宝日记 · {data.mode === 'cloud' ? '家庭云同步' : '本机模式'}
            </p>
          </div>
        </>
      )}

      <nav className="bottom-nav" aria-label="主导航">
        {(
          [
            { id: 'home', label: '首页', icon: '🏠' },
            { id: 'history', label: '历史', icon: '📅' },
            { id: 'settings', label: '我的', icon: '👤' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${tab === item.id ? ' active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 100,
            transform: 'translateX(-50%)',
            background: 'rgba(28,28,30,0.92)',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: 12,
            zIndex: 80,
            maxWidth: '90vw',
          }}
        >
          {toast}
        </div>
      )}

      {sheet?.kind === 'event' && (
        <EventSheet
          type={sheet.type}
          edit={editingEvent ?? null}
          defaultBaby={baby}
          profileName={data.displayName}
          onCancel={() => setSheet(null)}
          onSave={(payload) => handleSaveEvent(payload, sheet.editId)}
          onDelete={sheet.editId ? () => handleDeleteEvent(sheet.editId as string) : undefined}
        />
      )}

      {sheet?.kind === 'baby' && (
        <BabySheet
          baby={sheet.babyId ? data.babies.find((b) => b.id === sheet.babyId) ?? null : null}
          onCancel={() => setSheet(null)}
          onSave={(payload) => handleSaveBaby(payload, sheet.babyId)}
          onDelete={
            sheet.babyId && data.babies.length > 1
              ? () => handleDeleteBaby(sheet.babyId as string)
              : undefined
          }
        />
      )}

      {sheet?.kind === 'switch' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 className="sheet-title">选择宝宝</h2>
            <div className="card" style={{ marginTop: 12 }}>
              {data.babies.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="list-row"
                  onClick={() => {
                    setData((prev) => (prev ? { ...prev, currentBabyId: b.id } : prev))
                    setSheet(null)
                  }}
                >
                  <div className="row">
                    <Avatar baby={b} />
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                  </div>
                  {baby?.id === b.id && <div className="pill">当前</div>}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => setSheet({ kind: 'baby' })}
            >
              添加宝宝
            </button>
          </div>
        </div>
      )}

      {sheet?.kind === 'join' && (
        <JoinSheet
          currentInvite={data.user.inviteCode}
          onCancel={() => setSheet(null)}
          onJoined={async () => {
            setSheet(null)
            await refresh()
            setToast('已加入家庭')
          }}
        />
      )}
    </div>
  )
}
