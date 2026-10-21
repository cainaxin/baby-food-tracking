import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function git(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

/** 取 CHANGELOG 里第一段版本说明（标题到下一个 --- 或 ##） */
function extractReleaseNotes() {
  const text = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##\s+/.test(l))
  if (start < 0) return ''
  const out = []
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (i > start && (/^##\s+/.test(line) || line.trim() === '---')) break
    out.push(line)
  }
  return out.join('\n').trim()
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const info = {
  version: pkg.version,
  commit: git('git rev-parse --short HEAD') || 'dev',
  commitTime: git('git log -1 --format=%cI') || '',
  buildTime: new Date().toISOString(),
  releaseNotes: extractReleaseNotes(),
}

const outDir = join(root, 'src', 'generated')
mkdirSync(outDir, { recursive: true })
const file = join(outDir, 'buildInfo.ts')
const body = `// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = ${JSON.stringify(info, null, 2)} as const
`
writeFileSync(file, body)
console.log(`buildInfo: v${info.version} ${info.commit} @ ${info.buildTime}`)
