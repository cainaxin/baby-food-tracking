export type EventType =
  | 'milk'
  | 'solid'
  | 'water'
  | 'diaper'
  | 'sleep'
  | 'wake'
  | 'outing'
  | 'bath_swim'

export type EventKind = 'bath' | 'swim'

export interface Baby {
  id: string
  name: string
  avatarColor: string
  avatarUrl?: string | null
  /** 生日（YYYY-MM-DD），用于算月龄 */
  birthDate?: string | null
  gender?: 'boy' | 'girl' | null
  /** 最近体重（kg） */
  weightKg?: number | null
  /** 最近身高（cm） */
  heightCm?: number | null
  createdAt: string
}

export interface BabyEvent {
  id: string
  babyId: string
  type: EventType
  startAt: string
  endAt?: string | null
  amountMl?: number | null
  note?: string | null
  /** 辅食照片（data URL 或云端公开 URL） */
  photoUrl?: string | null
  createdBy: string
  createdAt: string
}

export interface FamilyProfile {
  displayName: string
  /** 用户头像（data URL 或云端 URL） */
  avatarUrl?: string | null
}

/** 成长记录：按日期记录身高体重 */
export interface GrowthRecord {
  id: string
  babyId: string
  /** 记录日期 YYYY-MM-DD */
  dateKey: string
  /** 体重（kg） */
  weightKg?: number | null
  /** 身高（cm） */
  heightCm?: number | null
  note?: string | null
  createdBy: string
  createdAt: string
}

/** 反馈与建议 */
export interface FeedbackItem {
  id: string
  content: string
  contact?: string | null
  createdBy: string
  status: 'pending' | 'done'
  createdAt: string
}

export const EVENT_META: Record<
  EventType,
  { label: string; short: string; color: string; icon: string }
> = {
  milk: { label: '吃奶', short: '奶', color: '#FF9F0A', icon: '🍼' },
  solid: { label: '辅食', short: '辅', color: '#FF6482', icon: '🥣' },
  water: { label: '喝水', short: '水', color: '#5AC8FA', icon: '💧' },
  diaper: { label: '换尿布', short: '尿', color: '#FFD60A', icon: '🩲' },
  sleep: { label: '睡觉', short: '睡', color: '#5E5CE6', icon: '😴' },
  wake: { label: '起床', short: '起', color: '#30D158', icon: '☀️' },
  outing: { label: '外出', short: '外', color: '#64D2FF', icon: '🌤' },
  bath_swim: { label: '洗澡游泳', short: '浴', color: '#BF5AF2', icon: '🛁' },
}

export const QUICK_TYPES: EventType[] = [
  'milk',
  'solid',
  'water',
  'diaper',
  'sleep',
  'wake',
  'outing',
  'bath_swim',
]

export const DIAPER_TAGS = ['尿尿', '拉屎', '尿尿+拉屎'] as const

export const MILK_KINDS = ['亲喂', '冻奶', '奶粉'] as const

export const DEFAULT_SOLID_TYPES = ['米粉', '米糊', '果泥', '蛋黄', '面条', '粥']
