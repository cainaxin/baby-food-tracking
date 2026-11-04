import { supabase } from './supabase'
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
  return [
    '你是一位温和专业的婴幼儿养育顾问，用中文回答。',
    '请根据以下宝宝当天的记录，给出一段简洁的总结和建议（200字以内）。',
    '格式：先用一两句话总结今天的情况，然后给 1-2 条具体建议（如调整奶量、增加睡眠等），做得好的地方要鼓励。语气亲切、适合老人阅读。',
    '',
    summarizeDay(baby, events, dayKey),
  ].join('\n')
}

/**
 * 调用 AI 生成每日总结。
 * 优先走 Supabase Edge Function（key 在服务端，安全）；
 * 未部署 EF 时降级为本地统计文本，不暴露任何 API key。
 */
export async function fetchDailySummary(
  baby: Baby,
  events: BabyEvent[],
  dayKey: string,
): Promise<{ summary?: DailySummary; error?: string }> {
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

  if (!supabase) {
    return { summary: { text: fallbackSummary(baby, stats), stats } }
  }

  try {
    const { data, error } = await supabase.functions.invoke('daily-summary', {
      body: {
        prompt: buildPrompt(baby, events, dayKey),
      },
    })
    if (error) {
      // Edge Function 未部署时降级
      return { summary: { text: fallbackSummary(baby, stats), stats } }
    }
    const text = data?.text
    if (!text) {
      return { summary: { text: fallbackSummary(baby, stats), stats } }
    }
    return { summary: { text, stats } }
  } catch {
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
