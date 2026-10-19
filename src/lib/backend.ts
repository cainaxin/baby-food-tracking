import type { Baby, BabyEvent, EventType } from '../types'
import { emptyStore, loadStore, saveStore, uid, type AppStore } from './store'
import { nowIso } from './time'
import { isCloudConfigured, supabase } from './supabase'

export { isCloudConfigured }

export type SessionUser = {
  id: string
  email: string
  displayName: string
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
  created_by?: string | null
  created_at: string
}

function mapBaby(row: BabyRow): Baby {
  return {
    id: row.id,
    name: row.name,
    avatarColor: row.avatar_color || '#0A84FF',
    avatarUrl: row.avatar_url || null,
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
    .select('family_id, display_name, created_at')
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

export async function updateDisplayName(displayName: string): Promise<{ error?: string }> {
  if (!supabase) {
    const store = loadStore()
    saveStore({ ...store, profile: { displayName } })
    return {}
  }
  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }
  const { error } = await supabase
    .from('family_member')
    .update({ display_name: displayName })
    .eq('family_id', user.familyId)
    .eq('user_id', user.id)
  return error ? { error: error.message } : {}
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
    }
  }

  const user = await getSessionUser()
  if (!user?.familyId) {
    return {
      mode: 'cloud',
      user,
      babies: [],
      events: [],
      currentBabyId: null,
      displayName: user?.displayName ?? '家人',
    }
  }

  const [babiesRes, eventsRes] = await Promise.all([
    supabase
      .from('baby')
      .select('id,name,avatar_color,avatar_url,created_at')
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
  }
}

async function localPatch(fn: (store: AppStore) => AppStore): Promise<void> {
  saveStore(fn(loadStore()))
}

export async function addBaby(input: {
  name: string
  avatarColor: string
  avatarUrl?: string | null
}): Promise<{ baby?: Baby; error?: string }> {
  if (!supabase) {
    const baby: Baby = {
      id: uid(),
      name: input.name,
      avatarColor: input.avatarColor,
      avatarUrl: input.avatarUrl ?? null,
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

  let avatarUrl = input.avatarUrl ?? null
  if (avatarUrl && avatarUrl.startsWith('data:')) {
    const uploaded = await uploadAvatar(avatarUrl, user.id)
    if (uploaded.url) avatarUrl = uploaded.url
  }

  const { data, error } = await supabase
    .from('baby')
    .insert({
      family_id: user.familyId,
      name: input.name,
      avatar_color: input.avatarColor,
      avatar_url: avatarUrl,
    })
    .select('id,name,avatar_color,avatar_url,created_at')
    .single()
  if (error) return { error: error.message }
  return { baby: mapBaby(data) }
}

export async function updateBaby(
  id: string,
  input: { name: string; avatarColor: string; avatarUrl?: string | null },
): Promise<{ baby?: Baby; error?: string }> {
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
            }
          : b,
      ),
    }))
    return { baby: undefined }
  }

  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }

  let avatarUrl = input.avatarUrl ?? null
  if (avatarUrl && avatarUrl.startsWith('data:')) {
    const uploaded = await uploadAvatar(avatarUrl, user.id)
    if (uploaded.url) avatarUrl = uploaded.url
  }

  const { data, error } = await supabase
    .from('baby')
    .update({
      name: input.name,
      avatar_color: input.avatarColor,
      avatar_url: avatarUrl,
      updated_at: nowIso(),
    })
    .eq('id', id)
    .eq('family_id', user.familyId)
    .select('id,name,avatar_color,avatar_url,created_at')
    .single()
  if (error) return { error: error.message }
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
    createdBy?: string
    babyId?: string
    id?: string
  },
  currentBabyId: string | null,
  displayName: string,
): Promise<{ event?: BabyEvent; error?: string }> {
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
      createdBy: payload.createdBy || displayName,
      createdAt: nowIso(),
    }
    await localPatch((s) => ({ ...s, events: [ev, ...s.events] }))
    return { event: ev }
  }

  const user = await getSessionUser()
  if (!user?.familyId) return { error: '未加入家庭' }

  const body = {
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

  if (payload.id) {
    const { data, error } = await supabase
      .from('event')
      .update(body)
      .eq('id', payload.id)
      .eq('family_id', user.familyId)
      .select('*')
      .single()
    if (error) return { error: error.message }
    return { event: mapEvent(data) }
  }

  const { data, error } = await supabase
    .from('event')
    .insert(body)
    .select('*')
    .single()
  if (error) return { error: error.message }
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

export { emptyStore }
