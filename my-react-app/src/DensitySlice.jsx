import { useEffect, useRef } from 'react'
import { GRID_SIZE } from './noise.js'
import { csgFingerprint, sampleDensity } from './density.js'

const MAP_PX = 160

export default function DensitySlice({ params, selected = 0 }) {
  const canvasRef = useRef(null)
  const solids = params.csgSolids ?? []
  const fingerprint = csgFingerprint(params)
  const yCut = solids[selected]?.y ?? 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    const image = ctx.createImageData(width, height)
    const data = image.data
    const half = GRID_SIZE / 2

    for (let py = 0; py < height; py++) {
      const z = (py / (height - 1)) * GRID_SIZE - half
      for (let px = 0; px < width; px++) {
        const x = (px / (width - 1)) * GRID_SIZE - half
        const d = sampleDensity(x, yCut, z, params)
        const inside = d < 0
        const band = Math.abs(d) < 0.35
        const t = Math.min(1, Math.max(0, 0.5 - d * 0.06))
        let r
        let g
        let b
        if (band) {
          r = 62
          g = 224
          b = 255
        } else if (inside) {
          r = 36 + 70 * t
          g = 92 + 110 * t
          b = 48 + 40 * t
        } else {
          const fog = 18 + 28 * t
          r = fog
          g = fog + 6
          b = fog + 10
        }
        const i = (py * width + px) * 4
        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
  }, [fingerprint, yCut, params])

  return (
    <aside className="noise-panel panel-frame" aria-label="Density slice">
      <h2>Density slice</h2>
      <p className="panel-note equation">d = op(d, solid) · y = {yCut.toFixed(1)}</p>
      <p className="panel-note">{solids.length} sequential solids · cyan = isosurface</p>
      <canvas ref={canvasRef} className="noise-map" width={MAP_PX} height={MAP_PX} />
    </aside>
  )
}
