import { DEFAULT_SOLID_TYPES } from '../types'

const STORAGE_KEY = 'baby-tracker-solid-types'

export function loadSolidTypes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_SOLID_TYPES]
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed.filter(Boolean)
    }
  } catch {
    // ignore corrupt storage
  }
  return [...DEFAULT_SOLID_TYPES]
}

export function saveSolidTypes(types: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types))
}
