#!/usr/bin/env node
// 发版脚本：打包 dist 并创建 GitHub Release + 上传资产。
// 用法：node scripts/release.mjs v0.4.5 "描述文字"
// 凭据：从 git credential fill 取 token（与 git push 同一套凭据）。
// 注意：所有 HTTP body 用 UTF-8 编码，避免 PowerShell 发 Release 描述中文变问号。

import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [tag, description] = process.argv.slice(2)

if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error('用法: node scripts/release.mjs v0.4.5 "描述"')
  process.exit(1)
}

const repo = 'cainaxin/baby-food-tracking'
const tarName = `baby-dist-${tag.replace(/\./g, '-')}.tar.gz`

function sh(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()
}

// 1. 构建 + 打包
console.log('▸ 构建 dist…')
sh('npm run build')
console.log(`▸ 打包 ${tarName}…`)
sh(`tar -czf ${tarName} -C dist .`)

// 2. 取 GitHub token（与 git push 同一套凭据）
const cred = execSync('git credential fill', {
  cwd: root,
  encoding: 'utf8',
  input: 'protocol=https\nhost=github.com\n',
})
const token = /password=(.+)/.exec(cred)?.[1]?.trim()
if (!token) {
  console.error('未取到 GitHub token，请先 git push 一次让凭据入库')
  process.exit(1)
}

const headers = {
  Authorization: `token ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'baby-dist-deploy',
  'Content-Type': 'application/json; charset=utf-8',
}

// 3. 创建 Release（body 用 UTF-8 字节，中文才不会变问号）
console.log(`▸ 创建 Release ${tag}…`)
const releaseBody = JSON.stringify({
  tag_name: tag,
  target_commitish: 'main',
  name: tag,
  body: description || tag,
})
const releaseRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
  method: 'POST',
  headers,
  body: new TextEncoder().encode(releaseBody),
})
if (!releaseRes.ok) {
  console.error('创建 Release 失败:', releaseRes.status, await releaseRes.text())
  process.exit(1)
}
const release = await releaseRes.json()
console.log(`  release_id=${release.id}`)

// 4. 上传资产
console.log(`▸ 上传 ${tarName}…`)
const bytes = readFileSync(join(root, tarName))
const uploadRes = await fetch(
  `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${tarName}`,
  {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'baby-dist-deploy',
      'Content-Type': 'application/gzip',
    },
    body: bytes,
  },
)
if (!uploadRes.ok) {
  console.error('上传失败:', uploadRes.status, await uploadRes.text())
  process.exit(1)
}
const asset = await uploadRes.json()
console.log(`  ${asset.name} (${statSync(join(root, tarName)).size} bytes)`)
console.log(`  ${asset.browser_download_url}`)
console.log('✓ 发版完成')
