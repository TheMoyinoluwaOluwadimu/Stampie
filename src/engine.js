// Stampie rendering engine: turns an image into an engraved wavy-line print.
// Pure canvas code, no dependencies.

export const W = 1080
export const H = 1350
const NB = 32 // number of colour steps between shadow and highlight

export const PALETTES = {
  'Midnight blue': ['#0b3fd0', '#4d82ff', '#f4f1e8', '#0a1020'],
  Olive: ['#0f5a35', '#3f8a5e', '#e6dc9e', '#2e2a1e'],
  Cobalt: ['#0f3fa8', '#4a74d4', '#f7f4ee', '#1250c8'],
  Ink: ['#1a1a1a', '#8a8a8a', '#efe9dc', '#2b2b2b'],
  Rose: ['#8f1d3a', '#e0657f', '#f6ece4', '#2a1118'],
}

export const DEFAULTS = {
  c1: '#0f3fa8', c2: '#4a74d4', c3: '#f7f4ee', c4: '#1250c8',
  tint: 12, sp: 3.5, wt: 100, dt: 60, am: 5, fr: 70, tl: 30, wp: 70, an: 0,
  br: 0, co: 130, inv: false, frame: true, quality: 2, np: false, cs: 'wave',
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const f = (n) => Math.round(n * 10) / 10
const hx = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

function blur(a, w, h, r) {
  const o = new Float32Array(a.length), t = new Float32Array(a.length)
  for (let y = 0; y < h; y++) {
    let s = 0, n = 0; const row = y * w
    for (let x = -r; x <= r; x++) if (x >= 0 && x < w) { s += a[row + x]; n++ }
    for (let x = 0; x < w; x++) {
      t[row + x] = s / n
      const a1 = x + r + 1, a0 = x - r
      if (a1 < w) { s += a[row + a1]; n++ }
      if (a0 >= 0) { s -= a[row + a0]; n-- }
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0, n = 0
    for (let y = -r; y <= r; y++) if (y >= 0 && y < h) { s += t[y * w + x]; n++ }
    for (let y = 0; y < h; y++) {
      o[y * w + x] = s / n
      const a1 = y + r + 1, a0 = y - r
      if (a1 < h) { s += t[a1 * w + x]; n++ }
      if (a0 >= 0) { s -= t[a0 * w + x]; n-- }
    }
  }
  return o
}

/**
 * Render the effect.
 * @param img HTMLImageElement
 * @param p params (see DEFAULTS)
 * @param transparent when true the background is transparent and perforations are punched out
 */
export function render(img, p, transparent) {
  const S = p.quality
  const cv = document.createElement('canvas')
  cv.width = W * S; cv.height = H * S
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.setTransform(S, 0, 0, S, 0, 0)
  const s = hex(p.c1), h = hex(p.c2)
  if (!transparent) { ctx.fillStyle = p.c4; ctx.fillRect(0, 0, W, H) }

  const fm = p.frame, m = fm ? 46 : 0, mx = fm ? 600 : 920, my = fm ? 780 : 1200
  const k = Math.min(mx / img.width, my / img.height)
  const w = Math.round(img.width * k), h2 = Math.round(img.height * k)
  const ox = Math.round((W - w) / 2), oy = Math.round((H - h2) / 2)
  const bounds = [ox - m, oy - m, w + 2 * m, h2 + 2 * m]
  const meta = { ox, oy, w, h2, m, fm, tint: p.tint / 100, a: (p.an * Math.PI) / 180 }

  const noPaper = transparent && p.np
  ctx.fillStyle = p.c3
  if (fm && !noPaper) ctx.fillRect(...bounds)
  if (!noPaper) ctx.fillRect(ox, oy, w, h2)

  // Luminance map at render resolution
  const t = document.createElement('canvas')
  const nw = w * S, nh = h2 * S
  t.width = nw; t.height = nh
  const tc = t.getContext('2d')
  tc.drawImage(img, 0, 0, nw, nh)
  const d = tc.getImageData(0, 0, nw, nh).data
  const L = new Float32Array(nw * nh)
  for (let i = 0; i < L.length; i++) L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255
  const dt = p.dt / 100
  if (dt > 0) {
    const B = blur(L, nw, nh, Math.max(2, Math.round(2.5 * S)))
    for (let i = 0; i < L.length; i++) L[i] += dt * 2 * (L[i] - B[i])
  }
  const br = p.br / 100, co = p.co / 100
  for (let i = 0; i < L.length; i++) {
    let l = (L[i] - 0.5) * co + 0.5 + br
    l = l < 0 ? 0 : l > 1 ? 1 : l
    L[i] = p.inv ? 1 - l : l
  }

  // Colour-blend photo tint under the lines
  let tintURL = null
  if (p.tint > 0) {
    const id = tc.createImageData(nw, nh)
    for (let i = 0; i < L.length; i++) {
      const c = mix(s, h, L[i])
      id.data[i * 4] = c[0]; id.data[i * 4 + 1] = c[1]; id.data[i * 4 + 2] = c[2]; id.data[i * 4 + 3] = 255
    }
    tc.putImageData(id, 0, 0)
    tintURL = t.toDataURL('image/jpeg', 0.85)
    ctx.globalAlpha = meta.tint
    ctx.drawImage(t, ox, oy, w, h2)
    ctx.globalAlpha = 1
  }

  // Lines
  const sp = p.sp, wt = p.wt / 100, am = p.am, fr = p.fr / 1000, tl = p.tl / 1000
  const wp = (p.wp / 100) * sp, a = meta.a, ca = Math.cos(a), sa = Math.sin(a)
  const dg = Math.hypot(w, h2) / 2 + 30
  const paths = new Array(NB).fill('')
  const step = Math.min(1.5, Math.max(0.75, sp * 0.3)), mg = 2
  for (let v = -dg; v <= dg; v += sp) {
    let T = [], B = [], cb = -1, mxw = 0
    const close = () => {
      if (T.length > 1 && mxw > 0.25) {
        let q = 'M' + T[0]
        for (let i = 1; i < T.length; i++) q += 'L' + T[i]
        for (let i = B.length - 1; i >= 0; i--) q += 'L' + B[i]
        paths[cb] += q + 'Z'
      }
    }
    for (let u = -dg; u <= dg; u += step) {
      const sx = u * ca - v * sa + w / 2, sy = u * sa + v * ca + h2 / 2
      if (sx < -mg || sy < -mg || sx > w + mg || sy > h2 + mg) { close(); T = []; B = []; cb = -1; mxw = 0; continue }
      const ix = Math.min(nw - 1, Math.max(0, (sx * S) | 0)), iy = Math.min(nh - 1, Math.max(0, (sy * S) | 0))
      const l = L[iy * nw + ix]
      const ph = u * fr + v * tl
      let y = v
      if (p.cs === 'wave') y += am * Math.sin(ph)
      else if (p.cs === 'ripple') y += am * Math.sin(ph) + am * 0.5 * Math.sin(u * fr * 2.3 - v * tl * 1.7)
      else if (p.cs === 'flow') y += am * Math.sin(ph) + am * 2 * Math.sin(u * 0.006 + v * 0.011) + am * Math.cos(u * 0.011 - v * 0.007)
      y += wp * (l - 0.5) * 2 * Math.sin(u * 0.004 + 1)
      const wd = sp * wt * Math.pow(1 - l, 1.1)
      const b = Math.round(l * (NB - 1))
      const tp = f(u) + ' ' + f(y - wd / 2), bt = f(u) + ' ' + f(y + wd / 2)
      if (cb < 0) { T = [tp]; B = [bt]; cb = b; mxw = wd }
      else if (b !== cb) { T.push(tp); B.push(bt); close(); T = [tp]; B = [bt]; cb = b; mxw = wd }
      else { T.push(tp); B.push(bt); if (wd > mxw) mxw = wd }
    }
    close()
  }
  ctx.save()
  ctx.beginPath(); ctx.rect(ox, oy, w, h2); ctx.clip()
  ctx.translate(ox + w / 2, oy + h2 / 2); ctx.rotate(a)
  const colored = []
  paths.forEach((d2, b) => {
    if (!d2) return
    const col = hx(mix(s, h, b / (NB - 1)))
    colored.push([col, d2])
    ctx.fillStyle = col
    ctx.fill(new Path2D(d2))
  })
  ctx.restore()

  // Perforations
  if (fm) {
    if (transparent) ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = p.c4
    const st = 26, [x0, y0, ww, hh] = bounds
    const nx = Math.round(ww / st), ny = Math.round(hh / st)
    for (let i = 0; i <= nx; i++) { const x = x0 + (i * ww) / nx; for (const y of [y0, y0 + hh]) { ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill() } }
    for (let i = 0; i <= ny; i++) { const y = y0 + (i * hh) / ny; for (const x of [x0, x0 + ww]) { ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill() } }
    ctx.globalCompositeOperation = 'source-over'
  }
  return { canvas: cv, bounds, meta, paths: colored, tint: tintURL, S }
}

/** Crop a transparent render to just the stamp. */
export function cropArt(res) {
  const { canvas, bounds, S } = res
  const c = document.createElement('canvas')
  c.width = bounds[2] * S; c.height = bounds[3] * S
  c.getContext('2d').drawImage(canvas, bounds[0] * S, bounds[1] * S, c.width, c.height, 0, 0, c.width, c.height)
  return c
}

/** Build a true vector SVG from a transparent render. */
export function buildSVG(res, p, poster) {
  const { meta: M, bounds: BX, paths, tint } = res
  let holes = ''
  if (M.fm) {
    const st = 26, x0 = M.ox - M.m, y0 = M.oy - M.m, ww = M.w + 2 * M.m, hh = M.h2 + 2 * M.m
    const nx = Math.round(ww / st), ny = Math.round(hh / st)
    for (let i = 0; i <= nx; i++) { const x = f(x0 + (i * ww) / nx); holes += `<circle cx="${x}" cy="${y0}" r="9"/><circle cx="${x}" cy="${y0 + hh}" r="9"/>` }
    for (let i = 0; i <= ny; i++) { const y = f(y0 + (i * hh) / ny); holes += `<circle cx="${x0}" cy="${y}" r="9"/><circle cx="${x0 + ww}" cy="${y}" r="9"/>` }
  }
  const vb = poster ? [0, 0, W, H] : BX
  const paper = p.np ? '' :
    (M.fm ? `<rect x="${M.ox - M.m}" y="${M.oy - M.m}" width="${M.w + 2 * M.m}" height="${M.h2 + 2 * M.m}" fill="${p.c3}"/>` : '') +
    `<rect x="${M.ox}" y="${M.oy}" width="${M.w}" height="${M.h2}" fill="${p.c3}"/>`
  const tintEl = tint && M.tint > 0 ? `<image x="${M.ox}" y="${M.oy}" width="${M.w}" height="${M.h2}" opacity="${M.tint}" href="${tint}"/>` : ''
  const body = paths.map((q) => `<path fill="${q[0]}" d="${q[1]}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}">` +
    (poster ? `<rect width="${W}" height="${H}" fill="${p.c4}"/>` : '') +
    `<defs><clipPath id="c"><rect x="${M.ox}" y="${M.oy}" width="${M.w}" height="${M.h2}"/></clipPath>` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="${BX[0]}" y="${BX[1]}" width="${BX[2]}" height="${BX[3]}"><rect x="${BX[0]}" y="${BX[1]}" width="${BX[2]}" height="${BX[3]}" fill="#fff"/><g fill="#000">${holes}</g></mask></defs>` +
    `<g mask="url(#m)">${paper}${tintEl}<g clip-path="url(#c)"><g transform="translate(${f(M.ox + M.w / 2)} ${f(M.oy + M.h2 / 2)}) rotate(${f((M.a * 180) / Math.PI)})">${body}</g></g></g></svg>`
}

/** Placeholder image shown before the user uploads one. */
export function demoImage() {
  return new Promise((resolve) => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 760
    const g = c.getContext('2d')
    let r = g.createLinearGradient(0, 0, 0, 760); r.addColorStop(0, '#ddd'); r.addColorStop(1, '#222')
    g.fillStyle = r; g.fillRect(0, 0, 600, 760)
    r = g.createRadialGradient(300, 300, 10, 300, 300, 200); r.addColorStop(0, '#fff'); r.addColorStop(1, '#444')
    g.fillStyle = r; g.beginPath(); g.arc(300, 300, 200, 0, 7); g.fill()
    g.fillStyle = '#111'; g.beginPath(); g.ellipse(300, 700, 260, 200, 0, 0, 7); g.fill()
    g.fillStyle = '#bbb'; g.beginPath(); g.arc(240, 260, 34, 0, 7); g.arc(360, 260, 34, 0, 7); g.fill()
    const i = new Image(); i.onload = () => resolve(i); i.src = c.toDataURL()
  })
}
