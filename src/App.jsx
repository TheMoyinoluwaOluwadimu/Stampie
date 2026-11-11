import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './motion.css'
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

function CanvasView({ source, label, busy }) {
  const ref = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    if (!source || !ref.current) return
    const c = ref.current
    c.width = source.width; c.height = source.height
    c.getContext('2d').drawImage(source, 0, 0)
    // Reveal like a print coming off the press: wipe down + settle
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !c.animate) return
    const intro = first.current
    first.current = false
    c.animate(
      intro
        ? [{ clipPath: 'inset(0 0 100% 0)', opacity: 0.4, transform: 'scale(.985)' }, { clipPath: 'inset(0 0 0% 0)', opacity: 1, transform: 'scale(1)' }]
        : [{ clipPath: 'inset(0 0 100% 0)', opacity: 0.7 }, { clipPath: 'inset(0 0 0% 0)', opacity: 1 }],
      { duration: intro ? 700 : 450, easing: 'cubic-bezier(.2,.7,.2,1)' }
    )
  }, [source])
  return (
    <div className={'view' + (busy ? ' busy' : '')}>
      <canvas ref={ref} aria-label={label} />
      <div className="pill" role="status" aria-live="polite"><i className="spin" />Rendering…</div>
    </div>
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
    const id = setTimeout(() => {
      const poster = render(img, p, false)
      const art = render(img, p, true)
      setRes({ poster, art, crop: cropArt(art) })
      setBusy(false)
    }, 80)
    return () => clearTimeout(id)
  }, [img, p])

  const load = (file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = url
  }

  const download = async () => {
    if (!res) return
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
      <aside className="panel">
        <h1>Stampie</h1>
        <p className="s">Turn any image into a wavy engraved line print with a colour blend.</p>
        <label className={'drop' + (over ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files[0]) }}>
          Tap to choose an image, or drop one here
          <input type="file" accept="image/*" hidden onChange={(e) => load(e.target.files[0])} />
        </label>

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
        <button className={'dl' + (saved ? ' ok' : '')} onClick={download} disabled={!res}>{saved ? '✓ Saved' : 'Download'}</button>
      </aside>

      <main className="stage">
        <div className={'bar' + (busy ? ' on' : '')} aria-hidden="true" />
        {res && <CanvasView source={res.poster.canvas} label="Poster preview" busy={busy} />}
        <span className="hint">Poster preview ({W}×{H} base size)</span>
        <h2>Art only (transparent)</h2>
        <div className="chk-bg">{res && <CanvasView source={res.crop} label="Art only" busy={busy} />}</div>
        <span className="hint">The checkerboard is only a preview and is not saved.</span>
      </main>
    </div>
  )
}
