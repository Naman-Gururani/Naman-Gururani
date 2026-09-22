// scripts/art.mjs — writes the profile's animated SVGs.
//
// Pixels are described as rows of palette keys, one character per pixel, so a
// change is a change to a picture rather than to three hundred <rect> tags.
// Everything animates in CSS: GitHub's image proxy runs CSS and SMIL but
// strips <script>, and it will not fetch a font or an image for us. CSS is the
// one of the two that `prefers-reduced-motion` can switch off, so everything
// here is CSS and the reduced-motion rule at the end of each file is real.
import { writeFileSync, mkdirSync } from 'node:fs'

const PAL_DARK = { '.': null, k: '#141313', s: '#201f1f', o: '#444748', t: '#e5e2e1', h: '#d9bcff', c: '#a9e8ff', p: '#fcd6ff', w: '#201f1f' }

// The light twin is the same drawing with its greys turned over, with one
// exception: `w`, the figure. Inverting it put the figure on exactly the tone
// of the desk panel it stands in front of, so the silhouette survived only on
// its outline. It gets a value of its own instead — sitting between the lit
// desk and the panel, so it separates from both at a glance.
const PAL_LIGHT = { '.': null, k: '#f4f4f4', s: '#e4e1e1', o: '#7c8386', t: '#1c1b1b', h: '#7d4bd0', c: '#2aa7d0', p: '#b23fc4', w: '#a6acaf' }

const INK = {
  dark: { bg: '#141313', panel: '#201f1f', text: '#e5e2e1', dim: '#8d8a89', line: '#444748', ramp: ['#a9e8ff', '#d9bcff', '#fcd6ff'] },
  light: { bg: '#f4f4f4', panel: '#e4e1e1', text: '#1c1b1b', dim: '#5c5959', line: '#c3c0c0', ramp: ['#2aa7d0', '#7d4bd0', '#b23fc4'] },
}

/**
 * Two typing poses on a 96×64 grid, one string per row, one character per
 * pixel. The scene reads at a glance: desk slab across the middle, monitor
 * standing left of centre with a lit screen, the figure seen from behind and
 * slightly right — hood up, headphone band, no face at all — forearms reaching
 * over the desk to the keys, mug steaming on the right. Frame B differs from
 * frame A only in the forearm and hand rows, so the hands tap and nothing else
 * moves.
 */
