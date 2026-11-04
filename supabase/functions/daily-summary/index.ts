// Supabase Edge Function: daily-summary
// 调用 DeepSeek 生成每日总结。DEEPSEEK_API_KEY 存在 Supabase 环境变量里，前端永远看不到。
//
// 部署：
//   supabase functions deploy daily-summary --no-verify-jwt
//   supabase secrets set DEEPSEEK_API_KEY=sk-xxxx
//
// 安全：只做转发，不暴露 key；有基本的入参校验。

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const ALLOWED_ORIGIN = '*'

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) {
    return json({ error: 'AI 服务未配置' }, 500)
  }

  let prompt: string
  try {
    const body = await req.json()
    prompt = body?.prompt
    if (!prompt || typeof prompt !== 'string' || prompt.length > 4000) {
      return json({ error: '参数不合法' }, 400)
    }
  } catch {
    return json({ error: '请求格式错误' }, 400)
  }

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // deepseek-flash 是最便宜的模型，支持 thinking
        model: 'deepseek-flash',
        messages: [
          { role: 'system', content: '你是一位温和专业的婴幼儿养育顾问，用中文回答。' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
        thinking: { type: 'enabled' },
        reasoning_effort: 'high',
        stream: false,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('DeepSeek API error', res.status, errText)
      return json({ error: 'AI 服务暂时不可用' }, 502)
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    if (!text) {
      return json({ error: 'AI 返回内容为空' }, 502)
    }

    return json({ text })
  } catch (e) {
    console.error('Edge function error', e)
    return json({ error: 'AI 服务暂时不可用' }, 502)
  }
})

function json(obj: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
