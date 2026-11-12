#!/usr/bin/env node
// 发版脚本：打包 dist + APK，创建 GitHub Release 并上传双资产。
// 用法：node scripts/release.mjs v0.4.5 "描述文字"
// 凭据：从 git credential fill 取 token（与 git push 同一套凭据）。
// 注意：所有 HTTP body 用 UTF-8 编码，避免 PowerShell 发 Release 描述中文变问号。

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [tag, description] = process.argv.slice(2)

if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error('用法: node scripts/release.mjs v0.4.5 "描述"')
  process.exit(1)
}

const repo = 'cainaxin/baby-food-tracking'
const ver = tag.replace(/\./g, '-')
const tarName = `baby-dist-${ver}.tar.gz`
const apkName = `baby-food-tracker-${tag}.apk`
const apkLatestName = 'baby-food-tracker-latest.apk'

function sh(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: 'inherit' })
}

function shCapture(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()
}

// 1. 构建网页版 dist + 打包
console.log('▸ 构建网页版 dist…')
sh('npm run build')
console.log(`▸ 打包 ${tarName}…`)
shCapture(`tar -czf ${tarName} -C dist .`)

// 2. 构建安卓 APK（BUILD_NATIVE=1，无 Service Worker）
console.log('▸ 构建安卓 APK…')
sh('node scripts/sync-android-version.mjs')
sh('npm run build:native')
sh('npx cap sync android')
sh('build-apk.bat')
const apkSrc = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
if (!existsSync(apkSrc)) {
  console.error('APK 未生成:', apkSrc)
  process.exit(1)
}
copyFileSync(apkSrc, join(root, apkName))
console.log(`  ${apkName} (${statSync(join(root, apkName)).size} bytes)`)

// 3. 取 GitHub token（与 git push 同一套凭据）
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

// 4. 创建/更新 Release（body 用 UTF-8 字节，中文才不会变问号）
// tag 重复跑脚本时先取已有 Release，避免 422 already_exists
console.log(`▸ 获取/创建 Release ${tag}…`)
let release = null
const getRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers })
if (getRes.ok) {
  release = await getRes.json()
  console.log(`  已存在 release_id=${release.id}，更新描述`)
  const upd = await fetch(`https://api.github.com/repos/${repo}/releases/${release.id}`, {
    method: 'PATCH',
    headers,
    body: new TextEncoder().encode(JSON.stringify({ body: description || tag })),
  })
  if (!upd.ok) {
    console.error('更新 Release 失败:', upd.status, await upd.text())
    process.exit(1)
  }
} else {
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
  release = await releaseRes.json()
}
console.log(`  release_id=${release.id}`)

// 删除已有同名资产，避免重复上传冲突
const listRes = await fetch(`https://api.github.com/repos/${repo}/releases/${release.id}/assets`, { headers })
const existing = listRes.ok ? await listRes.json() : []
for (const a of existing) {
  if ([tarName, apkName, apkLatestName].includes(a.name)) {
    console.log(`  删除旧资产 ${a.name}`)
    await fetch(`https://api.github.com/repos/${repo}/releases/assets/${a.id}`, {
      method: 'DELETE',
      headers,
    })
  }
}

// 5. 上传双资产
const assets = [
  { name: tarName, type: 'application/gzip' },
  { name: apkName, type: 'application/vnd.android.package-archive' },
  // latest 别名：网页「下载 APK」按钮固定指到这里，永远指向最新版
  { name: apkLatestName, type: 'application/vnd.android.package-archive' },
]
for (const asset of assets) {
  console.log(`▸ 上传 ${asset.name}…`)
  // latest 别名复用同一 APK 字节
  const bytes = readFileSync(join(root, asset.name === apkLatestName ? apkName : asset.name))
  const uploadRes = await fetch(
    `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${asset.name}`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'baby-dist-deploy',
        'Content-Type': asset.type,
      },
      body: bytes,
    },
  )
  if (!uploadRes.ok) {
    console.error('上传失败:', uploadRes.status, await uploadRes.text())
    process.exit(1)
  }
  const uploaded = await uploadRes.json()
  console.log(`  ${uploaded.name} (${statSync(join(root, asset.name)).size} bytes)`)
  console.log(`  ${uploaded.browser_download_url}`)
}
console.log('✓ 发版完成（网页包 + APK 双资产）')