const DESK_A = [
  'kkkkkkoooooooooooooooooooooooooooooooooooooooooooooooookkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosssssssssssssssssssssssssssssssssssssssssssssssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosssssssssssssssssssssssssssssssssssssssssssssssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkoooooooooooooooooooooooooooooooooooooooooooooooookkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'ooooooooooooooooooooooooookssssssskooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo',
  'ooooooooooooooooooooooooookkkkkkkkkooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo',
  'ooooooooooooooooooookkkkkkkkkkkkkkkkkkkkkooooooooooooooooooooooooooooooooooooooooooooooooooooooo',
  'ooooooooooooooooooookkkkkkkkkkkkkkkkkkkkkooooooooooooooooooooooooooooooooooooooooooooooooooooooo',
  'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooookcccccccccckoooooo',
  'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooksssssssssskoooooo',
  'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooksssssssssskoooooo',
  'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooksssssssssskkkkkoo',
  'ooooooooooooooooooooktttttttttttttttttttttttttttttttttttttttttttttttttttttttkoksssssssssskksskoo',
  'ooooooooooooooooooookssssssssssssssssssssssssssssssssssssssssssssssssssssssskoksssssssssskksskoo',
  'ooooooooooooooooooookssssssssssssssssssssssssssssssssssssssssssssssssssssssskoksssssssssskksskoo',
  'ooooooooooooooooooookssooossooossooossooossooossooossooossooossooossooossoookoksssssssssskksskoo',
  'ooooooooooooooooooookssooossooossooossooossooossooossooossooossooossooossoookoksssssssssskkkkkoo',
  'ooooooooooooooooooookssooossooossooossooossooossooossooossooossooossooossoookoksssssssssskoooooo',
  'ooooooooooooooooooooksssskcccccccccckssssssssssssssssssssssssssssssssssssssskoksssssssssskoooooo',
  'ooooooooooooooooooooksssskwwwwwwwwwwkssssssssssssssssssssssssssssssssssssssskokkkkkkkkkkkkoooooo',
  'ooooooooooooooooooookkkkkkwwwwwwwwwwkkkkkkkkkkkkkkkkkkkkkkkkkhhppppppppkkkkkkooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwwwwwwwwkoooooookkktkkkoooooooookwwwwwwwwwwkoooooooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwkwwkwwkkooooookkttwttkkooooooookwwwwwwwwwwkoooooooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwkwwkwwkkoooookktwwwwwtkkoooooookwwwwwwwwwwkoooooooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwkwwkwwkkoooooktwwwwwwwtkoooooookwwwkwwkwwkkoooooooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwkwwkwwkkoooookwwwwwwwwwkoooooookwwwkwwkwwkkoooooooooooooooooooooooo',
  'ooooooooooooooooooooooookkwwwwwwwwkkkoooookwwwwwwwwwkoooooookwwwkwwkwwkkoooooooooooooooooooooooo',
  'oooooooooooooooooooooookkwwwwwwwwwkoooooottwwwwwwwwwttooooookwwwkwwkwwkkkooooooooooooooooooooooo',
  'ssssssssssssssssssssssskwwwwwwwwwkkssssssttwwwwwwwwwttsssssskkkwwwwwwwwwkkssssssssssssssssssssss',
  'sssssssssssssssssssssskkwwwwwwwwwksssssssctwwwwwwwwwtcsssssssskkwwwwwwwwwkksssssssssssssssssssss',
  'ssssssssssssssssssssskkwwwwwwwwwkksssssssttwwwwwwwwwttssssssssskwwwwwwwwwwkkssssssssssssssssssss',
  'ssssssssssssssskkkkkkkwwwwwwwwwwkkkkkkkkkttwwwwwwwwwttkkkkkkkkkkkwwwwwwwwwwkkkkkssssssssssssssss',
  'sssssssssssssskkoooookwwwwwwwwwwkooooooookkwwwwwwwwwkkooooooooookwwwwwwwwwwkoookksssssssssssssss',
  'ssssssssssssskkooooookwwwwwwwwwwkkoooooookkkwwwwwwwkkkoooooooookkwwwwwwwwwwkooookkssssssssssssss',
  'sssssssssssskkoooooookwwwwwwwwwwwkooooookkwkwwwwwwwkwkkooooooookwwwwwwwwwwwkoooookksssssssssssss',
  'ssssssssssskkooooooookwwwwwwwwwwwkkooookkwwkwwwwwwwkwwkkooooookkwwwwwwwwwwwkooooookkssssssssssss',
  'sssssssssskkooooookookkwwwwwwwwwwwkkkcccwwwkwwwwwwwkwwwhhhkookkwwwwwwwwwwwkkkooooookksssssssssss',
  'ssssssssskkoooooookoookwwwwwwwwwwwwkkwwwwwwwwwwwwwwwwwwwwwhhhkwwwwwwwwwwwwkokoooooookkssssssssss',
  'ssssssssskooooooookoookkwwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwkwwwwwwwwwwwkkokooooooookssssssssss',
  'ssssssssskooooooookooookwwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwwwkookooooooookssssssssss',
  'ssssssssskooooooookooookkwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwwkkookooooooookssssssssss',
  'ssssssssskooooooookoooookwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwwkoookooooooookssssssssss',
  'ssssssssskooooooookoooookkwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwkkoookooooooookssssssssss',
  'ssssssssskooooooookoooookkwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookooookkwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookooookwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookooookwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookooookwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookoookkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkkoookooooooookssssssssss',
  'ssssssssskooooooookoookwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkoookooooooookssssssssss',
]
const DESK_B = [
  'kkkkkkoooooooooooooooooooooooooooooooooooooooooooooooookkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosssssssssssssssssssssssssssssssssssssssssssssssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkosssssssssssssssssssssssssssssssssssssssssssssssokkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkoooooooooooooooooooooooooooooooooooooooooooooooookkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'ooooooooooooooooooooooooookssssssskooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo',
  'ooooooooooooooooooooooooookkkkkkkkkooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo',
  'ooooooooooooooooooookkkkkkkkkkkkkkkkkkkkkooooooooooooooooooooooooooooooooooooooooooooooooooooooo',
  'ooooooooooooooooooookkkkkkkkkkkkkkkkkkkkkooooooooooooooooooooooooooooooooooooooooooooooooooooooo',
  'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooookcccccccccckoooooo',
  'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooksssssssssskoooooo',
  'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooksssssssssskoooooo',
  'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooksssssssssskkkkkoo',
  'ooooooooooooooooooooktttttttttttttttttttttttttttttttttttttttttttttttttttttttkoksssssssssskksskoo',
  'ooooooooooooooooooookssssssssssssssssssssssssssssssssssssssssssssssssssssssskoksssssssssskksskoo',
  'ooooooooooooooooooookssssssssssssssssssssssssssssssssssssssssssssssssssssssskoksssssssssskksskoo',
  'ooooooooooooooooooookssooossooossooossooossooossooossooossooossooossooossoookoksssssssssskksskoo',
  'ooooooooooooooooooookssooossooossooossooossooossooossooossooossooossooossoookoksssssssssskkkkkoo',
  'ooooooooooooooooooookssooossooossooossooossooossooossooossooossooossooossoookoksssssssssskoooooo',
  'ooooooooooooooooooookssssssssssssssssssssssssssssssssssssssskhhppppppppksssskoksssssssssskoooooo',
  'ooooooooooooooooooookssssssssssssssssssssssssssssssssssssssskwwwwwwwwwwksssskokkkkkkkkkkkkoooooo',
  'ooooooooooooooooooookkkkkkcccccccccckkkkkkkkkkkkkkkkkkkkkkkkkwwwwwwwwwwkkkkkkooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwwwwwwwwkoooooookkktkkkoooooooookwwwwwwwwwwkoooooooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwwwwwwwwkooooookkttwttkkooooooookwwwkwwkwwkkoooooooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwwwwwwwwkoooookktwwwwwtkkoooooookwwwkwwkwwkkoooooooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwkwwkwwkkoooooktwwwwwwwtkoooooookwwwkwwkwwkkoooooooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwkwwkwwkkoooookwwwwwwwwwkoooooookwwwkwwkwwkkoooooooooooooooooooooooo',
  'oooooooooooooooooooooooookwwwkwwkwwkkoooookwwwwwwwwwkoooooookkkwwwwwwwwkkooooooooooooooooooooooo',
  'ooooooooooooooooooooooookkwwwkwwkwwkkoooottwwwwwwwwwttooooooookwwwwwwwwwkkoooooooooooooooooooooo',
  'ssssssssssssssssssssssskkwwwwwwwwwkkkssssttwwwwwwwwwttsssssssskkwwwwwwwwwkssssssssssssssssssssss',
  'sssssssssssssssssssssskkwwwwwwwwwkkssssssctwwwwwwwwwtcssssssssskwwwwwwwwwkksssssssssssssssssssss',
  'ssssssssssssssssssssskkwwwwwwwwwwksssssssttwwwwwwwwwttssssssssskkwwwwwwwwwkkssssssssssssssssssss',
  'ssssssssssssssskkkkkkkwwwwwwwwwwkkkkkkkkkttwwwwwwwwwttkkkkkkkkkkkwwwwwwwwwwkkkkkssssssssssssssss',
  'sssssssssssssskkoooookwwwwwwwwwwkooooooookkwwwwwwwwwkkooooooooookwwwwwwwwwwkoookksssssssssssssss',
  'ssssssssssssskkooooookwwwwwwwwwwkkoooooookkkwwwwwwwkkkoooooooookkwwwwwwwwwwkooookkssssssssssssss',
  'sssssssssssskkoooooookwwwwwwwwwwwkooooookkwkwwwwwwwkwkkooooooookwwwwwwwwwwwkoooookksssssssssssss',
  'ssssssssssskkooooooookwwwwwwwwwwwkkooookkwwkwwwwwwwkwwkkooooookkwwwwwwwwwwwkooooookkssssssssssss',
  'sssssssssskkooooookookkwwwwwwwwwwwkkkcccwwwkwwwwwwwkwwwhhhkookkwwwwwwwwwwwkkkooooookksssssssssss',
  'ssssssssskkoooooookoookwwwwwwwwwwwwkkwwwwwwwwwwwwwwwwwwwwwhhhkwwwwwwwwwwwwkokoooooookkssssssssss',
  'ssssssssskooooooookoookkwwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwkwwwwwwwwwwwkkokooooooookssssssssss',
  'ssssssssskooooooookooookwwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwwwkookooooooookssssssssss',
  'ssssssssskooooooookooookkwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwwkkookooooooookssssssssss',
  'ssssssssskooooooookoooookwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwwkoookooooooookssssssssss',
  'ssssssssskooooooookoooookkwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwkkoookooooooookssssssssss',
  'ssssssssskooooooookoooookkwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookooookkwwwwwwwwwwwwwwwwwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookooookwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookooookwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookooookwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkooookooooooookssssssssss',
  'ssssssssskooooooookoookkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkkoookooooooookssssssssss',
  'ssssssssskooooooookoookwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkoookooooooookssssssssss',
]

