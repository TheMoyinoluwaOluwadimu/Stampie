// Talks to the render worker. Only the newest request is kept while one is running,
// so dragging a slider never builds up a queue of stale renders.
import { mk } from './engine.js'

let worker, seq = 0, inflight = null, queued = null

const toCanvas = (bmp) => {
  const c = mk(bmp.width, bmp.height)
  c.getContext('2d').drawImage(bmp, 0, 0)
  bmp.close()
  return c
}
const unpack = ({ bitmap, tintBitmap, ...rest }, tint = null) => {
  if (tintBitmap) tint = toCanvas(tintBitmap).toDataURL('image/jpeg', 0.85)
  return { ...rest, canvas: toCanvas(bitmap), tint }
}

function pump() {
  if (inflight || !queued) return
  const job = queued
  queued = null
  inflight = job
  if (!worker) worker = new Worker(new URL('./render.worker.js', import.meta.url), { type: 'module' })
  const id = ++seq
  const finish = (fn) => { worker.removeEventListener('message', on); inflight = null; fn(); pump() }
  const on = (e) => {
    if (e.data.id !== id) return
    if (e.data.error) return finish(() => job.reject(new Error(e.data.error)))
    finish(() => {
      const { poster, art, crop } = e.data.out
      const A = unpack(art) // the poster shares the art's tint image, so encode it once
      job.resolve({ poster: unpack(poster, A.tint), art: A, crop: toCanvas(crop) })
    })
  }
  worker.addEventListener('message', on)
  createImageBitmap(job.img).then(
    (bitmap) => worker.postMessage({ id, bitmap, p: job.p }),
    (err) => finish(() => job.reject(err)),
  )
}

/** Resolves with { poster, art, crop }, or null if a newer request replaced this one. */
export function renderAsync(img, p) {
  return new Promise((resolve, reject) => {
    if (queued) queued.resolve(null)
    queued = { img, p, resolve, reject }
    pump()
  })
}
