import type { Baby, BabyEvent, EventType, GrowthRecord } from '../types'
import { emptyStore, loadStore, saveStore, uid, type AppStore } from './store'
import { nowIso } from './time'
import { isCloudConfigured, supabase } from './supabase'

export { isCloudConfigured }

export type SessionUser = {
  id: string
  email: string
  displayName: string
  avatarUrl?: string | null
  familyId: string | null
  inviteCode: string | null
}

export type AppData = {
  mode: 'cloud' | 'local'
  user: SessionUser | null
  babies: Baby[]
  events: BabyEvent[]
  currentBabyId: string | null
  displayName: string
  avatarUrl?: string | null
}

/** 本地模式下的假用户，保证未配置云时仍可使用 */
function localUser(store: AppStore): SessionUser {
  return {
    id: 'local',
    email: 'local@device',
    displayName: store.profile.displayName,
    familyId: 'local-family',
    inviteCode: null,
  }
}

type BabyRow = {
  id: string
  name: string
  avatar_color?: string | null
  avatar_url?: string | null
  birth_date?: string | null
  gender?: string | null
  weight_kg?: number | null
  height_cm?: number | null
  created_at: string
}

type EventRow = {
  id: string
  baby_id: string
  type: string
  start_at: string
  end_at?: string | null
  amount_ml?: number | null
  note?: string | null
  photo_url?: string | null
  created_by?: string | null
  created_at: string
}

function mapBaby(row: BabyRow): Baby {
  return {
    id: row.id,
    name: row.name,
    avatarColor: row.avatar_color || '#0A84FF',
    avatarUrl: row.avatar_url || null,
    birthDate: row.birth_date || null,
    gender: (row.gender as 'boy' | 'girl' | null) ?? null,
    weightKg: row.weight_kg ?? null,
    heightCm: row.height_cm ?? null,
    createdAt: row.created_at,
  }
}

