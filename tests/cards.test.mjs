import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { streaks, langShares, cardSVG } from '../scripts/cards.mjs'
import { profile } from '../scripts/github.mjs'

const day = (date, count) => ({ date, contributionCount: count })

test('streaks count the run up to today', () => {
  const days = [day('2026-09-20', 1), day('2026-09-21', 0), day('2026-09-22', 4), day('2026-09-23', 2)]
  const s = streaks(days, '2026-09-23')
  assert.equal(s.current, 2)
  assert.equal(s.longest, 2)
  assert.equal(s.total, 7)
})

test('a gap today does not zero a streak that ended yesterday', () => {
  const days = [day('2026-09-21', 3), day('2026-09-22', 3), day('2026-09-23', 0)]
  const s = streaks(days, '2026-09-23')
  assert.equal(s.current, 2, 'today has not happened yet; yesterday still counts')
})

test('empty weeks are survivable', () => {
  const s = streaks([], '2026-09-23')
  assert.deepEqual([s.current, s.longest, s.total], [0, 0, 0])
})

test('language shares ignore forks and sum to 100', () => {
  const repos = [
    { isFork: false, languages: [{ name: 'TypeScript', size: 600 }, { name: 'CSS', size: 400 }] },
    { isFork: true, languages: [{ name: 'C++', size: 9999 }] },
  ]
  const out = langShares(repos)
  assert.equal(out[0].name, 'TypeScript')
  assert.equal(Math.round(out.reduce((a, l) => a + l.pct, 0)), 100)
})

test('a card says what it counted', () => {
  const svg = cardSVG({ title: 'OVERVIEW', rows: [['Repos', '12']] }, 'dark')
  assert.match(svg, /OVERVIEW/)
  assert.doesNotMatch(svg, /<script/i)
})

// --- the awkward cases the live calendar actually hands us -------------------

test('the rest of this week does not break the current streak', () => {
  // GitHub returns whole weeks, so days after today arrive as zeroes.
  const days = [day('2026-09-21', 2), day('2026-09-22', 5), day('2026-09-23', 1), day('2026-09-24', 0), day('2026-09-25', 0)]
  const s = streaks(days, '2026-09-23')
  assert.equal(s.current, 3, 'tomorrow has not happened either')
  assert.equal(s.longest, 3)
})

test('the longest streak can sit in the past', () => {
  const days = [day('2026-09-18', 1), day('2026-09-19', 1), day('2026-09-20', 1), day('2026-09-21', 0), day('2026-09-22', 9)]
  const s = streaks(days, '2026-09-22')
  assert.equal(s.current, 1)
  assert.equal(s.longest, 3)
})

test('language shares fold the tail into one slice and still total 100', () => {
  const repos = [{
    isFork: false,
    languages: [
      { name: 'Java', size: 500 }, { name: 'Python', size: 300 }, { name: 'Go', size: 100 },
      { name: 'Rust', size: 50 }, { name: 'Shell', size: 30 }, { name: 'Lua', size: 20 },
    ],
  }]
  const out = langShares(repos, 3)
  assert.equal(out.length, 4)
  assert.equal(out.at(-1).name, 'Other')
  assert.equal(out.reduce((a, l) => a + l.pct, 0).toFixed(1), '100.0')
})

test('no repos means no shares rather than a divide by zero', () => {
  assert.deepEqual(langShares([{ isFork: true, languages: [{ name: 'C', size: 10 }] }]), [])
})

test('a card is drawn at the width it was asked for', () => {
  const wide = cardSVG({ title: 'CONTRIBUTIONS', width: 840, body: '<rect x="1" y="1" width="2" height="2"/>' }, 'light')
  assert.match(wide, /width="840"/)
  assert.match(wide, /viewBox="0 0 840 200"/)
  assert.match(wide, /<rect x="1" y="1" width="2" height="2"\/>/)
})

test('a card escapes what it is handed', () => {
  const svg = cardSVG({ title: 'LANGUAGES', rows: [['C++ & "friends"', '<b>1</b>']] }, 'dark')
  assert.doesNotMatch(svg, /<b>/)
  assert.match(svg, /C\+\+ &amp; &quot;friends&quot;/)
})

// --- the two repo counts, which are not the same number ---------------------

const payload = (nodes, totalCount) => ({
  user: {
    contributionsCollection: {
      restrictedContributionsCount: 0,
      contributionCalendar: { totalContributions: 1, weeks: [{ contributionDays: [{ date: '2026-09-23', contributionCount: 1 }] }] },
    },
    repositories: { totalCount, nodes },
    followers: { totalCount: 0 },
  },
})
const node = (name, isFork, isPrivate = false) => ({ name, isFork, isPrivate, languages: { edges: [] } })

