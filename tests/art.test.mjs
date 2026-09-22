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

test('the desk scene is not a portrait of anybody', () => {
  const svg = readFileSync(new URL('../assets/desk-dark.svg', import.meta.url), 'utf8')
  assert.doesNotMatch(svg, /naman/i)
})
