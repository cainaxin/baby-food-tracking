import type { Baby, BabyEvent, FamilyProfile } from '../types'

const STORAGE_KEY = 'baby-day-store-v1'

export interface AppStore {
  profile: FamilyProfile
  babies: Baby[]
  events: BabyEvent[]
  currentBabyId: string | null
}

export function emptyStore(): AppStore {
  return {
    profile: { displayName: '家人' },
    babies: [],
    events: [],
    currentBabyId: null,
  }
}

export function loadStore(): AppStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as AppStore
    return {
      ...emptyStore(),
      ...parsed,
      babies: parsed.babies ?? [],
      events: parsed.events ?? [],
    }
  } catch {
    return emptyStore()
  }
}

export function saveStore(store: AppStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
