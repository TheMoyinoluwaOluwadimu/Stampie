// Stamp text: font styles, layouts, and the geometry they need.
// Layouts can reserve extra paper above/below the art ("bands"), so text never covers the picture
// unless the layout asks for it (corner tabs). The same item list drives canvas and SVG output.

export const FONTS = {
  serif: { label: 'Classic serif', family: "Georgia, 'Times New Roman', serif", weight: 700, upper: false, track: 0 },
  condensed: { label: 'Bold condensed', family: "Impact, 'Arial Narrow', Haettenschweiler, sans-serif", weight: 400, upper: true, track: 0.02 },
  sans: { label: 'Modern sans', family: "Helvetica, Arial, 'Helvetica Neue', sans-serif", weight: 700, upper: false, track: -0.01 },
  caps: { label: 'Elegant caps', family: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif", weight: 600, upper: true, track: 0.12 },
  mono: { label: 'Typewriter', family: "'Courier New', Courier, monospace", weight: 700, upper: false, track: 0 },
}

// fields: [param key, label shown in the editor]
export const LAYOUTS = {
  none: { label: 'No text', fields: [] },
  caption: { label: 'Caption', fields: [['t1', 'Title'], ['t2', 'Subtitle']] },
  classic: { label: 'Classic', fields: [['t1', 'Title'], ['t2', 'Subtitle'], ['t3', 'Value'], ['t4', 'Footer']] },
  tabs: { label: 'Corner tabs', fields: [['t1', 'Top-left tab'], ['t3', 'Bottom-right tab']] },
  modern: { label: 'Modern', fields: [['t1', 'Heading'], ['t2', 'Subheading'], ['t3', 'Big value'], ['t4', 'Footer']] },
}

export const TEXT_DEFAULTS = {
  lay: 'none', fnt: 'serif', tz: 100, tc: '#16181f',
  t1: 'Lisbon', t2: 'City of seven hills', t3: '100', t4: 'Portugal 2026',
}

// Base font sizes (px at poster scale) per layout and field, multiplied by the text size slider.
const SIZES = {
  caption: { t1: 44, t2: 22 },
  classic: { t1: 34, t2: 18, t3: 60, t4: 26 },
  tabs: { t1: 44, t3: 40 },
  modern: { t1: 40, t2: 20, t3: 96, t4: 22 },
}
const PAD = 76 // breathing room above and below the text inside its zone

const has = (p, k) => !!(p[k] || '').trim()

/** Extra paper height needed above (bt) and below (bb) the frame margin. */
export function textBands(p, m) {
  const S = SIZES[p.lay]
  if (!S) return { bt: 0, bb: 0 }
  const u = p.tz / 100, gap = 6 * u
  const sz = (k) => (has(p, k) ? S[k] * u : 0)
  const stack = (a, b) => sz(a) + sz(b) + (sz(a) && sz(b) ? gap : 0)
  const zone = (t) => (t > 0 ? Math.max(0, Math.ceil(t + PAD - m)) : 0)
  switch (p.lay) {
    case 'caption': return { bt: 0, bb: zone(stack('t1', 't2')) }
    case 'classic': return { bt: zone(Math.max(stack('t1', 't2'), sz('t3'))), bb: zone(sz('t4')) }
    case 'modern': return { bt: zone(stack('t1', 't2')), bb: zone(Math.max(sz('t3'), sz('t4'))) }
    default: return { bt: 0, bb: 0 }
  }
}

/** Work out every text item's position. `ctx` is only used to measure. */
export function layoutText(ctx, p, M, B) {
  const S = SIZES[p.lay]
  if (!S) return null
  const F = FONTS[p.fnt] || FONTS.serif
  const u = p.tz / 100, gap = 6 * u
  const val = (k) => { const v = (p[k] || '').trim(); return F.upper ? v.toUpperCase() : v }
  const width = (t, size) => {
    ctx.font = `${F.weight} ${size}px ${F.family}`
    if ('letterSpacing' in ctx) ctx.letterSpacing = F.track * size + 'px'
    return ctx.measureText(t).width
  }
  const fit = (t, size, maxW) => { const w0 = width(t, size); return maxW > 0 && w0 > maxW ? (size * maxW) / w0 : size }

  const items = [], plates = []
  const ins = Math.max(0, 26 - M.m) // keep text off the paper edge when there is no frame margin
  const L = M.ox + ins, Wd = M.w - 2 * ins, R = L + Wd
  const topZ = [B[1], M.oy - B[1]]                       // [top, height]
  const botZ = [M.oy + M.h2, B[1] + B[3] - (M.oy + M.h2)]
  const line = (k, maxW) => (has(p, k) ? { k, t: val(k), size: fit(val(k), S[k] * u, maxW) } : null)

  // Vertically centre a stack of lines in a zone. Returns the baselines.
  const place = (lines, z, x, anchor) => {
    const ls = lines.filter(Boolean)
    if (!ls.length) return []
    const total = ls.reduce((a, l) => a + l.size, 0) + gap * (ls.length - 1)
    let y = z[0] + (z[1] - total) / 2
    return ls.map((l) => {
      const base = y + l.size * 0.8
      y += l.size + gap
      items.push({ t: l.t, size: l.size, x, y: base, anchor })
      return base
    })
  }

  if (p.lay === 'caption') {
    place([line('t1', Wd), line('t2', Wd)], botZ, L + Wd / 2, 'middle')
  } else if (p.lay === 'classic') {
    const big = line('t3', Wd * 0.42)
    const bigW = big ? width(big.t, big.size) : 0
    const maxL = Wd - bigW - (big ? 24 * u : 0)
    place([line('t1', maxL), line('t2', maxL)], topZ, L, 'start')
    if (big) place([big], topZ, R, 'end')
    place([line('t4', Wd)], botZ, L, 'start')
  } else if (p.lay === 'modern') {
    place([line('t1', Wd), line('t2', Wd)], topZ, L, 'start')
    const big = line('t3', Wd * 0.62)
    const bigW = big ? width(big.t, big.size) : 0
    const base = big ? place([big], botZ, L, 'start')[0] : null
    const small = line('t4', Wd - bigW - 20 * u)
    if (small) {
      const y = base ?? botZ[0] + (botZ[1] + small.size * 0.6) / 2
      items.push({ t: small.t, size: small.size, x: R, y, anchor: 'end' })
    }
  } else if (p.lay === 'tabs') {
    const px = 14 * u, py = 8 * u
    const tab = (k, right) => {
      const l = line(k, M.w * 0.6 - 2 * px)
      if (!l) return
      const w = width(l.t, l.size) + 2 * px, h = l.size + 2 * py
      const x = right ? M.ox + M.w - w : M.ox, y = right ? M.oy + M.h2 - h : M.oy
      plates.push({ x, y, w, h, c: p.c5 })
      items.push({ t: l.t, size: l.size, x: x + px, y: y + py + l.size * 0.8, anchor: 'start' })
    }
    tab('t1', false); tab('t3', true)
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  return { F, color: p.tc, items, plates }
}

export function drawText(ctx, T) {
  if (!T) return
  for (const r of T.plates) { ctx.fillStyle = r.c; ctx.fillRect(r.x, r.y, r.w, r.h) }
  ctx.fillStyle = T.color
  ctx.textBaseline = 'alphabetic'
  for (const i of T.items) {
    ctx.font = `${T.F.weight} ${i.size}px ${T.F.family}`
    if ('letterSpacing' in ctx) ctx.letterSpacing = T.F.track * i.size + 'px'
    ctx.textAlign = i.anchor === 'middle' ? 'center' : i.anchor === 'end' ? 'right' : 'left'
    ctx.fillText(i.t, i.x, i.y)
  }
  ctx.textAlign = 'left'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const r1 = (n) => Math.round(n * 10) / 10

export function svgText(T) {
  if (!T) return ''
  return T.plates.map((r) => `<rect x="${r1(r.x)}" y="${r1(r.y)}" width="${r1(r.w)}" height="${r1(r.h)}" fill="${r.c}"/>`).join('') +
    T.items.map((i) => `<text x="${r1(i.x)}" y="${r1(i.y)}" font-family="${T.F.family}" font-weight="${T.F.weight}" font-size="${r1(i.size)}" letter-spacing="${r1(T.F.track * i.size)}" text-anchor="${i.anchor}" fill="${T.color}">${esc(i.t)}</text>`).join('')
}