test('the owned total and the non-fork count are kept apart', () => {
  const p = profile(payload([node('mine', false), node('also-mine', false), node('someone-elses', true)], 3))
  assert.equal(p.repoCount, 3, 'every owned repo, forks and all')
  assert.equal(p.ownRepos, 2, 'only the ones they wrote — what "forks excluded" may be printed beside')
  assert.equal(p.repoCountIsExact, true)
})

test('past one page of repositories the non-fork count is only a floor', () => {
  const p = profile(payload([node('a', false), node('b', true)], 240))
  assert.equal(p.repoCountIsExact, false, 'the card has to say which hundred it looked at')
})

test('private repos are counted on the same basis the fork qualifier describes', () => {
  // The figure the card labels "no forks, incl. private" — so the qualifier is
  // claimed off the same repos the number was counted over, and a private fork
  // somebody else wrote cannot switch it on.
  const p = profile(payload([node('mine', false, true), node('public', false, false), node('forked', true, true)], 3))
  assert.equal(p.ownRepos, 2)
  assert.equal(p.privateRepos, 1)
  assert.equal(profile(payload([node('a', false, false), node('f', true, true)], 2)).privateRepos, 0, 'a forked private repo is not one they wrote')
})

// --- the files we actually commit -------------------------------------------

const cards = ['overview', 'streak', 'langs', 'heatmap']
const files = cards.flatMap((c) => [`assets/card-${c}-dark.svg`, `assets/card-${c}-light.svg`])

test('every committed card survives GitHub\'s proxy', () => {
  for (const f of files) {
    const svg = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.doesNotMatch(svg, /<script/i, `${f} has a script tag — camo strips it`)
    assert.doesNotMatch(svg, /foreignObject/i, `${f} uses foreignObject`)
    assert.doesNotMatch(svg, /href="https?:/i, `${f} pulls an external resource`)
    assert.match(svg, /prefers-reduced-motion/, `${f} must respect reduced motion`)
    assert.match(svg, /^<svg xmlns=/, `${f} should be a bare SVG document`)
  }
})

test('the heatmap is the wide one', () => {
  const heat = readFileSync(new URL('../assets/card-heatmap-dark.svg', import.meta.url), 'utf8')
  const rest = readFileSync(new URL('../assets/card-overview-dark.svg', import.meta.url), 'utf8')
  assert.match(heat, /width="840"/)
  assert.match(rest, /width="420"/)
})

test('the overview card never claims an unmeasured total', () => {
  for (const t of ['dark', 'light']) {
    const svg = readFileSync(new URL(`../assets/card-overview-${t}.svg`, import.meta.url), 'utf8')
    assert.match(svg, /contributions \(last year\)/, 'the contributions row must name its window')
    assert.doesNotMatch(svg, /all[- ]time/i)
  }
})

test('a card that says "forks excluded" says so beside the number too', () => {
  for (const t of ['dark', 'light']) {
    const svg = readFileSync(new URL(`../assets/card-overview-${t}.svg`, import.meta.url), 'utf8')
    if (/forks excluded/.test(svg)) assert.match(svg, /repositories \(no forks/, 'the repo row must carry the qualifier its figure was counted under')
  }
})

test('a repository count that includes private repos says so twice', () => {
  // Same rule as the fork qualifier: the label beside the number carries it,
  // not only the footer, so the two cannot drift apart.
  for (const t of ['dark', 'light']) {
    const svg = readFileSync(new URL(`../assets/card-overview-${t}.svg`, import.meta.url), 'utf8')
    const labelled = /repositories \([^)]*incl\. private\)/.test(svg)
    assert.equal(/owned[^<]*incl\. private/.test(svg), labelled, 'the footer and the repo row must agree about private repos')
  }
})

test('the overview card prints no figure it cannot stand behind', () => {
  // Stars, issues and commits each came off this card for reading worse than
  // nothing beside the numbers around them, and each was dropped from the
  // query along with its row. Pinned here so none of the three drifts back in
  // unlabelled on a later pass.
  for (const t of ['dark', 'light']) {
    const svg = readFileSync(new URL(`../assets/card-overview-${t}.svg`, import.meta.url), 'utf8')
    for (const gone of [/stars/i, /issues/i, /commits/i])
      assert.doesNotMatch(svg, gone, `the overview card is printing ${gone} again`)
  }
})

test('the same contribution figure carries the same qualifier on every card', () => {
  for (const t of ['dark', 'light']) {
    const read = (c) => readFileSync(new URL(`../assets/card-${c}-${t}.svg`, import.meta.url), 'utf8')
    // Pinned to the contributions row itself. The overview card also says
    // "incl. private" about its repository count, which is a different figure
    // from a different query and may carry the qualifier when the calendar
    // does not.
    const priv = /contributions \(last year\) incl\. private/.test(read('overview'))
    assert.equal(/incl\. private/.test(read('streak')), priv, 'the streak card prints the same total')
    assert.equal(/incl\. private/.test(read('heatmap')), priv, 'the heatmap prints the same total')
  }
})
