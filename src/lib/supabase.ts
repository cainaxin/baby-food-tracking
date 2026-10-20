import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// 公开 anon 配置：Vercel 未注入环境变量时的兜底，保证线上能连云
const FALLBACK_URL = 'https://zxlcsmdsgqnsvcqpokdd.supabase.co'
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4bGNzbWRzZ3Fuc3ZjcXBva2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MDU3NjEsImV4cCI6MjEwNzk4MTc2MX0.3waNgu2Dl8kP_ff3oo8IBMTHgiCFCpD8HXyk8KGmx60'

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY

export const isCloudConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
