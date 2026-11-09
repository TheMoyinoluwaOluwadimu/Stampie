import { useEffect, useRef, useState } from 'react'
import { PALETTES, DEFAULTS, W, H, render, cropArt, buildSVG, demoImage } from './engine.js'

function Slider({ label, k, p, set, min, max, step = 1 }) {
  return (
    <>
      <div className="row"><span>{label}</span><b>{p[k]}</b></div>
      <input type="range" min={min} max={max} step={step} value={p[k]} onChange={(e) => set(k, +e.target.value)} />
    </>
  )
}

function ColorField({ label, k, p, set }) {
  return (
    <label>{label}<input type="color" value={p[k]} onChange={(e) => set(k, e.target.value)} /></label>
  )
}

function CanvasView({ source, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!source || !ref.current) return
    const c = ref.current
    c.width = source.width; c.height = source.height
    c.getContext('2d').drawImage(source, 0, 0)
  }, [source])
  return <canvas ref={ref} aria-label={label} />
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
        <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files[0]) }}>
          Tap to choose an image, or drop one here
          <input type="file" accept="image/*" hidden onChange={(e) => load(e.target.files[0])} />
        </label>

        <h2>Palettes</h2>
        <div className="pre">
          {Object.entries(PALETTES).map(([name, c]) => (
            <button key={name} onClick={() => setP((o) => ({ ...o, c1: c[0], c2: c[1], c3: c[2], c4: c[3] }))}>{name}</button>
          ))}
        </div>
        <div className="cols">
          <ColorField label="Line shadows" k="c1" p={p} set={set} />
          <ColorField label="Line highlights" k="c2" p={p} set={set} />
          <ColorField label="Paper" k="c3" p={p} set={set} />
          <ColorField label="Background" k="c4" p={p} set={set} />
        </div>
        <Slider label="Photo tint (colour blend)" k="tint" p={p} set={set} min={0} max={100} />

        <h2>Lines and halftone</h2>
        <Slider label="Line spacing (lower = finer)" k="sp" p={p} set={set} min={1.5} max={14} step={0.5} />
        <Slider label="Line weight" k="wt" p={p} set={set} min={20} max={150} />
        <Slider label="Detail sharpening" k="dt" p={p} set={set} min={0} max={100} />
        <div className="cols">
          <label>Curve style
            <select value={p.cs} onChange={(e) => set('cs', e.target.value)}>
              <option value="wave">Wave</option>
              <option value="ripple">Ripple</option>
              <option value="flow">Flowing</option>
              <option value="straight">Straight</option>
            </select>
          </label>
        </div>
        <Slider label="Wave amount" k="am" p={p} set={set} min={0} max={20} step={0.5} />
        <Slider label="Wave frequency" k="fr" p={p} set={set} min={2} max={160} />
        <Slider label="Ripple tilt (diagonal movement)" k="tl" p={p} set={set} min={-100} max={100} />
        <Slider label="Image warp" k="wp" p={p} set={set} min={0} max={200} />
        <Slider label="Angle" k="an" p={p} set={set} min={-90} max={90} />

        <h2>Image</h2>
        <Slider label="Brightness" k="br" p={p} set={set} min={-50} max={50} />
        <Slider label="Contrast" k="co" p={p} set={set} min={50} max={250} />
        <label className="chk"><input type="checkbox" checked={p.inv} onChange={(e) => set('inv', e.target.checked)} /> Invert</label>
        <label className="chk"><input type="checkbox" checked={p.frame} onChange={(e) => set('frame', e.target.checked)} /> Stamp frame with perforations</label>
        <div className="cols">
          <label>Render quality
            <select value={p.quality} onChange={(e) => set('quality', +e.target.value)}>
              <option value={1}>Standard</option>
              <option value={2}>High (2×)</option>
              <option value={3}>Ultra (3×)</option>
            </select>
          </label>
        </div>

        <h2>Export</h2>
        <label className="chk"><input type="checkbox" checked={p.np} onChange={(e) => set('np', e.target.checked)} /> Transparent paper (lines only)</label>
        <div className="cols">
          <label>Scope
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="art">Art only</option>
              <option value="poster">Full poster</option>
            </select>
          </label>
          <label>Format
            <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
              <option>PNG</option><option>SVG</option><option>WebP</option><option>JPG</option>
            </select>
          </label>
        </div>
        <button className="dl" onClick={download} disabled={!res}>Download</button>
      </aside>

      <main className="stage">
        {busy && <span className="hint">Rendering…</span>}
        {res && <CanvasView source={res.poster.canvas} label="Poster preview" />}
        <span className="hint">Poster preview ({W}×{H} base size)</span>
        <h2>Art only (transparent)</h2>
        <div className="chk-bg">{res && <CanvasView source={res.crop} label="Art only" />}</div>
        <span className="hint">The checkerboard is only a preview and is not saved.</span>
      </main>
    </div>
  )
}