function mapEvent(row: EventRow): BabyEvent {
  return {
    id: row.id,
    babyId: row.baby_id,
    type: row.type as EventType,
    startAt: row.start_at,
    endAt: row.end_at || null,
    amountMl: row.amount_ml ?? null,
    note: row.note ?? null,
    photoUrl: row.photo_url ?? null,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return null

  // 可能存在历史多条成员记录（自动建家后又加入共享家庭），取最新一条
  const { data: members, error: memErr } = await supabase
    .from('family_member')
    .select('family_id, display_name, avatar_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (memErr) {
    console.warn('family_member query failed', memErr.message)
  }
  const member = members?.[0]

  let invite: string | null = null
  if (member?.family_id) {
    const { data: family } = await supabase
      .from('family')
      .select('invite_code')
      .eq('id', member.family_id)
      .maybeSingle()
    invite = family?.invite_code ?? null
  }

  return {
    id: user.id,
    email: user.email ?? '',
    displayName: member?.display_name || user.email?.split('@')[0] || '家人',
    avatarUrl: member?.avatar_url ?? null,
    familyId: member?.family_id ?? null,
    inviteCode: invite,
  }
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<{ user: SessionUser | null; error?: string }> {
  if (!supabase) return { user: null, error: '未配置云端' }

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { user: null, error: error.message }
  const user = data.user
  if (!user) {
    return { user: null, error: '请查收邮件完成验证后再登录' }
  }

  // 建家庭（走数据库函数，避免 RLS 插入问题）
  const { data: fam, error: famErr } = await supabase.rpc('create_family_for_user', {
    p_name: '我们的家',
    p_display_name: displayName,
  })
  if (famErr) return { user: null, error: famErr.message }
  const famObj = fam as { family_id?: string; invite_code?: string } | null

  return {
    user: {
      id: user.id,
      email: user.email ?? email,
      displayName,
      familyId: famObj?.family_id ?? null,
      inviteCode: famObj?.invite_code ?? null,
    },
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: SessionUser | null; error?: string }> {
  if (!supabase) return { user: null, error: '未配置云端' }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { user: null, error: error.message }
  if (!data.user) return { user: null, error: '登录失败' }
  const user = await getSessionUser()
  return { user }
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut()
}

/** 已登录但尚未加入家庭时，自动创建家庭并写入成员 */
export async function ensureFamily(displayName?: string): Promise<{ error?: string }> {
  if (!supabase) return {}
  const user = await getSessionUser()
  if (!user) return { error: '请先登录' }
  if (user.familyId) return {}

  const { error } = await supabase.rpc('create_family_for_user', {
    p_name: '我们的家',
    p_display_name: displayName || user.displayName || '家人',
  })
  if (error) return { error: error.message }
  return {}
}

export async function joinFamilyByInvite(
  inviteCode: string,
  displayName: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: '未配置云端' }
  const code = inviteCode.trim().toUpperCase()
  if (!code) return { error: '请填写邀请码' }

  const { data, error } = await supabase.rpc('join_family_for_user', {
    p_invite_code: code,
    p_display_name: displayName,
  })
  if (error) {
    if (error.message.includes('invite_invalid')) return { error: '邀请码无效，请向家人确认' }
    return { error: error.message }
  }
  const familyId = (data as { family_id?: string } | null)?.family_id
  if (!familyId) return { error: '邀请码无效，请向家人确认' }
  return {}
}

export async function updateProfile(input: {
  displayName?: string
  avatarUrl?: string | null
}): Promise<{ error?: string; warning?: string }> {
  if (!supabase) {
    const store = loadStore()
    saveStore({
      ...store,
      profile: {
        displayName: input.displayName ?? store.profile.displayName,
        avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : store.profile.avatarUrl ?? null,
      },
    })
    return {}
  }
  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }

  // 头像上传云端 storage；失败降级存本地
  let avatarUrl = input.avatarUrl
  if (avatarUrl && avatarUrl.startsWith('data:')) {
    try {
      const uploaded = await uploadAvatar(avatarUrl, user.id)
      avatarUrl = uploaded.url ?? avatarUrl
    } catch {
      // 云端上传失败，保留 data URL 存本地
    }
  }

  // 本地存一份（离线也能看）
  const store = loadStore()
  saveStore({
    ...store,
    profile: {
      displayName: input.displayName ?? store.profile.displayName,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : store.profile.avatarUrl ?? null,
    },
  })

  // 写云端 family_member（全家同步）
  const updateRow: Record<string, unknown> = {}
  if (input.displayName !== undefined) updateRow.display_name = input.displayName
  if (avatarUrl !== undefined) updateRow.avatar_url = avatarUrl
  if (Object.keys(updateRow).length) {
    try {
      const { error } = await supabase
        .from('family_member')
        .update(updateRow)
        .eq('family_id', user.familyId)
        .eq('user_id', user.id)
      if (error) return { error: error.message }
    } catch {
      // 缺列降级：头像只存本地
      return { warning: '头像已本地保存，云端同步失败' }
    }
  }
  return {}
}

export async function updateDisplayName(displayName: string): Promise<{ error?: string }> {
  return updateProfile({ displayName })
}

export async function loadData(): Promise<AppData> {
  if (!supabase) {
    const store = loadStore()
    return {
      mode: 'local',
      user: localUser(store),
      babies: store.babies,
      events: store.events,
      currentBabyId: store.currentBabyId,
      displayName: store.profile.displayName,
      avatarUrl: store.profile.avatarUrl ?? null,
    }
  }

  const user = await getSessionUser()
  const localProfile = loadStore().profile
  if (!user?.familyId) {
    return {
      mode: 'cloud',
      user,
      babies: [],
      events: [],
      currentBabyId: null,
      displayName: user?.displayName ?? '家人',
      avatarUrl: user?.avatarUrl ?? localProfile.avatarUrl ?? null,
    }
  }

  const [babiesRes, eventsRes] = await Promise.all([
    supabase
      .from('baby')
      // 用 * 全字段查询：数据库缺列时 select 列表报错会导致宝宝列表整个消失
      .select('*')
      .eq('family_id', user.familyId)
      .order('created_at', { ascending: true }),
    supabase
      .from('event')
      .select('*')
      .eq('family_id', user.familyId)
      .order('start_at', { ascending: false })
      .limit(500),
  ])

  const babies = (babiesRes.data ?? []).map(mapBaby)
  const events = (eventsRes.data ?? []).map(mapEvent)
  const currentBabyId = babies[0]?.id ?? null

  return {
    mode: 'cloud',
    user,
    babies,
    events,
    currentBabyId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? localProfile.avatarUrl ?? null,
  }
}

async function localPatch(fn: (store: AppStore) => AppStore): Promise<void> {
  saveStore(fn(loadStore()))
}

export async function addBaby(input: {
  name: string
  avatarColor: string
  avatarUrl?: string | null
  birthDate?: string | null
  gender?: 'boy' | 'girl' | null
  weightKg?: number | null
  heightCm?: number | null
}): Promise<{ baby?: Baby; error?: string; warning?: string }> {
  if (!supabase) {
    const baby: Baby = {
      id: uid(),
      name: input.name,
      avatarColor: input.avatarColor,
      avatarUrl: input.avatarUrl ?? null,
      birthDate: input.birthDate ?? null,
      gender: input.gender ?? null,
      weightKg: input.weightKg ?? null,
      heightCm: input.heightCm ?? null,
      createdAt: nowIso(),
    }
    await localPatch((s) => ({
      ...s,
      babies: [...s.babies, baby],
      currentBabyId: baby.id,
    }))
    return { baby }
  }

  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const client = supabase

  let avatarUrl = input.avatarUrl ?? null
  if (avatarUrl && avatarUrl.startsWith('data:')) {
    const uploaded = await uploadAvatar(avatarUrl, user.id)
    if (uploaded.url) avatarUrl = uploaded.url
  }

  const row: Record<string, unknown> = {
    family_id: user.familyId,
    name: input.name,
    avatar_color: input.avatarColor,
    avatar_url: avatarUrl,
  }
  // 只有真填了才写入，避免数据库缺列时全挂
  if (input.birthDate) row.birth_date = input.birthDate
  if (input.gender) row.gender = input.gender
  if (input.weightKg != null) row.weight_kg = input.weightKg
  if (input.heightCm != null) row.height_cm = input.heightCm

  const tryInsert = (r: Record<string, unknown>) =>
    client.from('baby').insert(r).select('*').single()

  const { data, error } = await tryInsert(row)
  if (error) {
    // 数据库缺列时降级：去掉新字段重试，保住基本保存
    const extraKeys = ['birth_date', 'gender', 'weight_kg', 'height_cm']
    const hasExtra = extraKeys.some((k) => k in row)
    if (hasExtra) {
      const base: Record<string, unknown> = { ...row }
      for (const k of extraKeys) delete base[k]
      const retry = await tryInsert(base)
      if (retry.data) {
        return {
          baby: mapBaby(retry.data),
          warning: '基本资料已保存，但性别/体重/身高未存上：数据库需补字段',
        }
      }
    }
    return { error: error.message }
  }
  return { baby: mapBaby(data) }
}

export async function updateBaby(
  id: string,
  input: {
    name: string
    avatarColor: string
    avatarUrl?: string | null
    birthDate?: string | null
    gender?: 'boy' | 'girl' | null
    weightKg?: number | null
    heightCm?: number | null
  },
): Promise<{ baby?: Baby; error?: string; warning?: string }> {
  if (!supabase) {
    await localPatch((s) => ({
      ...s,
      babies: s.babies.map((b) =>
        b.id === id
          ? {
              ...b,
              name: input.name,
              avatarColor: input.avatarColor,
              avatarUrl: input.avatarUrl ?? null,
              birthDate: input.birthDate ?? null,
              gender: input.gender ?? null,
              weightKg: input.weightKg ?? null,
              heightCm: input.heightCm ?? null,
            }
          : b,
      ),
    }))
    return { baby: undefined }
  }

  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const client = supabase

  let avatarUrl = input.avatarUrl ?? null
  if (avatarUrl && avatarUrl.startsWith('data:')) {
    const uploaded = await uploadAvatar(avatarUrl, user.id)
    if (uploaded.url) avatarUrl = uploaded.url
  }

  const row: Record<string, unknown> = {
    name: input.name,
    avatar_color: input.avatarColor,
    avatar_url: avatarUrl,
    updated_at: nowIso(),
  }
  if (input.birthDate !== undefined) row.birth_date = input.birthDate
  if (input.gender !== undefined) row.gender = input.gender
  if (input.weightKg !== undefined) row.weight_kg = input.weightKg
  if (input.heightCm !== undefined) row.height_cm = input.heightCm

  const tryUpdate = (r: Record<string, unknown>) =>
    client
      .from('baby')
      .update(r)
      .eq('id', id)
      .eq('family_id', user.familyId)
      .select('*')
      .single()

  const { data, error } = await tryUpdate(row)
  if (error) {
    // 数据库缺列时降级：去掉新字段重试
    const extraKeys = ['birth_date', 'gender', 'weight_kg', 'height_cm']
    const hasExtra = extraKeys.some((k) => k in row)
    if (hasExtra) {
      const base: Record<string, unknown> = { ...row }
      for (const k of extraKeys) delete base[k]
      const retry = await tryUpdate(base)
      if (retry.data) {
        return {
          baby: mapBaby(retry.data),
          warning: '基本资料已保存，但性别/体重/身高未存上：数据库需补字段',
        }
      }
    }
    return { error: error.message }
  }
  return { baby: mapBaby(data) }
}

export async function deleteBaby(id: string): Promise<{ error?: string }> {
  if (!supabase) {
    await localPatch((s) => {
      const babies = s.babies.filter((b) => b.id !== id)
      return {
        ...s,
        babies,
        events: s.events.filter((e) => e.babyId !== id),
        currentBabyId: babies[0]?.id ?? null,
      }
    })
    return {}
  }
  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const { error } = await supabase
    .from('baby')
    .delete()
    .eq('id', id)
    .eq('family_id', user.familyId)
  return error ? { error: error.message } : {}
}

export async function saveEvent(
  payload: {
    type: EventType
    startAt: string
    endAt?: string | null
    amountMl?: number | null
    note?: string | null
    photoUrl?: string | null
    createdBy?: string
    babyId?: string
    id?: string
  },
  currentBabyId: string | null,
  displayName: string,
): Promise<{ event?: BabyEvent; error?: string; warning?: string }> {
  const babyId = payload.babyId || currentBabyId
  if (!babyId) return { error: '请先添加宝宝' }

  if (!supabase) {
    if (payload.id) {
      await localPatch((s) => ({
        ...s,
        events: s.events.map((e) =>
          e.id === payload.id
            ? {
                ...e,
                type: payload.type,
                startAt: payload.startAt,
                endAt: payload.endAt ?? null,
                amountMl: payload.amountMl ?? null,
                note: payload.note ?? null,
                photoUrl: payload.photoUrl ?? null,
              }
            : e,
        ),
      }))
      return {}
    }
    const ev: BabyEvent = {
      id: uid(),
      babyId,
      type: payload.type,
      startAt: payload.startAt,
      endAt: payload.endAt ?? null,
      amountMl: payload.amountMl ?? null,
      note: payload.note ?? null,
      photoUrl: payload.photoUrl ?? null,
      createdBy: payload.createdBy || displayName,
      createdAt: nowIso(),
    }
    await localPatch((s) => ({ ...s, events: [ev, ...s.events] }))
    return { event: ev }
  }

  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const client = supabase

  const body: Record<string, unknown> = {
    family_id: user.familyId,
    baby_id: babyId,
    type: payload.type,
    start_at: payload.startAt,
    end_at: payload.endAt ?? null,
    amount_ml: payload.amountMl ?? null,
    note: payload.note ?? null,
    created_by: payload.createdBy || displayName,
    updated_at: nowIso(),
  }
  // 只有真有照片才带 photo_url：数据库未加列时，普通记录不受影响
  if (payload.photoUrl) body.photo_url = payload.photoUrl

  const run = () => {
    if (payload.id) {
      return client
        .from('event')
        .update(body)
        .eq('id', payload.id)
        .eq('family_id', user.familyId)
        .select('*')
        .single()
    }
    return client.from('event').insert(body).select('*').single()
  }

  const { data, error } = await run()
  if (error) {
    // photo_url 列尚未迁移时降级：先保住记录，再提示迁移
    if (payload.photoUrl && 'photo_url' in body) {
      delete body.photo_url
      const retry = await run()
      if (retry.data) {
        return {
          event: mapEvent(retry.data),
          warning: '记录已保存，但照片没存上：数据库需补 photo_url 字段',
        }
      }
    }
    return { error: error.message }
  }
  return { event: mapEvent(data) }
}

export async function deleteEvent(id: string): Promise<{ error?: string }> {
  if (!supabase) {
    await localPatch((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }))
    return {}
  }
  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const { error } = await supabase
    .from('event')
    .delete()
    .eq('id', id)
    .eq('family_id', user.familyId)
  return error ? { error: error.message } : {}
}

