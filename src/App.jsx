import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AsciiReveal, AsciiSkeleton } from 'ascii-reveal'
import './motion.css'
import { renderAsync } from './renderClient.js'
import { FONTS, LAYOUTS } from './text.js'
import { PALETTES, DEFAULTS, W, H, render, cropArt, buildSVG, demoImage } from './engine.js'

function Tip({ text, title }) {
  const [pos, setPos] = useState(null)
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const left = Math.min(Math.max(8, cx - 120), window.innerWidth - 248)
    const up = r.top > 150
    setPos({ left, top: up ? r.top - 12 : r.bottom + 12, transform: up ? 'translateY(-100%)' : undefined, '--ax': cx - left + 'px', down: !up })
  }
  const hide = () => setPos(null)
  const { down, ...style } = pos || {}
  return (
    <span
      className="tip" tabIndex={0} role="img" aria-label={(title ? title + ': ' : '') + text}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); pos ? hide() : show(e) }}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
    >i{pos && createPortal(
      <span className={'tip-pop' + (down ? ' down' : '')} style={style}>{title && <b>{title}</b>}{text}</span>,
      document.body)}</span>
  )
}

function Slider({ label, tip, k, p, set, min, max, step = 1 }) {
  return (
    <>
      <div className="row"><span>{label}{tip && <Tip title={label.replace(/s*(.*)/, '')} text={tip} />}</span><b key={p[k]} className="bump">{p[k]}</b></div>
      <input type="range" min={min} max={max} step={step} value={p[k]} onChange={(e) => set(k, +e.target.value)} />
    </>
  )
}

function ColorField({ label, tip, k, p, set }) {
  return (
    <label><span>{label}{tip && <Tip title={label} text={tip} />}</span><input type="color" value={p[k]} onChange={(e) => set(k, e.target.value)} /></label>
  )
}

// Tiny diagrams of where text goes in each layout
const bar = (x, y, w, h) => <rect key={[x, y, w, h].join()} x={x} y={y} width={w} height={h} rx=".6" className="bar" />
const SCHEMATIC = {
  none: [<rect key="a" x="4" y="4" width="22" height="30" className="art" />],
  caption: [<rect key="a" x="4" y="4" width="22" height="24" className="art" />, bar(8, 30.5, 14, 2.5)],
  classic: [<rect key="a" x="4" y="11" width="22" height="17" className="art" />, bar(4, 4, 10, 2), bar(4, 7, 7, 1.2), bar(19, 4, 7, 4), bar(4, 31, 9, 2)],
  tabs: [<rect key="a" x="3" y="3" width="24" height="32" className="art" />, bar(3, 3, 11, 5), bar(17, 29, 10, 6)],
  modern: [<rect key="a" x="4" y="11" width="22" height="15" className="art" />, bar(4, 4, 12, 2.5), bar(4, 7.5, 8, 1.2), bar(4, 29, 12, 6), bar(19, 32, 7, 1.5)],
}
function Schematic({ id }) {
  return (
    <svg viewBox="0 0 30 38" width="30" height="38" aria-hidden="true">
      <rect x=".5" y=".5" width="29" height="37" rx="2" className="o" />{SCHEMATIC[id]}
    </svg>
  )
}

// Preview with the ascii-reveal loading pattern: an ASCII skeleton holds the space while it renders,
// then the finished image decodes in through the character grid.
// `ratio` is width/height; `art` sizes the skeleton to the smaller art-only preview.
function Preview({ source, label, busy, ratio: initial, art }) {
  const ratio = source ? source.width / source.height : initial
  // Draw in the ref callback (not an effect) so the pixels exist before ascii-reveal measures the canvas.
  const draw = useCallback((c) => {
    if (!c || !source) return
    c.width = source.width; c.height = source.height
    c.getContext('2d').drawImage(source, 0, 0)
  }, [source])
  const showSkel = busy || !source
  return (
    <AsciiReveal className="reveal" preset="dither" loading={showSkel} shimmer={false} fallback={false}>
      {showSkel ? (
        <div className={'skelbox' + (art ? ' art' : '')} style={{ '--r': ratio }} role="status" aria-label="Rendering">
          <AsciiSkeleton variant="dither" rows={90} width="100%" height="100%" />
        </div>
      ) : (
        <canvas ref={draw} aria-label={label} />
      )}
    </AsciiReveal>
  )
}

