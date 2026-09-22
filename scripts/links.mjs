// scripts/links.mjs — every URL in the README, fetched, plus every image it
// points at inside this repository.
//
// Two URLs are published by work that has not happened yet: the portfolio
// moves to /portfolio/ when the game repository is renamed, and the snake is
// written to the `output` branch the first time its workflow runs. Those are
// reported as PENDING and do not fail the run; anything else that answers 400
// or worse does.
import { existsSync, readFileSync } from 'node:fs'

const PENDING = [
  ['https://naman-gururani.github.io/portfolio/', 'until the game repository is renamed to portfolio'],
  ['https://raw.githubusercontent.com/Naman-Gururani/Naman-Gururani/output/', 'until the snake workflow has run once'],
]

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const urls = [...new Set(readme.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? [])].sort()

// LinkedIn answers 999 — its "you are a robot" code — to any profile URL,
// real or invented, so it can be reported but never actually verified here.
const BLOCKED = new Set([429, 999])

const check = async (url) => {
  // HEAD first — a link check should not pull the body. Some hosts answer 403
  // or 405 to HEAD alone, so fall back to a ranged GET before believing it.
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (head.status < 400) return head.status
    const get = await fetch(url, { method: 'GET', redirect: 'follow', headers: { Range: 'bytes=0-0' } })
    return get.status
  } catch (err) {
    return err.message
  }
}

let failed = 0
for (const url of urls) {
  const pending = PENDING.find(([prefix]) => url.startsWith(prefix))
  const status = await check(url)
  if (typeof status === 'number' && status < 400) console.log(`  ok      ${status}  ${url}`)
  else if (pending) console.log(`  pending ${status}  ${url}  — expected, ${pending[1]}`)
  else if (BLOCKED.has(status)) console.log(`  blocked ${status}  ${url}  — the host refuses robots`)
  else {
    console.log(`  FAIL    ${status}  ${url}`)
    failed++
  }
}

// The images are repo-relative, so no amount of fetching finds a typo in one.
const assets = [
  ...new Set([...readme.matchAll(/(?:src|srcset)="(assets\/[^"]+)"/g)].map((m) => m[1])),
].sort()
for (const asset of assets) {
  if (existsSync(new URL(`../${asset}`, import.meta.url))) console.log(`  ok      file  ${asset}`)
  else {
    console.log(`  FAIL    file  ${asset}  — not in this repository`)
    failed++
  }
}

console.log(`\n${urls.length} links, ${assets.length} local images, ${failed} broken`)
if (failed) process.exitCode = 1
