// scripts/cards.mjs — the profile's stats cards, drawn here rather than fetched.
//
// The public github-readme-stats instance has been paused (503
// DEPLOYMENT_PAUSED) and its mirrors run without tokens, so most profiles are
// currently showing broken images. Everything below is generated inside this
// repo by a scheduled Action and committed as SVG: at view time GitHub serves a
// static file we have already looked at, and nothing can be down.
//
// Three rules hold the file together:
//   1. `streaks`, `langShares` and `cardSVG` are pure and tested. No I/O.
//   2. Writes are atomic across the run — fetch, render every card into memory,
//      and only then touch the disk. A bad day exits non-zero having written
//      nothing, so it can never commit a blank card over a good one.
//   3. No number reaches a card without a label saying what was counted.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { gql, profile, PROFILE_QUERY } from './github.mjs'

// The Printstream palette, the one scripts/art.mjs draws the banner with.
// `accent` is the ramp colour that still reads as text against the page: the
// pale cyan on the dark card, the deeper violet on the light one.
const INK = {
  dark: { bg: '#141313', panel: '#201f1f', text: '#e5e2e1', dim: '#8d8a89', line: '#444748', accent: '#a9e8ff', empty: '#242323', ramp: ['#a9e8ff', '#d9bcff', '#fcd6ff'] },
  light: { bg: '#f4f4f4', panel: '#e4e1e1', text: '#1c1b1b', dim: '#5c5959', line: '#c3c0c0', accent: '#7d4bd0', empty: '#e2dfdf', ramp: ['#2aa7d0', '#7d4bd0', '#b23fc4'] },
}