/**
 * Pixels → SVG. Adjacent pixels of the same colour on a row become one <rect>,
 * which turns ~6k pixels into a few hundred rects and keeps the file small
 * enough for a README to load fast.
 */
function rects(rows, pal, scale) {
  const out = []
  rows.forEach((row, y) => {
    let runStart = 0
    for (let x = 1; x <= row.length; x++) {
      if (x < row.length && row[x] === row[runStart]) continue
      const key = row[runStart]
      const colour = pal[key]
      if (colour) out.push(`<rect x="${runStart * scale}" y="${y * scale}" width="${(x - runStart) * scale}" height="${scale}" fill="${colour}"/>`)
      runStart = x
    }
  })
  return out.join('')
}

// A tiny deterministic generator, so re-running the script does not reshuffle
// the code on the screen and churn the diff.
function rng(seed) {
  let s = seed
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
}

const SCALE = 5
const SCREEN = { x: 9 * SCALE, y: 2 * SCALE, w: 43 * SCALE, h: 13 * SCALE }
const LINE_H = 15          // one code line every three grid pixels
const LINES = 14           // one loop's worth; the block is emitted twice
const PERIOD = LINES * LINE_H

// The code on the monitor: bars of colour that scroll up behind the bezel.
function codeLines(pal) {
  const r = rng(20260923)
  const hues = ['c', 'h', 'p', 't', 'c', 'h', 't', 'p']
  const one = []
  for (let i = 0; i < LINES; i++) {
    const indent = Math.floor(r() * 4) * 12
    const width = 40 + Math.floor(r() * (SCREEN.w - indent - 55))
    const fill = pal[hues[Math.floor(r() * hues.length)]]
    one.push({ x: SCREEN.x + 10 + indent, w: width, fill, dim: r() < 0.4 })
  }
  let out = ''
  for (let pass = 0; pass < 2; pass++)
    one.forEach((l, i) => {
      const y = SCREEN.y + 4 + pass * PERIOD + i * LINE_H
      out += `<rect x="${l.x}" y="${y}" width="${l.w}" height="${SCALE}" fill="${l.fill}"${l.dim ? ' opacity="0.65"' : ''}/>`
    })
  return out
}