export async function uploadAvatar(
  dataUrl: string,
  userId: string,
): Promise<{ url?: string | null; error?: string }> {
  if (!supabase) return { url: dataUrl }
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const ext = blob.type.includes('png') ? 'png' : 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    })
    if (error) return { error: error.message }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '上传失败' }
  }
}

export function subscribeFamily(
  familyId: string,
  onChange: () => void,
): () => void {
  const client = supabase
  if (!client || familyId === 'local-family') return () => {}
  const channel = client
    .channel(`family-${familyId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'event', filter: `family_id=eq.${familyId}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'baby', filter: `family_id=eq.${familyId}` },
      () => onChange(),
    )
    .subscribe((status) => {
      // 连上后先拉一次，避免订阅成功前已有更新
      if (status === 'SUBSCRIBED') onChange()
    })
  return () => {
    client.removeChannel(channel)
  }
}

// ===== 每日小结缓存（全家共享）=====

const SUMMARY_KEY = 'baby-tracker-summaries'

function loadLocalSummaries(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SUMMARY_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveLocalSummaries(map: Record<string, string>) {
  try {
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export async function getDailySummary(
  babyId: string,
  dayKey: string,
): Promise<{ text?: string; error?: string }> {
  if (!supabase) {
    const map = loadLocalSummaries()
    return { text: map[`${babyId}:${dayKey}`] }
  }
  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const { data, error } = await supabase
    .from('daily_summary')
    .select('text')
    .eq('baby_id', babyId)
    .eq('day_key', dayKey)
    .maybeSingle()
  if (error) return { error: error.message }
  return { text: data?.text ?? undefined }
}

export async function saveDailySummary(
  babyId: string,
  dayKey: string,
  text: string,
): Promise<{ error?: string }> {
  if (!supabase) {
    const map = loadLocalSummaries()
    map[`${babyId}:${dayKey}`] = text
    saveLocalSummaries(map)
    return {}
  }
  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const { error } = await supabase
    .from('daily_summary')
    .upsert(
      {
        family_id: user.familyId,
        baby_id: babyId,
        day_key: dayKey,
        text,
        created_by: user.displayName,
      },
      { onConflict: 'baby_id,day_key' },
    )
  return error ? { error: error.message } : {}
}

// ===== 成长记录（身高体重）=====

const GROWTH_KEY = 'baby-tracker-growth'

type GrowthRow = {
  id: string
  baby_id: string
  day_key: string
  weight_kg?: number | null
  height_cm?: number | null
  note?: string | null
  created_by?: string | null
  created_at: string
}

function mapGrowth(row: GrowthRow): GrowthRecord {
  return {
    id: row.id,
    babyId: row.baby_id,
    dateKey: row.day_key,
    weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
    heightCm: row.height_cm != null ? Number(row.height_cm) : null,
    note: row.note ?? null,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
  }
}

function loadLocalGrowth(): GrowthRecord[] {
  try {
    return JSON.parse(localStorage.getItem(GROWTH_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLocalGrowth(records: GrowthRecord[]) {
  try {
    localStorage.setItem(GROWTH_KEY, JSON.stringify(records))
  } catch {
    // ignore
  }
}

export async function getGrowthRecords(
  babyId: string,
): Promise<{ records?: GrowthRecord[]; error?: string }> {
  if (!supabase) {
    return { records: loadLocalGrowth().filter((g) => g.babyId === babyId) }
  }
  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const { data, error } = await supabase
    .from('growth')
    .select('*')
    .eq('baby_id', babyId)
    .order('day_key', { ascending: true })
  if (error) return { error: error.message }
  return { records: (data ?? []).map(mapGrowth) }
}

export async function saveGrowthRecord(input: {
  babyId: string
  dateKey: string
  weightKg?: number | null
  heightCm?: number | null
  note?: string | null
}): Promise<{ error?: string; warning?: string }> {
  if (!supabase) {
    const records = loadLocalGrowth().filter(
      (g) => !(g.babyId === input.babyId && g.dateKey === input.dateKey),
    )
    records.push({
      id: uid(),
      babyId: input.babyId,
      dateKey: input.dateKey,
      weightKg: input.weightKg ?? null,
      heightCm: input.heightCm ?? null,
      note: input.note ?? null,
      createdBy: '',
      createdAt: nowIso(),
    })
    saveLocalGrowth(records)
    return {}
  }
  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const row: Record<string, unknown> = {
    family_id: user.familyId,
    baby_id: input.babyId,
    day_key: input.dateKey,
    updated_at: nowIso(),
    created_by: user.displayName,
  }
  if (input.weightKg != null) row.weight_kg = input.weightKg
  if (input.heightCm != null) row.height_cm = input.heightCm
  if (input.note) row.note = input.note

  // upsert：同一天重复记录就更新
  const client = supabase
  const trySave = (r: Record<string, unknown>) =>
    client.from('growth').upsert(r, { onConflict: 'baby_id,day_key' }).select('*')

  const { error } = await trySave(row)
  if (error) {
    // 数据库缺列降级
    if ('weight_kg' in row || 'height_cm' in row) {
      const base: Record<string, unknown> = { ...row }
      delete base.weight_kg
      delete base.height_cm
      const retry = await trySave(base)
      if (!retry.error) return { warning: '记录已保存，但体重/身高未存上' }
    }
    return { error: error.message }
  }
  return {}
}

export async function deleteGrowthRecord(id: string): Promise<{ error?: string }> {
  if (!supabase) {
    saveLocalGrowth(loadLocalGrowth().filter((g) => g.id !== id))
    return {}
  }
  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const { error } = await supabase
    .from('growth')
    .delete()
    .eq('id', id)
    .eq('family_id', user.familyId)
  return error ? { error: error.message } : {}
}

export { emptyStore }
