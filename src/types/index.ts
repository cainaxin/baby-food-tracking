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
  createdBy: string
  createdAt: string
}

export interface FamilyProfile {
  displayName: string
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