function deskSVG(pal, theme) {
  const id = s => `${s}-${theme}`
  const steam = [0, 0.9, 1.7].map((delay, i) =>
    `<ellipse class="steam" cx="${404 + i * 14}" cy="106" rx="3" ry="5" fill="${pal[['c', 'h', 'p'][i]]}" opacity="0" style="animation-delay:${delay}s"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="480" height="320" shape-rendering="crispEdges" role="img" aria-label="Pixel art: someone in a hood and headphones, seen from behind, typing at a lit monitor with a steaming mug beside the keyboard.">
<title>Heads-down at the desk</title>
<style>
.a{animation:tapA .42s steps(1,end) infinite}
.b{animation:tapB .42s steps(1,end) infinite}
@keyframes tapA{0%{opacity:1}50%{opacity:0}100%{opacity:1}}
@keyframes tapB{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
.scroll{transform-box:fill-box;transform-origin:0 0;animation:scroll 6s linear infinite}
@keyframes scroll{from{transform:translateY(0)}to{transform:translateY(-${PERIOD}px)}}
.steam{transform-box:fill-box;transform-origin:50% 100%;animation:steam 3.2s ease-out infinite}
@keyframes steam{0%{transform:translateY(0) scale(1);opacity:0}30%{opacity:.6}100%{transform:translateY(-42px) scale(1.8);opacity:0}}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<rect width="480" height="320" fill="${pal.k}"/>
<g class="a">${rects(DESK_A, pal, SCALE)}</g>
<g class="b" opacity="0">${rects(DESK_B, pal, SCALE)}</g>
<clipPath id="${id('well')}"><rect x="${SCREEN.x}" y="${SCREEN.y}" width="${SCREEN.w}" height="${SCREEN.h}"/></clipPath>
<g clip-path="url(#${id('well')})"><g class="scroll">${codeLines(pal)}</g></g>
${steam}
</svg>
`
}

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
const PHRASES = [
  'payments that must not lose a record',
  'streams that must not stop',
  'a portfolio you can walk around',
]
const CH = 9                       // one character of 15px monospace
const SLOT = 100 / PHRASES.length  // each phrase owns a third of the loop
const TYPE = 17, HOLD = 30         // per-phrase: type for 17%, hold to 30%

function bannerSVG(ink, theme) {
  const id = s => `${s}-${theme}`
  const x0 = 52, baseline = 186

  // Each phrase is revealed by growing its own clip rect, one character per
  // step, then cleared when its slot ends.
  const clips = PHRASES.map((phrase, i) => {
    const w = phrase.length * CH, t0 = i * SLOT
    const stops = [
      `0%{width:0}`,
      `${t0.toFixed(2)}%{width:0;animation-timing-function:steps(${phrase.length},end)}`,
      `${(t0 + TYPE).toFixed(2)}%{width:${w}px}`,
      `${(t0 + HOLD).toFixed(2)}%{width:${w}px}`,
      `${(t0 + HOLD + 0.01).toFixed(2)}%{width:0}`,
      `100%{width:0}`,
    ]
    return { phrase, w, css: `@keyframes ${id('type' + i)}{${(i === 0 ? stops.slice(1) : stops).join('')}}` }
  })

  const caretStops = PHRASES.flatMap((phrase, i) => {
    const t0 = i * SLOT, w = phrase.length * CH
    return [
      `${t0.toFixed(2)}%{transform:translateX(0);animation-timing-function:steps(${phrase.length},end)}`,
      `${(t0 + TYPE).toFixed(2)}%{transform:translateX(${w}px)}`,
      `${(t0 + HOLD).toFixed(2)}%{transform:translateX(${w}px)}`,
    ]
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 220" width="840" height="220" role="img" aria-label="Naman Gururani — payments that must not lose a record, streams that must not stop, a portfolio you can walk around.">
<title>Naman Gururani</title>
<style>
${clips.map(c => c.css).join('\n')}
${PHRASES.map((_, i) => `.t${i}-${theme}{animation:${id('type' + i)} 12s linear infinite}`).join('\n')}
@keyframes ${id('caret')}{${caretStops.join('')}100%{transform:translateX(0)}}
@keyframes ${id('blink')}{0%,49%{opacity:1}50%,100%{opacity:0}}
.caret{transform-box:fill-box;transform-origin:0 0;animation:${id('caret')} 12s linear infinite,${id('blink')} 1s steps(2) infinite}
.drift{transform-box:fill-box;transform-origin:0 0;animation:${id('drift')} 9s linear infinite}
@keyframes ${id('drift')}{from{transform:translateX(-736px)}to{transform:translateX(0)}}
.pulse{animation:${id('pulse')} 4.5s ease-in-out infinite}
@keyframes ${id('pulse')}{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<defs>
<linearGradient id="${id('holo')}" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${ink.ramp[0]}"/><stop offset="0.17" stop-color="${ink.ramp[1]}"/><stop offset="0.33" stop-color="${ink.ramp[2]}"/>
<stop offset="0.5" stop-color="${ink.ramp[0]}"/><stop offset="0.67" stop-color="${ink.ramp[1]}"/><stop offset="0.83" stop-color="${ink.ramp[2]}"/><stop offset="1" stop-color="${ink.ramp[0]}"/>
</linearGradient>
<clipPath id="${id('rule')}"><rect x="${x0}" y="144" width="736" height="3"/></clipPath>
${clips.map((c, i) => `<clipPath id="${id('type' + i)}"><rect class="t${i}-${theme}" x="${x0}" y="168" width="0" height="26"/></clipPath>`).join('')}
</defs>
<rect width="840" height="220" rx="16" fill="${ink.bg}"/>
<rect x="0.5" y="0.5" width="839" height="219" rx="15.5" fill="none" stroke="${ink.line}"/>
<text x="${x0}" y="96" font-family="${SANS}" font-size="44" font-weight="700" letter-spacing="-0.5" fill="${ink.text}">Naman Gururani</text>
<text x="${x0 + 2}" y="126" font-family="${MONO}" font-size="14" letter-spacing="0.05em" fill="${ink.ramp[0]}">DATA ENGINEER // PAYMENTS &amp; STREAMING</text>
<g clip-path="url(#${id('rule')})"><rect class="drift" x="${x0}" y="144" width="1472" height="3" fill="url(#${id('holo')})"/></g>
${PHRASES.map((phrase, i) => `<g clip-path="url(#${id('type' + i)})"><text x="${x0}" y="${baseline}" font-family="${MONO}" font-size="15" fill="${ink.text}"><tspan>${phrase}</tspan></text></g>`).join('')}
<rect class="caret" x="${x0 + 2}" y="172" width="8" height="19" fill="${ink.ramp[0]}"/>
${[0, 1, 2].map(i => `<rect class="pulse" x="${716 + i * 30}" y="${70 + i * 8}" width="14" height="${60 - i * 12}" rx="3" fill="${ink.ramp[i]}" style="animation-delay:${i * 0.6}s"/>`).join('')}
</svg>
`
}

mkdirSync(new URL('../assets/', import.meta.url), { recursive: true })
const write = (name, body) => {
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), body)
  console.log(`${name}  ${(body.length / 1024).toFixed(1)} kB`)
}
write('banner-dark.svg', bannerSVG(INK.dark, 'dark'))
write('banner-light.svg', bannerSVG(INK.light, 'light'))
write('desk-dark.svg', deskSVG(PAL_DARK, 'dark'))
write('desk-light.svg', deskSVG(PAL_LIGHT, 'light'))
