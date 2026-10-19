/**
 * 临时联调脚本：验证 Supabase 注册/家庭/宝宝/记录链路
 * 用法: node scripts/smoke-supabase.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'

function loadEnv() {
  const paths = ['.env', '.env.local']
  const out = {}
  for (const p of paths) {
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].trim()
    }
  }
  return out
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)
const email = `babyday.smoke${Date.now()}@gmail.com`
const password = 'smoke-test-123456'
const results = []

function ok(name, detail) {
  results.push({ name, ok: true, detail })
  console.log('✓', name, detail ?? '')
}
function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.error('✗', name, detail ?? '')
}

const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
  email,
  password,
})
if (signUpErr || !signUpData.user) {
  fail('注册', signUpErr?.message || JSON.stringify(signUpData))
  process.exit(1)
}
ok('注册', email)

// 若开启邮箱确认，user 可能存在但 session 为空；尝试直接登录
let session = signUpData.session
if (!session) {
  const { data: signInData, error: signInErr } =
    await supabase.auth.signInWithPassword({ email, password })
  if (signInErr || !signInData.session) {
    fail('登录', signInErr?.message || '无 session（可能需关闭 Confirm email）')
    process.exit(1)
  }
  session = signInData.session
  ok('登录', 'password')
} else {
  ok('注册即登录', '')
}

const inviteCode = `SMK${Date.now().toString(36).slice(-4).toUpperCase()}`
const { data: family, error: famErr } = await supabase
  .from('family')
  .insert({ name: '测试家庭', invite_code: inviteCode })
  .select('id, invite_code')
  .single()
if (famErr || !family) {
  fail('创建家庭', famErr?.message)
  process.exit(1)
}
ok('创建家庭', `invite=${family.invite_code}`)

const { error: memErr } = await supabase.from('family_member').insert({
  family_id: family.id,
  user_id: signUpData.user.id,
  display_name: '测试员',
  role: 'admin',
})
if (memErr) {
  fail('加入成员', memErr.message)
  process.exit(1)
}
ok('加入成员', '')

const { data: baby, error: babyErr } = await supabase
  .from('baby')
  .insert({
    family_id: family.id,
    name: '测试宝',
    avatar_color: '#0A84FF',
  })
  .select('id,name')
  .single()
if (babyErr || !baby) {
  fail('添加宝宝', babyErr?.message)
  process.exit(1)
}
ok('添加宝宝', baby.name)

const { data: event, error: evErr } = await supabase
  .from('event')
  .insert({
    family_id: family.id,
    baby_id: baby.id,
    type: 'milk',
    start_at: new Date().toISOString(),
    amount_ml: 120,
    note: 'smoke',
    created_by: '测试员',
  })
  .select('id,type,amount_ml')
  .single()
if (evErr || !event) {
  fail('写入吃奶记录', evErr?.message)
  process.exit(1)
}
ok('写入吃奶记录', `${event.amount_ml}ml`)

const { data: events, error: listErr } = await supabase
  .from('event')
  .select('*')
  .eq('family_id', family.id)
if (listErr) {
  fail('读取记录', listErr.message)
} else if (!events?.length) {
  fail('读取记录', '列表为空')
} else {
  ok('读取记录', `count=${events.length}`)
}

const { error: upErr } = await supabase
  .from('event')
  .update({ amount_ml: 150 })
  .eq('id', event.id)
if (upErr) fail('编辑记录', upErr.message)
else ok('编辑记录', '150ml')

const { error: delErr } = await supabase.from('event').delete().eq('id', event.id)
if (delErr) fail('删除记录', delErr.message)
else ok('删除记录', '')

// Realtime 频道能否订阅
const channel = supabase
  .channel('smoke-realtime')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'event', filter: `family_id=eq.${family.id}` },
    () => {},
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      ok('Realtime 订阅', status)
      supabase.removeChannel(channel)
      const failed = results.filter((r) => !r.ok)
      console.log('\n---')
      if (failed.length) {
        console.error(`失败 ${failed.length} 项`)
        process.exit(1)
      }
      console.log('全部通过')
      process.exit(0)
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      fail('Realtime 订阅', status)
      process.exit(1)
    }
  })

setTimeout(() => {
  fail('Realtime 订阅', 'timeout')
  process.exit(1)
}, 15000)
