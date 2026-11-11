import type { Baby, BabyEvent } from '../types'

const SNAPSHOT_KEY = 'baby-day-cloud-snapshot-v1'

/** 快照里的用户信息（登录态秒开用，不含凭据） */
export type SnapshotUser = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  familyId: string
  inviteCode: string | null
}

/** 云端数据快照：缓存到 localStorage，启动秒开、之后增量同步 */
export type CloudSnapshot = {
  user: SnapshotUser
  babies: Baby[]
  events: BabyEvent[]
  currentBabyId: string | null
  /** baby 表增量游标（已见过的 updated_at 最大值） */
  babyCursor: string
  /** event 表增量游标（已见过的 updated_at 最大值） */
  eventCursor: string
  savedAt: number
  /** 最近一次全量同步时间（定期全量兜底删除/时钟偏差） */
  lastFullAt: number
  /** 删除墓碑：id → 删除时间，防止并发同步把已删记录写回 */
  tombstones?: Record<string, number>
}

const MAX_EVENTS = 500
/** 墓碑保留时长：超过后认为不会再有并发的旧响应写回 */
const TOMBSTONE_TTL = 15 * 60 * 1000

function pruneTombstones(map: Record<string, number> | undefined): Record<string, number> {
  if (!map) return {}
  const now = Date.now()
  const out: Record<string, number> = {}
  for (const [id, ts] of Object.entries(map)) {
    if (now - ts < TOMBSTONE_TTL) out[id] = ts
  }
  return out
}

function markTombstone(map: Record<string, number> | undefined, id: string): Record<string, number> {
  return { ...pruneTombstones(map), [id]: Date.now() }
}

/** 过滤已删除的记录（事件按自身 id、宝宝按 id，宝宝删了其事件也没了） */
function dropTombstoned<T extends { id: string }>(
  rows: T[],
  tombstones: Record<string, number> | undefined,
  babyOf?: (row: T) => string,
): T[] {
  if (!tombstones || !Object.keys(tombstones).length) return rows
  return rows.filter(
    (r) => !tombstones[r.id] && !(babyOf && tombstones[babyOf(r)]),
  )
}

export function readSnapshot(): CloudSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CloudSnapshot
  } catch {
    return null
  }
}

export function saveSnapshot(snap: CloudSnapshot): void {
  const trimmed: CloudSnapshot = {
    ...snap,
    events: [...snap.events]
      .sort((a, b) => b.startAt.localeCompare(a.startAt))
      .slice(0, MAX_EVENTS),
  }
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(trimmed))
  } catch {
    // 空间不足：剥掉 data URL 照片再存（照片显示降级，数据不丢）
    try {
      const slim: CloudSnapshot = {
        ...trimmed,
        events: trimmed.events.map((e) =>
          e.photoUrl && e.photoUrl.startsWith('data:') ? { ...e, photoUrl: null } : e,
        ),
      }
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(slim))
    } catch {
      // ignore
    }
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    // ignore
  }
}

/** 同步合并时过滤已删除记录（防止并发响应把删除的写回来） */
export function dropDeletedEvents<T extends { id: string; babyId: string }>(
  rows: T[],
  tombstones?: Record<string, number>,
): T[] {
  return dropTombstoned(rows, tombstones, (r) => r.babyId)
}

export function dropDeletedBabies<T extends { id: string }>(
  rows: T[],
  tombstones?: Record<string, number>,
): T[] {
  return dropTombstoned(rows, tombstones)
}

/** 写穿：把一条事件并入快照（不推进游标，游标只信服务端返回的 updated_at） */
export function upsertSnapshotEvent(ev: BabyEvent): void {
  const snap = readSnapshot()
  if (!snap) return
  if (snap.tombstones?.[ev.id]) return
  const events = [ev, ...snap.events.filter((e) => e.id !== ev.id)]
  saveSnapshot({ ...snap, events })
}

export function upsertSnapshotBaby(baby: Baby): void {
  const snap = readSnapshot()
  if (!snap) return
  if (snap.tombstones?.[baby.id]) return
  const babies = snap.babies.some((b) => b.id === baby.id)
    ? snap.babies.map((b) => (b.id === baby.id ? baby : b))
    : [...snap.babies, baby]
  const currentBabyId =
    snap.currentBabyId && babies.some((b) => b.id === snap.currentBabyId)
      ? snap.currentBabyId
      : babies[0]?.id ?? null
  saveSnapshot({ ...snap, babies, currentBabyId })
}

/** 写穿：从快照拿掉一条事件（本地/远端删除后立即生效） */
export function removeSnapshotEvent(id: string): void {
  const snap = readSnapshot()
  if (!snap) return
  saveSnapshot({
    ...snap,
    events: snap.events.filter((e) => e.id !== id),
    tombstones: markTombstone(snap.tombstones, id),
  })
}

/** 写穿：拿掉宝宝及其全部记录 */
export function removeSnapshotBaby(id: string): void {
  const snap = readSnapshot()
  if (!snap) return
  const babies = snap.babies.filter((b) => b.id !== id)
  saveSnapshot({
    ...snap,
    babies,
    events: snap.events.filter((e) => e.babyId !== id),
    currentBabyId:
      snap.currentBabyId === id ? babies[0]?.id ?? null : snap.currentBabyId,
    tombstones: markTombstone(snap.tombstones, id),
  })
}

/** 记住用户当前看的是哪个宝宝 */
export function setSnapshotBaby(babyId: string | null): void {
  const snap = readSnapshot()
  if (!snap) return
  saveSnapshot({ ...snap, currentBabyId: babyId })
}
