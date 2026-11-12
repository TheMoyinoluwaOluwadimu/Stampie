// Renders the stamp off the main thread so the page (and the ASCII skeleton) stays animated.
import { render, cropArt, mk, W, H } from './engine.js'

const pack = ({ canvas, tintSrc, ...rest }) => ({
  ...rest,
  bitmap: canvas.transferToImageBitmap(),
  tintBitmap: tintSrc ? tintSrc.transferToImageBitmap() : null,
})

self.onmessage = (e) => {
  const { id, bitmap, p } = e.data
  try {
    // One render does both: the poster is the transparent art laid over the background colour.
    // Only "transparent paper" needs a second pass, because the poster still shows its paper.
    const art = render(bitmap, p, true)
    let poster
    if (p.np) poster = render(bitmap, p, false)
    else {
      const cv = mk(W * p.quality, H * p.quality)
      const x = cv.getContext('2d')
      x.fillStyle = p.c4; x.fillRect(0, 0, cv.width, cv.height)
      x.drawImage(art.canvas, 0, 0)
      poster = { ...art, canvas: cv, tintSrc: null }
    }
    const crop = cropArt(art).transferToImageBitmap()
    const out = { poster: pack(poster), art: pack(art), crop }
    const transfer = [out.poster.bitmap, out.art.bitmap, crop]
    if (out.art.tintBitmap) transfer.push(out.art.tintBitmap)
    if (out.poster.tintBitmap) transfer.push(out.poster.tintBitmap)
    self.postMessage({ id, out }, transfer)
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) })
  }
}
