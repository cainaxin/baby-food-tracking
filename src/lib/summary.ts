import { supabase, supabaseUrl, supabaseAnonKey } from './supabase'
import { getDailySummary, saveDailySummary } from './backend'
import type { Baby, BabyEvent } from '../types'
import { sleepMinutesOnDay, outingMinutesOnDay, formatMonthAge } from './time'

function fmtMin(mins: number): string {
  if (mins <= 0) return '0 分钟'
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export type DailySummary = {
  /** AI 生成的总结与建议 */
  text: string
  /** 聚合数据（便于回看） */
  stats: {
    milkMl: number
    waterMl: number
    sleepMin: number
    outingMin: number
    diaper: number
    solid: number
  }
}

/** 把一天的记录整理成 AI 能读的文本摘要 */
function summarizeDay(baby: Baby, events: BabyEvent[], dayKey: string): string {
  const milk = events.filter((e) => e.type === 'milk')
  const milkMl = milk.reduce((s, e) => s + (e.amountMl ?? 0), 0)
  const waterMl = events
    .filter((e) => e.type === 'water')
    .reduce((s, e) => s + (e.amountMl ?? 0), 0)
  const sleepMin = events
    .filter((e) => e.type === 'sleep')
    .reduce((s, e) => s + sleepMinutesOnDay(e.startAt, e.endAt, dayKey), 0)
  const outingMin = events
    .filter((e) => e.type === 'outing')
    .reduce((s, e) => s + outingMinutesOnDay(e.startAt, e.endAt, dayKey), 0)
  const diaper = events.filter((e) => e.type === 'diaper').length
  const solidNotes = events
    .filter((e) => e.type === 'solid')
    .map((e) => e.note || '辅食')

  const parts: string[] = []
  parts.push(`宝宝：${baby.name}`)
  const age = formatMonthAge(baby.birthDate)
  if (age) parts.push(`月龄：${age}`)
  if (baby.gender) parts.push(`性别：${baby.gender === 'boy' ? '男' : '女'}`)
  if (baby.weightKg != null) parts.push(`体重：${baby.weightKg}kg`)
  if (baby.heightCm != null) parts.push(`身高：${baby.heightCm}cm`)
  parts.push('')
  parts.push(`当日数据：`)
  parts.push(`- 吃奶：${milk.length} 次，共 ${milkMl}ml`)
  parts.push(`- 喝水：${waterMl}ml`)
  parts.push(`- 睡眠：${fmtMin(sleepMin)}`)
  parts.push(`- 外出：${fmtMin(outingMin)}`)
  parts.push(`- 换尿布：${diaper} 次`)
  if (solidNotes.length) parts.push(`- 辅食：${solidNotes.join('、')}`)

  return parts.join('\n')
}

function buildPrompt(baby: Baby, events: BabyEvent[], dayKey: string): string {
  const now = new Date()
  const hour = now.getHours()
  const timeSlot =
    hour < 6 ? '凌晨' :
    hour < 9 ? '清晨' :
    hour < 12 ? '上午' :
    hour < 14 ? '中午' :
    hour < 18 ? '下午' :
    hour < 21 ? '晚上' : '夜间'
  return [
    '你是一位温和专业的婴幼儿养育顾问，用中文回答。',
    `现在是${dayKey}的${timeSlot}（${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}）。`,
    '请根据以下宝宝当天的记录，给出一段简洁的总结和建议（200字以内）。',
    '注意结合时间判断：比如清晨数据少是正常的（一天刚开始），不需要建议补奶量。',
    '格式：先用一两句话总结今天的情况，然后给 1-2 条具体建议（如调整奶量、增加睡眠、适合外出等），做得好的地方要鼓励。语气亲切、适合老人阅读。',
    '',
    summarizeDay(baby, events, dayKey),
  ].join('\n')
}

/**
 * 调用 AI 生成每日总结（带缓存）。
 * 先查缓存（全家共享），没有才调 AI；结果存回缓存。
 */
export async function fetchDailySummary(
  baby: Baby,
  events: BabyEvent[],
  dayKey: string,
): Promise<{ summary?: DailySummary; error?: string; fromCache?: boolean }> {
  const stats = {
    milkMl: events
      .filter((e) => e.type === 'milk')
      .reduce((s, e) => s + (e.amountMl ?? 0), 0),
    waterMl: events
      .filter((e) => e.type === 'water')
      .reduce((s, e) => s + (e.amountMl ?? 0), 0),
    sleepMin: events
      .filter((e) => e.type === 'sleep')
      .reduce((s, e) => s + sleepMinutesOnDay(e.startAt, e.endAt, dayKey), 0),
    outingMin: events
      .filter((e) => e.type === 'outing')
      .reduce((s, e) => s + outingMinutesOnDay(e.startAt, e.endAt, dayKey), 0),
    diaper: events.filter((e) => e.type === 'diaper').length,
    solid: events.filter((e) => e.type === 'solid').length,
  }

  // 1. 先查缓存
  try {
    const cached = await getDailySummary(baby.id, dayKey)
    if (cached.text) {
      return { summary: { text: cached.text, stats }, fromCache: true }
    }
  } catch {
    // 缓存查询失败不阻塞生成
  }

  // 2. 本地模式或无 AI 时降级
  if (!supabase) {
    const text = fallbackSummary(baby, stats)
    return { summary: { text, stats } }
  }

  // 3. 调 AI（直接 fetch 调 EF，避免 supabase.functions.invoke 兼容问题）
  try {
    const url = `${supabaseUrl}/functions/v1/daily-summary`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ prompt: buildPrompt(baby, events, dayKey) }),
    })
    if (!res.ok) {
      console.warn('daily-summary EF error', res.status)
      return { summary: { text: fallbackSummary(baby, stats), stats } }
    }
    const data = await res.json()
    const text = data?.text
    if (!text || typeof text !== 'string') {
      return { summary: { text: fallbackSummary(baby, stats), stats } }
    }
    // 异步存缓存，不阻塞展示
    void saveDailySummary(baby.id, dayKey, text).catch(() => {})
    return { summary: { text, stats } }
  } catch (e) {
    console.warn('daily-summary fetch error', e)
    return { summary: { text: fallbackSummary(baby, stats), stats } }
  }
}

