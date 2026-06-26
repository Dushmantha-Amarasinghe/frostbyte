import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const arms = [0, 60, 120, 180, 240, 300]
const armSvg = arms
  .map(
    (a) => `<g transform="rotate(${a} 256 256)">
      <line x1="256" y1="256" x2="256" y2="78"/>
      <line x1="256" y1="148" x2="218" y2="110"/>
      <line x1="256" y1="148" x2="294" y2="110"/>
      <line x1="256" y1="100" x2="226" y2="70"/>
      <line x1="256" y1="100" x2="286" y2="70"/>
      <path d="M256 78 l-16 20 16 20 16 -20 z" fill="url(#g)" stroke="none"/>
    </g>`
  )
  .join('\n')

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="120" y1="80" x2="400" y2="440">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="45%" stop-color="#7dd3fc"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#101720"/>
      <stop offset="100%" stop-color="#0b0d10"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="6" y="6" width="500" height="500" rx="108" fill="none" stroke="#1c2630" stroke-width="3"/>
  <g stroke="url(#g)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
    ${armSvg}
    <circle cx="256" cy="256" r="26" fill="#0b0d10" stroke="none"/>
    <circle cx="256" cy="256" r="15" fill="url(#g)" stroke="none"/>
  </g>
</svg>`

const out = join(__dirname, '..', 'resources', 'icon.png')
const buf = Buffer.from(svg)
const png = await sharp(buf).resize(512, 512).png().toBuffer()
writeFileSync(out, png)
console.log('wrote', out)
