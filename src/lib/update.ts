import { buildInfo } from '../generated/buildInfo'

const REPO = 'cainaxin/baby-food-tracking'

/** 最新 APK 固定下载地址（Release 上传 baby-food-tracker-latest.apk 别名） */
export const LATEST_APK_URL = `https://github.com/${REPO}/releases/latest/download/baby-food-tracker-latest.apk`
/** Release 页面（APK 下载失败时的兜底入口） */
export const RELEASES_PAGE_URL = `https://github.com/${REPO}/releases/latest`

export type UpdateCheckResult = {
  hasUpdate: boolean
  version: string
  notes: string
  /** APK 下载地址（GitHub Release 资产） */
  apkUrl: string | null
}

/** 比较 vX.Y.Z，返回 a 是否比 b 新 */
function isNewer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false
  }
  return false
}

/**
 * 检查 GitHub Release 是否有新版本。
 * 只读公开 API，无需鉴权。
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const current = buildInfo.version
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rel = await res.json() as {
      tag_name?: string
      body?: string
      assets?: { name: string; browser_download_url: string }[]
    }
    const tag = rel.tag_name ?? ''
    const apk = rel.assets?.find((a) => a.name.endsWith('.apk'))
    return {
      hasUpdate: isNewer(tag, current),
      version: tag,
      notes: rel.body ?? '',
      apkUrl: apk?.browser_download_url ?? null,
    }
  } catch {
    // 网络不通或 GitHub 不可达：当作无更新，不打扰用户
    return { hasUpdate: false, version: current, notes: '', apkUrl: null }
  }
}
