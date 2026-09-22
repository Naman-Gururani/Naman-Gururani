import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const files = ['assets/banner-dark.svg', 'assets/banner-light.svg', 'assets/desk-dark.svg', 'assets/desk-light.svg']

test('every SVG survives GitHub\'s proxy', () => {
  for (const f of files) {
    const svg = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.doesNotMatch(svg, /<script/i, `${f} has a script tag — camo strips it`)
    assert.doesNotMatch(svg, /foreignObject/i, `${f} uses foreignObject`)
    assert.doesNotMatch(svg, /href="https?:/i, `${f} pulls an external resource`)
    assert.match(svg, /@keyframes|<animate/i, `${f} should animate`)
    assert.match(svg, /prefers-reduced-motion/, `${f} must respect reduced motion`)
  }
})

test('the desk scene names nobody and spells nothing', () => {
  // The figure is deliberately generic — hood up, headphones on, no face — so
  // neither twin may carry the owner's name, and neither may render text at
  // all: the scene is pixels, and a <text> element would be something the
  // drawing claims in words.
  for (const f of ['assets/desk-dark.svg', 'assets/desk-light.svg']) {
    const svg = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.doesNotMatch(svg, /naman|gururani/i, `${f} names the owner`)
    assert.doesNotMatch(svg, /<text[\s>]/i, `${f} renders text; the scene is pixels only`)
  }
})

test('the first phrase of the banner is drawn before anything animates', () => {
  // `animation: none` under prefers-reduced-motion leaves every typing clip
  // rect at whatever width the markup gave it. The first one therefore ships
  // the full phrase — at zero it would leave a reduced-motion reader looking
  // at a blank line where the tagline should be. Three fix rounds went into
  // this; the width is the thing that has to hold.
  const CH = 9 // one character of the 15px monospace the tagline is set in
  for (const f of ['assets/banner-dark.svg', 'assets/banner-light.svg']) {
    const svg = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    const first = svg.match(/<tspan>([^<]+)<\/tspan>/)?.[1]
    assert.ok(first, `${f} carries no tagline`)
    const clips = [...svg.matchAll(/<rect class="t(\d+)-[a-z]+"[^>]*\swidth="([\d.]+)"/g)]
    assert.equal(clips.length, 3, `${f} should clip three phrases`)
    const base = Number(clips[0][2])
    assert.notEqual(base, 0, `${f} starts its first phrase at zero width — reduced motion would blank the tagline`)
    assert.equal(base, first.length * CH, `${f} first clip must be exactly as wide as ${JSON.stringify(first)}`)
  }
})

test('the desk scene keeps a cursor on screen when nothing animates', () => {
  // The blink is opacity-only and starts visible, so switching the animation
  // off leaves the cursor drawn rather than hidden.
  for (const f of ['assets/desk-dark.svg', 'assets/desk-light.svg']) {
    const svg = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    const caret = svg.match(/<rect class="caret"[^>]*>/)?.[0]
    assert.ok(caret, `${f} has no cursor on the monitor`)
    assert.doesNotMatch(caret, /opacity="0"/, `${f} hides its cursor without the animation`)
  }
})