// GitHub's image proxy will not fetch a font for us, so every stack is generic.
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
const ADV = 0.6 // one monospace character, as a fraction of the font size

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const num = (n) => Number(n).toLocaleString('en-US')
const fit = (s, px, size) => {
  const max = Math.max(1, Math.floor(px / (size * ADV)))
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

const chan = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const mix = (a, b, t) => {
  const from = chan(a)
  const to = chan(b)
  return '#' + from.map((v, i) => Math.round(v + (to[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
/** A point on the holographic ramp: 0 at the first stop, 1 at the last. */
const rampAt = (ramp, t) => {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1)
  const i = Math.min(ramp.length - 2, Math.floor(x))
  return mix(ramp[i], ramp[i + 1], x - i)
}

/**
 * Walk a contribution calendar and report what it actually says.
 *
 * `today` matters because GitHub hands back whole weeks: the rest of this week
 * arrives as zeroes, and a zero on a day that has not finished is not a broken
 * streak. Days after `today` are ignored, a zero on `today` is stepped over,
 * and a zero before that ends the run.
 */
export function streaks(days, today) {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const end = today ?? sorted.at(-1)?.date ?? ''

  let total = 0
  let longest = 0
  let run = 0
  for (const d of sorted) {
    const n = Number(d.contributionCount) || 0
    total += n
    if (n > 0) {
      run += 1
      if (run > longest) longest = run
    } else run = 0
  }

  let current = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    const d = sorted[i]
    if (d.date > end) continue // has not happened yet
    if ((Number(d.contributionCount) || 0) > 0) {
      current += 1
      continue
    }
    if (d.date === end) continue // today is not over either
    break
  }

  return { current, longest, total }
}

/**
 * Bytes per language across the repos someone actually wrote, as percentages
 * that total exactly 100.
 *
 * Takes the flattened shape — { isFork, languages: [{ name, size }] } — so the
 * GraphQL edge/node nesting stays in scripts/github.mjs. Forks are dropped: a
 * forked checkout is not a claim about what anyone writes. Anything past
 * `limit` folds into one honest `Other` slice, and the remainders are handed
 * out largest-first so the rounded shares still add up.
 */
export function langShares(repos, limit = 8) {
  const bytes = new Map()
  for (const r of repos ?? []) {
    if (!r || r.isFork) continue
    for (const l of r.languages ?? []) {
      if (!l?.name) continue
      bytes.set(l.name, (bytes.get(l.name) ?? 0) + (Number(l.size) || 0))
    }
  }

  const total = [...bytes.values()].reduce((a, b) => a + b, 0)
  if (total <= 0) return []

  const ranked = [...bytes].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  const kept = ranked.slice(0, limit).map(([name, size]) => ({ name, size }))
  const rest = ranked.slice(limit).reduce((a, [, size]) => a + size, 0)
  if (rest > 0) kept.push({ name: 'Other', size: rest })

  // Largest remainder, counted in tenths of a percent, so the column totals 100.
  const exact = kept.map((k) => (k.size / total) * 1000)
  const tenths = exact.map((v) => Math.floor(v))
  let left = 1000 - tenths.reduce((a, b) => a + b, 0)
  const order = exact.map((v, i) => [v - tenths[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (let i = 0; left > 0; i = (i + 1) % order.length, left--) tenths[order[i][1]] += 1

  return kept.map((k, i) => ({ name: k.name, size: k.size, pct: tenths[i] / 10 }))
}

/**
 * One card: the frame, the mono title, the serial in the corner, a drifting
 * holographic rule, and whichever of `rows` / `body` / `footer` it was given.
 * 420x200 unless asked otherwise — the heatmap asks for 840.
 */
export function cardSVG(spec, pal = 'dark') {
  const theme = typeof pal === 'string' ? pal : 'dark'
  const ink = typeof pal === 'string' ? INK[pal] ?? INK.dark : pal
  const w = spec.width ?? 420
  const h = spec.height ?? 200
  const pad = spec.pad ?? 20
  const title = spec.title ?? ''
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'card'
  const id = (s) => `${s}-${slug}-${theme}`
  const ruleW = w - pad * 2
  const rows = spec.rows ?? []

  const alt = spec.alt ?? [title, ...rows.map(([k, v]) => `${k}: ${v}`), spec.footer ?? ''].filter(Boolean).join('. ')
  const serial = spec.serial ?? title.slice(0, 2).toUpperCase()

  // Rows: a ramp dot, a label that says what was counted, the number right-
  // aligned, and a hairline under everything but the last.
  const top = 78
  const bottom = 162
  const gap = rows.length > 1 ? Math.min(30, (bottom - top) / (rows.length - 1)) : 0
  const rowSVG = rows
    .map(([label, value], i) => {
      const y = Number((top + gap * i).toFixed(1))
      const vw = String(value).length * 15 * ADV
      const dot = rampAt(ink.ramp, rows.length > 1 ? i / (rows.length - 1) : 0)
      return (
        `<rect x="${pad}" y="${y - 8}" width="7" height="7" rx="1.5" fill="${dot}"/>` +
        `<text x="${pad + 15}" y="${y}" font-family="${MONO}" font-size="11.5" fill="${ink.dim}">${esc(fit(String(label), ruleW - 15 - vw - 18, 11.5))}</text>` +
        `<text x="${w - pad}" y="${y}" text-anchor="end" font-family="${MONO}" font-size="15" font-weight="600" fill="${ink.text}">${esc(value)}</text>` +
        (i < rows.length - 1 ? `<rect x="${pad}" y="${(y + gap / 2 - 5).toFixed(1)}" width="${ruleW}" height="1" fill="${ink.line}" opacity="0.45"/>` : '')
      )
    })
    .join('\n')

  const footer = spec.footer
    ? `<text x="${pad}" y="${h - 14}" font-family="${MONO}" font-size="9" letter-spacing="0.02em" fill="${ink.dim}">${esc(fit(spec.footer, spec.footerW ?? ruleW, 9))}</text>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(alt)}">
<title>${esc(title)}</title>
<style>
@keyframes ${id('drift')}{from{transform:translateX(-${ruleW}px)}to{transform:translateX(0)}}
.rule{transform-box:fill-box;transform-origin:0 0;animation:${id('drift')} 9s linear infinite}
${spec.css ?? ''}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<defs>
<linearGradient id="${id('holo')}" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${ink.ramp[0]}"/><stop offset="0.17" stop-color="${ink.ramp[1]}"/><stop offset="0.33" stop-color="${ink.ramp[2]}"/>
<stop offset="0.5" stop-color="${ink.ramp[0]}"/><stop offset="0.67" stop-color="${ink.ramp[1]}"/><stop offset="0.83" stop-color="${ink.ramp[2]}"/><stop offset="1" stop-color="${ink.ramp[0]}"/>
</linearGradient>
<clipPath id="${id('rule')}"><rect x="${pad}" y="46" width="${ruleW}" height="2"/></clipPath>
${spec.defs ?? ''}
</defs>
<rect width="${w}" height="${h}" rx="14" fill="${ink.bg}"/>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="13.5" fill="none" stroke="${ink.line}"/>
<text x="${pad}" y="34" font-family="${MONO}" font-size="13" font-weight="600" letter-spacing="0.14em" fill="${ink.accent}">${esc(title)}</text>
<text x="${w - pad}" y="33" text-anchor="end" font-family="${MONO}" font-size="9" letter-spacing="0.08em" fill="${ink.dim}">${esc(serial)}</text>
<g clip-path="url(#${id('rule')})"><rect class="rule" x="${pad}" y="46" width="${ruleW * 2}" height="2" fill="url(#${id('holo')})"/></g>
${rowSVG}
${spec.body ?? ''}
${footer}
</svg>
`
}

// ---------------------------------------------------------------------------
// The four cards. Each is handed the measured profile and says, in words on the
// card, which window and which repos its numbers came from.
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const serialOf = (code, stamp) => `${code}-${stamp.slice(2).replace(/-/g, '')}`

function overviewCard(p, win, theme, stamp) {
  // Order is an argument. The year's contributions lead because they are the
  // figure with something to say; the standing counts follow. Stars and issues
  // used to sit near the top at 1 and 0 — a line each spent saying nothing.
  // A commits row went the same way: `totalCommitContributions` counts only
  // what the token can see, so against a calendar that includes private work it
  // reads far lower and invites the wrong question. The contributions row
  // already carries that signal, and carries it whole.
  //
  // The repo figure is the non-fork one. `totalCount` would be the owner total
  // — forks and all — sitting an inch above a footer that says forks are
  // excluded, and disagreeing with the basis the languages card already uses.
  // The qualifiers ride on the labels as well as the footer, so no number can
  // drift away from what it was counted under again.
  const forks = p.repoCountIsExact ? 'no forks' : 'no forks, newest 100'
  // A personal token counts private repositories a visitor cannot see. Claimed
  // only when the response actually carried one, the same rule `restricted`
  // follows for contributions.
  const reposPriv = p.privateRepos > 0 ? ', incl. private' : ''
  const rows = [
    // Never a total nobody measured: this is the calendar's own year, and it
    // claims private work only when the API said there was some.
    [`contributions (last year)${p.restricted > 0 ? ' incl. private' : ''}`, num(p.contributions)],
    ['pull requests (last year)', num(p.pullRequests)],
    [`repositories (${forks}${reposPriv})`, num(p.ownRepos)],
    ['followers', num(p.followers)],
  ]
  // Beyond one page of repositories the non-fork count is a floor, not a count,
  // and the footer has to say which hundred it looked at.
  const owned = p.repoCountIsExact ? 'owned repos' : `newest 100 of ${num(p.repoCount)} owned`
  const basis = `${owned}${p.privateRepos > 0 ? ' incl. private' : ''}, forks excluded`
  return cardSVG({ title: 'OVERVIEW', serial: serialOf('OV', stamp), rows, footer: `${basis} · ${win.from} → ${win.to}` }, theme)
}

function streakCard(p, s, win, theme, stamp) {
  const ink = INK[theme]
  const priv = p.restricted > 0 ? ', incl. private' : ''
  const pad = 20
  const colW = (420 - pad * 2) / 3
  const cols = [
    [num(s.current), 'CURRENT', 'day streak'],
    [num(s.longest), 'LONGEST', 'day streak'],
    [num(s.total), 'TOTAL', 'contributions'],
  ]
  const body =
    cols
      .map(([big, cap, sub], i) => {
        const cx = Number((pad + colW * (i + 0.5)).toFixed(1))
        const size = big.length > 5 ? 26 : 32
        return (
          `<text x="${cx}" y="122" text-anchor="middle" font-family="${MONO}" font-size="${size}" font-weight="600" fill="${ink.text}">${big}</text>` +
          `<text x="${cx}" y="146" text-anchor="middle" font-family="${MONO}" font-size="10" letter-spacing="0.16em" fill="${ink.accent}">${cap}</text>` +
          `<text x="${cx}" y="162" text-anchor="middle" font-family="${MONO}" font-size="9" fill="${ink.dim}">${sub}</text>`
        )
      })
      .join('\n') +
    [1, 2].map((i) => `<rect x="${(pad + colW * i).toFixed(1)}" y="86" width="1" height="82" fill="${ink.line}" opacity="0.5"/>`).join('')

  return cardSVG(
    {
      title: 'STREAK',
      serial: serialOf('ST', stamp),
      body,
      // All three numbers are read off the same private-inclusive calendar, so
      // the qualifier belongs to the card rather than to the TOTAL column — and
      // it has to be the one the overview card uses for the same figure.
      footer: `contribution calendar${priv} · ${win.from} → ${win.to}`,
      alt: `Streak: a current run of ${s.current} days, a longest run of ${s.longest}, and ${s.total} contributions${priv} between ${win.from} and ${win.to}.`,
    },
    theme,
  )
}

function langsCard(langs, repoCount, privateRepos, theme, stamp) {
  const ink = INK[theme]
  const pad = 20
  const barW = 420 - pad * 2
  const real = langs.filter((l) => l.name !== 'Other').length
  // The same count the overview card prints, so it carries the same qualifier.
  const basis = privateRepos > 0 ? ' incl. private' : ''
  const hue = (i, name) => (name === 'Other' ? ink.dim : rampAt(ink.ramp, real > 1 ? i / (real - 1) : 0))

  let cum = 0
  const bar = langs
    .map((l, i) => {
      const x = pad + (cum / 100) * barW
      cum += l.pct
      const seg = Math.max(0.6, (l.pct / 100) * barW)
      return `<rect x="${x.toFixed(2)}" y="66" width="${seg.toFixed(2)}" height="12" fill="${hue(i, l.name)}"/>`
    })
    .join('')

  // Two columns of three, so six languages never collide.
  const colW = barW / 2
  const legend = langs
    .slice(0, 6)
    .map((l, i) => {
      const x = pad + colW * Math.floor(i / 3)
      const y = 110 + (i % 3) * 23
      const pct = `${l.pct.toFixed(1)}%`
      const room = colW - 16 - pct.length * 11.5 * ADV - 14
      return (
        `<rect x="${x}" y="${y - 8}" width="9" height="9" rx="2" fill="${hue(i, l.name)}"/>` +
        `<text x="${x + 16}" y="${y}" font-family="${MONO}" font-size="11.5" fill="${ink.text}">${esc(fit(l.name, room, 11.5))}</text>` +
        `<text x="${(x + colW - 14).toFixed(1)}" y="${y}" text-anchor="end" font-family="${MONO}" font-size="11.5" fill="${ink.dim}">${pct}</text>`
      )
    })
    .join('\n')

  const body =
    `<clipPath id="bar-${theme}"><rect x="${pad}" y="66" width="${barW}" height="12" rx="6"/></clipPath>` +
    `<g clip-path="url(#bar-${theme})">${bar}</g>` +
    `<rect x="${pad + 0.5}" y="66.5" width="${barW - 1}" height="11" rx="5.5" fill="none" stroke="${ink.line}" opacity="0.6"/>` +
    legend

  return cardSVG(
    {
      title: 'LANGUAGES',
      serial: serialOf('LG', stamp),
      body,
      footer: `by bytes · ${repoCount} owned repos${basis}, forks excluded`,
      alt: `Languages by bytes across ${repoCount} owned repositories${basis}, forks excluded: ${langs.map((l) => `${l.name} ${l.pct} percent`).join(', ')}.`,
    },
    theme,
  )
}

function heatmapCard(weeks, today, totalShown, priv, win, theme, stamp) {
  const ink = INK[theme]
  const W = 840
  const pad = 28
  const gridX = pad + 30
  const gridW = W - pad - gridX
  const pitch = Math.max(6, Math.floor(gridW / Math.max(1, weeks.length)))
  const cell = pitch - 2
  const gridY = 74

  // Four steps, quantised on the quartiles of the days that had any activity, so
  // the scale describes this calendar rather than a number picked in advance.
  const active = weeks
    .flat()
    .map((d) => Number(d.contributionCount) || 0)
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
  const q = (f) => active[Math.min(active.length - 1, Math.floor(f * active.length))]
  const cuts = active.length ? [q(0.25), q(0.5), q(0.75)] : [1, 2, 3]
  const level = (n) => (n <= 0 ? 0 : n <= cuts[0] ? 1 : n <= cuts[1] ? 2 : n <= cuts[2] ? 3 : 4)
  const shade = (l) => (l === 0 ? ink.empty : mix(ink.empty, rampAt(ink.ramp, (l - 1) / 3), [0.3, 0.55, 0.8, 1][l - 1]))

  const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay()
  const cells = weeks
    .map((week, wi) => {
      const rects = week
        .filter((d) => d.date <= today)
        .map((d) => {
          const n = Number(d.contributionCount) || 0
          const y = gridY + weekday(d.date) * pitch
          return `<rect x="${gridX + wi * pitch}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${shade(level(n))}"><title>${d.date}: ${num(n)}</title></rect>`
        })
        .join('')
      return rects ? `<g class="wk" style="animation-delay:${(wi * 0.012).toFixed(3)}s">${rects}</g>` : ''
    })
    .join('\n')

  // A month label only where the month turns over and there is room for one.
  let lastMonth = ''
  let lastX = -99
  const months = weeks
    .map((week, wi) => {
      const first = week[0]
      if (!first) return ''
      const m = MONTHS[Number(first.date.slice(5, 7)) - 1]
      const x = gridX + wi * pitch
      if (m === lastMonth || x - lastX < pitch * 3) return ''
      lastMonth = m
      lastX = x
      return `<text x="${x}" y="${gridY - 9}" font-family="${MONO}" font-size="9" fill="${ink.dim}">${m}</text>`
    })
    .join('')

  const dayLabels = [
    [1, 'Mon'],
    [3, 'Wed'],
    [5, 'Fri'],
  ]
    .map(([row, label]) => `<text x="${pad}" y="${gridY + row * pitch + cell - 2}" font-family="${MONO}" font-size="8.5" fill="${ink.dim}">${label}</text>`)
    .join('')

  const legendX = W - pad - 128
  const baseline = gridY + 7 * pitch + 16
  const legend =
    `<text x="${legendX}" y="${baseline}" font-family="${MONO}" font-size="9" fill="${ink.dim}">less</text>` +
    [0, 1, 2, 3, 4].map((l) => `<rect x="${legendX + 28 + l * 13}" y="${baseline - 8}" width="10" height="10" rx="2" fill="${shade(l)}"/>`).join('') +
    `<text x="${W - pad}" y="${baseline}" text-anchor="end" font-family="${MONO}" font-size="9" fill="${ink.dim}">more</text>`

  return cardSVG(
    {
      title: 'CONTRIBUTIONS',
      width: W,
      pad,
      serial: serialOf('HM', stamp),
      css: '.wk{animation:wkin .5s ease-out both}\n@keyframes wkin{from{opacity:0}to{opacity:1}}',
      body: `${months}${dayLabels}\n${cells}\n${legend}`,
      footer: `${num(totalShown)} contributions${priv} · ${win.from} → ${win.to}`,
      footerW: legendX - pad - 16,
      alt: `Contribution heatmap: ${num(totalShown)} contributions${priv} between ${win.from} and ${win.to}, one square per day.`,
    },
    theme,
  )
}

// ---------------------------------------------------------------------------
// The script half. Nothing above this line reads a file or opens a socket.
// ---------------------------------------------------------------------------

async function collect() {
  // CARDS_FIXTURE renders the committed fixture instead, so the pipeline can be
  // exercised — and looked at — with no token at all.
  if (process.env.CARDS_FIXTURE) {
    const raw = JSON.parse(readFileSync(new URL('../tests/fixtures/graphql.json', import.meta.url), 'utf8'))
    return { data: raw.data ?? raw, frozen: raw._today, source: 'tests/fixtures/graphql.json' }
  }
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('set GITHUB_TOKEN, or CARDS_FIXTURE=1 to draw the committed fixture')
  const login = process.env.GITHUB_LOGIN || 'Naman-Gururani'
  return { data: await gql(PROFILE_QUERY, { login }, token), frozen: null, source: `@${login}` }
}

async function main() {
  const { data, frozen, source } = await collect()
  const p = profile(data)

  // GitHub dates the calendar in the account's own timezone, which can run ahead
  // of UTC. Trusting the later of the two keeps a real contribution from being
  // written off as "tomorrow".
  const utc = frozen || new Date().toISOString().slice(0, 10)
  const lastActive = p.days.filter((d) => (Number(d.contributionCount) || 0) > 0).at(-1)?.date ?? ''
  const today = lastActive > utc ? lastActive : utc

  const s = streaks(p.days, today)
  const langs = langShares(p.repos, 5)
  const shown = p.days.filter((d) => d.date <= today)
  const win = { from: shown[0]?.date ?? p.days[0].date, to: shown.at(-1)?.date ?? today }
  const stamp = new Date().toISOString().slice(0, 10)
  const priv = p.restricted > 0 ? ', incl. private' : ''

  // Render everything before writing anything.
  const files = []
  for (const theme of ['dark', 'light']) {
    files.push([`card-overview-${theme}.svg`, overviewCard(p, win, theme, stamp)])
    files.push([`card-streak-${theme}.svg`, streakCard(p, s, win, theme, stamp)])
    files.push([`card-langs-${theme}.svg`, langsCard(langs, p.ownRepos, p.privateRepos, theme, stamp)])
    files.push([`card-heatmap-${theme}.svg`, heatmapCard(p.weeks, today, s.total, priv, win, theme, stamp)])
  }
  for (const [name, body] of files) if (!body || !body.startsWith('<svg')) throw new Error(`${name} did not render`)

  mkdirSync(new URL('../assets/', import.meta.url), { recursive: true })
  for (const [name, body] of files) writeFileSync(new URL(`../assets/${name}`, import.meta.url), body)

  console.log(`cards: ${source} — ${win.from} → ${win.to}`)
  console.log(`  repos ${p.ownRepos} non-fork (${p.privateRepos} private) of ${p.repoCount} owned · followers ${p.followers} · PRs ${p.pullRequests}`)
  console.log(`  contributions ${num(p.contributions)}${p.restricted > 0 ? ` (incl. ${num(p.restricted)} private)` : ''} · streak ${s.current}/${s.longest}`)
  console.log(`  ${langs.map((l) => `${l.name} ${l.pct}%`).join(' · ')}`)
  console.log(`  wrote ${files.length} files`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`cards: ${err.message}`)
    console.error('nothing was written.')
    process.exitCode = 1
  })
}
