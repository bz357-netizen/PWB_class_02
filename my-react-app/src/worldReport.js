import { getNoiseEquation } from './noise.js'
import { PLANET_MAPPINGS, PLANET_MESHES, PLANET_RADIUS, sortedStops } from './planet.js'

function formatPct(value) {
  if (value == null || Number.isNaN(value)) return '…'
  return `${Math.round(value * 100)}%`
}

function mappingLabel(id) {
  return (PLANET_MAPPINGS.find((item) => item.id === id) ?? PLANET_MAPPINGS[0]).label
}

function meshLabel(id) {
  return (PLANET_MESHES.find((item) => item.id === (id === 'cube' ? 'cube' : 'uv')) ?? PLANET_MESHES[0]).label
}

/**
 * Ordered pipeline the planet actually runs. Details use the live params and
 * the last mesh/town stats so Debug can show what this world did, not a slogan.
 */
export function worldBuildReport(params, stats) {
  const steps = []
  const add = (title, detail, state = 'ok') => {
    steps.push({ title, detail, state })
  }

  const layers = Array.isArray(params.layers) ? params.layers : []
  const active = layers.filter((layer) => layer.enabled !== false && (layer.mix ?? 1) > 0)
  const simFallback = active.filter((layer) => getNoiseEquation(layer.equation).simulated)
  add(
    'Noise stack',
    active.length
      ? `${active.length} layer${active.length === 1 ? '' : 's'} on: ${active
          .map((layer) => `${layer.name ?? 'Layer'} ${getNoiseEquation(layer.equation).label}`)
          .join(' · ')}`
      : 'No layers on. The ball would be a smooth sphere.',
    active.length ? 'ok' : 'skip',
  )

  const detail = Math.round(params.planetDetail ?? 64)
  add(
    'Unit sphere',
    `${meshLabel(params.planetMesh)} · ${detail}${
      stats?.vertices != null
        ? ` · ${stats.vertices.toLocaleString()} vertices · ${stats.triangles.toLocaleString()} tris`
        : ''
    }`,
  )

  add(
    'Sample height',
    `${mappingLabel(params.planetMapping)} at each vertex` +
      (simFallback.length
        ? `. ${simFallback.map((layer) => getNoiseEquation(layer.equation).label).join(', ')} only exist on the flat grid, so they fall back to Triplanar.`
        : '.'),
  )

  const hasSpan = stats?.heightMin != null && stats?.heightMax != null
  add(
    'Normalize elevation',
    hasSpan
      ? `aElev 0–1 from this planet’s min ${stats.heightMin.toFixed(2)} to max ${stats.heightMax.toFixed(2)}.`
      : 'Waiting for the first mesh. Then aElev is 0 at the lowest point and 1 at the highest.',
    hasSpan ? 'ok' : 'wait',
  )

  const relief = params.planetRelief ?? 0.55
  add(
    'Displace mesh',
    `r = ${PLANET_RADIUS} + h × ${relief.toFixed(2)}. The mesh stays a hill. Stepped color is not a stair.`,
  )

  const stops = sortedStops(params.planetStops)
  add(
    'Color bands',
    `${stops.length} stops · ${params.planetStepped ? 'stepped' : 'gradient'}. Shader read of aElev only.`,
  )

  const oceanOn = params.planetOcean !== false
  add(
    'Sea',
    oceanOn
      ? `Water sphere at r ${stats?.sea != null ? stats.sea.toFixed(2) : (PLANET_RADIUS + (params.planetSeaLevel ?? 0)).toFixed(2)} · land ${formatPct(stats?.land)} · sea level ${params.planetSeaLevel ?? 0}.`
      : 'Ocean is off. The shore test still uses the sea radius.',
    oceanOn ? 'ok' : 'skip',
  )

  add(
    'Surface sampler',
    stats?.ms != null
      ? `Later queries hit this mesh, not a second copy of the noise. Mesh ${stats.ms} ms.`
      : 'Build a sampler on the displaced mesh so houses and trees sit on the same ground.',
    stats?.ms != null ? 'ok' : 'wait',
  )

  const roadsOn = params.planetRoads !== false
  add(
    'Roads',
    roadsOn
      ? `${stats?.roads ?? 0} paths painted on dry land. Width ${params.planetRoadWidth ?? 0.4}. If a sample hits water, that path is refused.`
      : 'Roads off. No town network.',
    roadsOn ? 'ok' : 'skip',
  )

  add(
    'Towns',
    roadsOn
      ? `${stats?.towns ?? 0} of ${Math.round(params.planetTowns ?? 9)} seeds used. A seed needs dry ground and a gap from the others.${
          stats?.townMs != null ? ` Layout ${stats.townMs} ms.` : ''
        }`
      : 'Skipped. Towns hang off the road network.',
    roadsOn ? 'ok' : 'skip',
  )

  add(
    'Houses',
    roadsOn
      ? `${stats?.houses ?? 0} planted. The whole footprint has to sit above the shore, or the house is refused.`
      : 'Skipped.',
    roadsOn ? 'ok' : 'skip',
  )

  add(
    'Trees',
    `${stats?.trees ?? 0} on dry land, off the roads and lots. Trunks sink a little so they meet the mesh.`,
  )

  add(
    'Lamps and cars',
    `${stats?.lamps ?? 0} lamps on the asphalt · ${Math.round(params.planetCars ?? 0)} cars driving the roads.`,
    roadsOn ? 'ok' : 'skip',
  )

  add(
    'UFO',
    stats?.ufo
      ? 'Saucer over the middle of the ocean. Underside at the tallest tree tops. Deep water, no house.'
      : oceanOn
        ? 'Looking for an ocean basin. If the planet is all land, the saucer stays off.'
        : 'Ocean is off, so the saucer stays hidden.',
    stats?.ufo ? 'ok' : stats?.ufo === false ? 'skip' : oceanOn ? 'wait' : 'skip',
  )

  add(
    'Walker',
    stats?.agent
      ? `On the mesh · ${stats.agent.place ?? stats.agent.zone} · Δ ${stats.agent.delta >= 0 ? '+' : ''}${stats.agent.delta.toFixed(2)}.`
      : params.planetAgent === false
        ? 'Robot is off.'
        : 'Robot still loading, or waiting for a house to sit beside.',
    stats?.agent ? 'ok' : params.planetAgent === false ? 'skip' : 'wait',
  )

  return steps
}
