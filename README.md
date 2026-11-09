# Stampie

Turn any image into an engraved, wavy-line print with a colour blend, in the style of postage-stamp illustrations.

## Features
- Upload or drop any image
- Wavy engraved lines whose thickness follows the image (dark = thick, light = thin)
- Curve styles: Wave, Ripple, Flowing, Straight, plus amount, frequency, tilt and angle controls
- Colour blend between line shadows and highlights, paper and background colours, optional photo tint
- Optional stamp frame with perforated edges
- Export as PNG, SVG (true vector), WebP or JPG, as art only (transparent) or as a full poster

## Run it
```bash
npm install
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173).

## Build
```bash
npm run build     # outputs to dist/
npm run preview   # serve the build locally
```

## Project structure
```
src/engine.js   Rendering engine (canvas, SVG export), no dependencies
src/App.jsx     UI and export handling
src/styles.css  Styles (light and dark)
```

## Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: Stampie"
git branch -M main
git remote add origin https://github.com/<your-username>/stampie.git
git push -u origin main
```

## Deploy to GitHub Pages (optional)
`vite.config.js` already uses `base: './'`, so the contents of `dist/` can be served from any path. Build, then publish `dist/` with your preferred method (for example the `gh-pages` package or a GitHub Actions Pages workflow).