function save(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function App() {
  const [p, setP] = useState(DEFAULTS)
  const [img, setImg] = useState(null)
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [scope, setScope] = useState('art')
  const [fmt, setFmt] = useState('PNG')
  const [saved, setSaved] = useState(false)
  const [over, setOver] = useState(false)
  const set = (k, v) => setP((o) => ({ ...o, [k]: v }))

  useEffect(() => { demoImage().then(setImg) }, [])

  useEffect(() => {
    if (!img) return
    setBusy(true)
    let done = false
    // Rendering happens in a worker, so the skeleton keeps animating until the result lands.
    // While you edit, a fast Standard-quality draft is shown. Once you stop for a moment the
    // full-quality render replaces it quietly. A draft is never exported.
    const draft = p.quality > 1
    let settle
    const id = setTimeout(() => {
      renderAsync(img, draft ? { ...p, quality: 1 } : p).then(
        (out) => {
          if (done || !out) return
          setRes({ ...out, draft }); setBusy(false)
          if (!draft) return
          settle = setTimeout(() => {
            renderAsync(img, p).then((full) => { if (!done && full) setRes({ ...full, draft: false }) }, () => {})
          }, 350)
        },
        () => { if (!done) setBusy(false) },
      )
    }, 80)
    return () => { done = true; clearTimeout(id); clearTimeout(settle) }
  }, [img, p])

  const load = (file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = url
  }

  const download = async () => {
    if (!res || res.draft) return
    setSaved(true); setTimeout(() => setSaved(false), 1600)
    const poster = scope === 'poster'
    const base = poster ? 'stampie-poster' : 'stampie-art'
    if (fmt === 'SVG') {
      save(new Blob([buildSVG(res.art, p, poster)], { type: 'image/svg+xml' }), base + '.svg')
      return
    }
    let src = poster ? res.poster.canvas : res.crop
    if (fmt === 'JPG') {
      const c = document.createElement('canvas')
      c.width = src.width; c.height = src.height
      const x = c.getContext('2d')
      x.fillStyle = p.c4; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0)
      src = c
    }
    const type = { PNG: 'image/png', WebP: 'image/webp', JPG: 'image/jpeg' }[fmt]
    const ext = { PNG: 'png', WebP: 'webp', JPG: 'jpg' }[fmt]
    src.toBlob((b) => b && save(b, `${base}.${ext}`), type, 0.95)
  }

  return (
    <div className="app">
      <aside className="panel side left">
        <h1>Stampie</h1>
        <p className="s">Turn any image into a wavy engraved line print with a colour blend.</p>
        <label className={'drop' + (over ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files[0]) }}>
          Tap to choose an image, or drop one here
          <input type="file" accept="image/*" hidden onChange={(e) => load(e.target.files[0])} />
        </label>

        <h2>Lines and halftone</h2>
        <Slider label="Line spacing (lower = finer)" tip="Distance between lines. Lower numbers give finer, more detailed lines but take longer to render." k="sp" p={p} set={set} min={1.5} max={14} step={0.5} />
        <Slider label="Line weight" tip="How thick the lines get. Dark areas of the image get thicker lines, light areas thinner." k="wt" p={p} set={set} min={20} max={150} />
        <Slider label="Detail sharpening" tip="Sharpens edges in your image before the lines are drawn so small details stand out more." k="dt" p={p} set={set} min={0} max={100} />
        <div className="cols">
          <label><span>Curve style<Tip title="Curve style" text="Shape of the lines: Wave is smooth, Ripple adds a second wave, Flowing drifts more freely, Straight has no waves." /></span>
            <select value={p.cs} onChange={(e) => set('cs', e.target.value)}>
              <option value="wave">Wave</option>
              <option value="ripple">Ripple</option>
              <option value="flow">Flowing</option>
              <option value="straight">Straight</option>
            </select>
          </label>
        </div>
        <Slider label="Wave amount" tip="How tall the waves are. 0 gives straight lines." k="am" p={p} set={set} min={0} max={20} step={0.5} />
        <Slider label="Wave frequency" tip="How tightly packed the waves are along each line. Higher means more, smaller waves." k="fr" p={p} set={set} min={2} max={160} />
        <Slider label="Ripple tilt (diagonal movement)" tip="Slants the wave pattern from line to line so the ripples move diagonally. 0 is no slant." k="tl" p={p} set={set} min={-100} max={100} />
        <Slider label="Image warp" tip="Bends the lines to follow the shapes in your image, giving a 3D feel." k="wp" p={p} set={set} min={0} max={200} />
        <Slider label="Angle" tip="Rotates the whole line pattern, in degrees." k="an" p={p} set={set} min={-90} max={90} />

        <h2>Image</h2>
        <Slider label="Brightness" tip="Makes the image lighter or darker before the lines are drawn." k="br" p={p} set={set} min={-50} max={50} />
        <Slider label="Contrast" tip="Increases the difference between light and dark. Higher gives bolder, more graphic results." k="co" p={p} set={set} min={50} max={250} />
        <label className="chk"><input type="checkbox" checked={p.inv} onChange={(e) => set('inv', e.target.checked)} /> Invert<Tip title="Invert" text="Swaps light and dark, so bright areas get thick lines instead of thin ones." /></label>
        <label className="chk"><input type="checkbox" checked={p.frame} onChange={(e) => set('frame', e.target.checked)} /> Stamp frame with perforations<Tip title="Stamp frame" text="Adds a paper border with punched holes around the edge, like a postage stamp." /></label>
        <div className="cols">
          <label><span>Render quality<Tip title="Render quality" text="Higher quality makes sharper output but renders slower. Use Standard while editing, Ultra for the final export." /></span>
            <select value={p.quality} onChange={(e) => set('quality', +e.target.value)}>
              <option value={1}>Standard</option>
              <option value={2}>High (2×)</option>
              <option value={3}>Ultra (3×)</option>
            </select>
          </label>
        </div>

      </aside>

      <main className="stage">
        <Preview source={res?.poster.canvas} label="Poster preview" busy={busy} ratio={W / H} />
        <span className="hint">Poster preview ({W}×{H} base size)</span>
        <h2>Art only (transparent)</h2>
        <div className="chk-bg"><Preview source={res?.crop} label="Art only" busy={busy} ratio={0.8} art /></div>
        <span className="hint">The checkerboard is only a preview and is not saved.</span>
      </main>

      <aside className="panel side right">
        <h2>Palettes<Tip title="Palettes" text="One-click colour sets. They fill in all the colour pickers below, which you can still adjust." /></h2>
        <div className="pre">
          {Object.entries(PALETTES).map(([name, c], i) => (
            <button key={name} className="pal" style={{ '--i': i }} onClick={() => setP((o) => ({ ...o, c1: c[0], c2: c[1], c3: c[2], c4: c[3], c5: c[2] }))}>
              <span className="dots">{c.map((x) => <i key={x} style={{ background: x }} />)}</span>{name}
            </button>
          ))}
        </div>
        <div className="cols">
          <ColorField label="Line shadows" tip="Colour of the thickest, darkest parts of the lines (the shadows in your image)." k="c1" p={p} set={set} />
          <ColorField label="Line highlights" tip="Colour of the thinnest, lightest parts of the lines (the highlights). Lines blend between this and the shadow colour." k="c2" p={p} set={set} />
          <ColorField label="Paper" tip="Colour of the paper behind the lines, inside the picture area." k="c3" p={p} set={set} />
          <ColorField label="Border paper" tip="Colour of the stamp border only. It does not change the art or the tint." k="c5" p={p} set={set} />
          <ColorField label="Background" tip="Colour behind the whole stamp. It also shows through the perforation holes." k="c4" p={p} set={set} />
        </div>
        <Slider label="Photo tint (colour blend)" tip="Fades a colour version of your photo in under the lines. 0 is lines only, higher adds more colour blend." k="tint" p={p} set={set} min={0} max={100} />

        <h2>Text<Tip title="Text" text="Add a title, value or caption to your stamp. Each layout makes room for the text around the picture, so the art is never covered." /></h2>
        <div className="opts lay">
          {Object.entries(LAYOUTS).map(([id, l]) => (
            <button key={id} className={'opt' + (p.lay === id ? ' on' : '')} aria-pressed={p.lay === id} onClick={() => set('lay', id)}>
              <Schematic id={id} /><span>{l.label}</span>
            </button>
          ))}
        </div>
        {p.lay !== 'none' && (
          <>
            <div className="opts fnt">
              {Object.entries(FONTS).map(([id, fo]) => (
                <button key={id} className={'opt' + (p.fnt === id ? ' on' : '')} aria-pressed={p.fnt === id} onClick={() => set('fnt', id)}>
                  <b style={{ fontFamily: fo.family, fontWeight: fo.weight, letterSpacing: fo.track + 'em' }}>{fo.upper ? 'AB' : 'Ab'}</b><span>{fo.label}</span>
                </button>
              ))}
            </div>
            {LAYOUTS[p.lay].fields.map(([k, label]) => (
              <label className="txt" key={k}><span>{label}</span>
                <input type="text" value={p[k]} maxLength={40} onChange={(e) => set(k, e.target.value)} />
              </label>
            ))}
            <Slider label="Text size" tip="Scales all the text. The layout makes more or less room around the picture to match." k="tz" p={p} set={set} min={60} max={160} />
            <div className="cols"><ColorField label="Text colour" tip="Colour of the stamp text." k="tc" p={p} set={set} /></div>
          </>
        )}

        <h2>Export</h2>
        <label className="chk"><input type="checkbox" checked={p.np} onChange={(e) => set('np', e.target.checked)} /> Transparent paper (lines only)<Tip title="Transparent paper" text="Removes the paper so only the lines are exported, with a see-through background. Works with PNG, WebP and SVG." /></label>
        <div className="cols">
          <label><span>Scope<Tip title="Scope" text="Art only exports just the stamp. Full poster includes the background around it." /></span>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="art">Art only</option>
              <option value="poster">Full poster</option>
            </select>
          </label>
          <label><span>Format<Tip title="Format" text="PNG and WebP keep transparency. JPG is smallest but has no transparency. SVG is vector and scales without losing quality." /></span>
            <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
              <option>PNG</option><option>SVG</option><option>WebP</option><option>JPG</option>
            </select>
          </label>
        </div>
        <button className={'dl' + (saved ? ' ok' : '')} onClick={download} disabled={!res || res.draft}>{saved ? '✓ Saved' : 'Download'}</button>
      </aside>
    </div>
  )
}
