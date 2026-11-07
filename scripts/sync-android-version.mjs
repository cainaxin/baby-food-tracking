#!/usr/bin/env node
// 把 package.json 的 version 同步到 android/app/build.gradle 的 versionName/versionCode。
// versionCode = major*10000 + minor*100 + patch（如 0.8.0 → 800）。

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
if (!m) {
  console.error('package.json version 格式不对:', version)
  process.exit(1)
}
const versionCode = Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3])

const gradlePath = join(root, 'android', 'app', 'build.gradle')
let text = readFileSync(gradlePath, 'utf8')
const next = text
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)
if (next === text && text.includes(`versionName "${version}"`)) {
  console.log(`android version 已是 ${version} (code ${versionCode})`)
} else {
  writeFileSync(gradlePath, next, 'utf8')
  console.log(`android versionName=${version} versionCode=${versionCode}`)
}
