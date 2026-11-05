import { getGrowthRecords } from './backend'
import type { GrowthRecord } from '../types'

/** 共享成长数据缓存，避免首页/成长页重复请求 */
let cache: { babyId: string; records: GrowthRecord[]; ts: number } | null = null
const CACHE_TTL = 30_000

export async function loadGrowthCached(babyId: string): Promise<GrowthRecord[]> {
  if (cache && cache.babyId === babyId && Date.now() - cache.ts < CACHE_TTL) {
    return cache.records
  }
  const r = await getGrowthRecords(babyId)
  const records = r.records ?? []
  cache = { babyId, records, ts: Date.now() }
  return records
}

export function invalidateGrowthCache() {
  cache = null
}