/** 无 AI 时的本地降级总结 */
function fallbackSummary(
  baby: Baby,
  stats: DailySummary['stats'],
): string {
  const lines: string[] = []
  lines.push(`${baby.name}今天的表现：`)
  lines.push(`吃奶 ${stats.milkMl}ml、睡眠 ${fmtMin(stats.sleepMin)}、换尿布 ${stats.diaper} 次。`)
  if (stats.milkMl > 0 && stats.milkMl < 400) {
    lines.push('奶量偏少，可以尝试少量多次喂养。')
  } else if (stats.milkMl >= 400) {
    lines.push('奶量不错，继续保持！')
  }
  if (stats.sleepMin < 600) {
    lines.push('睡眠时长偏少，注意给宝宝创造安静的休息环境。')
  }
  return lines.join('\n')
}

/** 问答：结合当天数据、提问人和当前时间回答老人的具体问题 */
export async function askDailyQuestion(
  baby: Baby,
  events: BabyEvent[],
  dayKey: string,
  question: string,
  askerName?: string,
): Promise<{ answer?: string; error?: string }> {
  const q = question.trim()
  if (!q) return { error: '请输入问题' }

  const now = new Date()
  const hour = now.getHours()
  // 时段提示：让 AI 知道现在是一天中的什么时候
  const timeSlot =
    hour < 6 ? '凌晨' :
    hour < 9 ? '清晨' :
    hour < 12 ? '上午' :
    hour < 14 ? '中午' :
    hour < 18 ? '下午' :
    hour < 21 ? '晚上' : '夜间'
  const timeStr = `${dayKey} ${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const asker = askerName?.trim() || '家人'

  const context = summarizeDay(baby, events, dayKey)
  const prompt = [
    '你是一位温和专业的婴幼儿养育顾问，用中文回答。',
    `提问者是「${asker}」（可能是爸妈或老人），请用亲切自然的语气。`,
    '请结合以下宝宝当天的实际数据和当前时间，回答问题。',
    `重要：现在是「${timeSlot}」（${timeStr}）。`,
    '根据时间判断数据是否正常——比如凌晨/清晨没有喝奶记录是正常的（一天刚开始）；',
    '也可以根据时间给出建议，比如适合带宝宝外出、该准备睡觉了、该喝奶了等。',
    '回答要简洁、具体、可执行（100字以内），适合老人阅读。',
    '',
    context,
    '',
    `${asker}的问题：${q}`,
  ].join('\n')

  if (!supabase) {
    return {
      answer: `当前是本机模式，无法使用 AI 问答。\n\n今日数据供参考：\n${context}`,
    }
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/daily-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ prompt }),
    })
    if (!res.ok) {
      return { error: 'AI 服务暂时不可用，请稍后再试' }
    }
    const data = await res.json()
    const answer = data?.text
    if (!answer || typeof answer !== 'string') {
      return { error: 'AI 没有返回内容，请再问一次' }
    }
    return { answer }
  } catch {
    return { error: '网络异常，请稍后再试' }
  }
}
