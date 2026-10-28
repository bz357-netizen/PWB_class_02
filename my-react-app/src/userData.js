import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore'
import { createNoiseLayer, MAX_NOISE_LAYERS } from './noise.js'
import { MAX_CSG_SOLIDS, createSolid } from './density.js'
import { WEATHER_OPS } from './daylight.js'
import { EVENT_SIMS } from './eventSim.js'
import { CLIMATES, COUNTRIES } from './livingSim.js'
import { MESH_MODES } from './meshing.js'
import { SHADER_STRATEGIES } from './shaders.js'
import { SCATTER_LAYERS } from './scatter.js'
import { BREAK_BUILDINGS } from './deconstruct.js'
import {
  MAX_COLOR_STOPS,
  PLANET_MAPPINGS,
  PLANET_MESHES,
  createColorStops,
  createOceanParams,
} from './planet.js'
import { AGENT_MODES, FOLLOW_MODES, createAgentParams } from './planetAgent.js'
import { MAX_CARS, createTownParams } from './planetTown.js'
import { db } from './firebase.js'

const AGENT_DEFAULTS = { ...createAgentParams(), ...createTownParams() }
const AGENT_MODE_IDS = AGENT_MODES.map((item) => item.id)
const FOLLOW_IDS = FOLLOW_MODES.map((item) => item.id)
const AGENT_RANGES = {
  planetAgentSize: [0.2, 2],
  planetAgentSpeed: [0.2, 3],
  planetAgentAngry: [0, 1],
  planetAgentSurprised: [0, 1],
  planetAgentSad: [0, 1],
  planetTowns: [2, 16],
  planetRoadWidth: [0.2, 1],
  planetHouses: [0, 1],
  planetLamps: [0, 1],
  planetTrees: [0, 1],
  planetCars: [0, MAX_CARS],
  planetTownSeed: [1, 9999],
}

function restoreAgent(source) {
  const out = {
    planetAgent: source.planetAgent !== false,
    planetAgentAuto: source.planetAgentAuto !== false,
    planetFollow: oneOf(source.planetFollow, FOLLOW_IDS, AGENT_DEFAULTS.planetFollow),
    planetAgentMode: oneOf(source.planetAgentMode, AGENT_MODE_IDS, AGENT_DEFAULTS.planetAgentMode),
    planetAgentEmote: null,
    planetRoads: source.planetRoads !== false,
  }
  for (const [key, range] of Object.entries(AGENT_RANGES)) {
    out[key] = num(source[key], AGENT_DEFAULTS[key], ...range)
  }
  return out
}

const WEATHER_IDS = WEATHER_OPS.map((item) => item.id)
const EVENT_IDS = EVENT_SIMS.map((item) => item.id)
const CLIMATE_IDS = CLIMATES.map((item) => item.id)
const COUNTRY_IDS = COUNTRIES.map((item) => item.id)
const MESH_IDS = MESH_MODES.map((item) => item.id)
const SHADER_IDS = SHADER_STRATEGIES.map((item) => item.id)
const BUILDING_IDS = BREAK_BUILDINGS.map((item) => item.id)
const MAPPING_IDS = PLANET_MAPPINGS.map((item) => item.id)
const PLANET_MESH_IDS = PLANET_MESHES.map((item) => item.id)
const HEX = /^#[0-9a-f]{6}$/i

function hexOr(value, fallback) {
  return HEX.test(String(value)) ? String(value) : fallback
}

const OCEAN_DEFAULTS = createOceanParams()
const OCEAN_KEYS = Object.keys(OCEAN_DEFAULTS)
const OCEAN_RANGES = {
  planetSeaLevel: [-3, 3],
  planetOceanRes: [8, 512],
  planetClarity: [0, 1],
  planetWaveSpeed: [0, 3],
  planetWaveScale: [2, 80],
  planetWaveHeight: [0, 0.3],
  planetFoamDepth: [0.01, 1],
  planetFoamSoft: [0, 1],
  planetRippleWidth: [0.02, 0.6],
  planetRippleDistance: [0.05, 3],
}

function restoreOcean(source) {
  const out = {}
  for (const key of OCEAN_KEYS) {
    const fallback = OCEAN_DEFAULTS[key]
    if (typeof fallback === 'boolean') out[key] = source[key] == null ? fallback : source[key] !== false
    else if (typeof fallback === 'string') out[key] = hexOr(source[key], fallback)
    else out[key] = num(source[key], fallback, ...OCEAN_RANGES[key])
  }
  return out
}

function restoreStops(raw, base) {
  const fallback = Array.isArray(base) && base.length >= 2 ? base : createColorStops()
  if (!Array.isArray(raw) || raw.length < 2) return fallback.map((stop) => ({ ...stop }))
  return raw.slice(0, MAX_COLOR_STOPS).map((stop) => ({
    at: num(stop?.at, 0.5, 0, 1),
    color: hexOr(stop?.color, '#808080'),
  }))
}

function num(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function oneOf(value, options, fallback) {
  return options.includes(value) ? value : fallback
}

function restoreScatter(source, base) {
  const raw = source.scatter && typeof source.scatter === 'object' ? source.scatter : {}
  const fallback = base.scatter && typeof base.scatter === 'object' ? base.scatter : {}
  const out = {}
  for (const layer of SCATTER_LAYERS) {
    const item = raw[layer.id] && typeof raw[layer.id] === 'object' ? raw[layer.id] : {}
    const baseLayer = fallback[layer.id] || layer
    let density = item.density
    if (density == null && layer.id === 'trees' && source.treeCover != null) density = source.treeCover
    out[layer.id] = {
      density: num(density, baseLayer.density ?? layer.density, 0, 1),
      cliffs: num(item.cliffs, baseLayer.cliffs ?? layer.cliffs, 0, 1),
      water: num(item.water, baseLayer.water ?? layer.water, 0, 1),
    }
  }
  return out
}

export function snapshotParams(params) {
  return JSON.parse(
    JSON.stringify({
      resolution: params.resolution,
      voxelCells: params.voxelCells,
      csgCells: params.csgCells,
      meshMode: params.meshMode,
      showMesh: params.showMesh !== false,
      shaderStrategy: params.shaderStrategy,
      shaderBand: params.shaderBand,
      shaderFlow: params.shaderFlow,
      shaderWater: params.shaderWater,
      shaderErode: params.shaderErode,
      treeCover: params.treeCover,
      scatter: params.scatter,
      vectorCount: params.vectorCount,
      particleCount: params.particleCount,
      trailLength: params.trailLength,
      fieldResolution: params.fieldResolution,
      timeOfDay: params.timeOfDay,
      weather: params.weather,
      simEvent: params.simEvent,
      simTime: params.simTime,
      climate: params.climate,
      country: params.country,
      breakWind: params.breakWind,
      breakMasonry: params.breakMasonry,
      breakWood: params.breakWood,
      breakGravity: params.breakGravity,
      breakBuilding: params.breakBuilding,
      planetMapping: params.planetMapping,
      planetMesh: params.planetMesh,
      planetDetail: params.planetDetail,
      planetRelief: params.planetRelief,
      ...Object.fromEntries(OCEAN_KEYS.map((key) => [key, params[key]])),
      planetAgent: params.planetAgent !== false,
      planetAgentAuto: params.planetAgentAuto !== false,
      planetFollow: params.planetFollow,
      planetAgentMode: params.planetAgentMode,
      planetRoads: params.planetRoads !== false,
      ...Object.fromEntries(Object.keys(AGENT_RANGES).map((key) => [key, params[key]])),
      planetSpin: params.planetSpin,
      planetStepped: params.planetStepped === true,
      planetStops: params.planetStops,
      layers: params.layers,
      csgSolids: params.csgSolids,
    }),
  )
}

export function restoreParams(saved, base) {
  const source = saved && typeof saved === 'object' ? saved : {}
  const rawLayers =
    Array.isArray(source.layers) && source.layers.length ? source.layers : base.layers
  const rawSolids =
    Array.isArray(source.csgSolids) && source.csgSolids.length ? source.csgSolids : base.csgSolids
  return {
    resolution: num(source.resolution, base.resolution, 95, 1000),
    voxelCells: num(source.voxelCells, base.voxelCells, 8, 64),
    csgCells: num(source.csgCells, base.csgCells, 12, 40),
    meshMode: oneOf(source.meshMode, MESH_IDS, base.meshMode),
    showMesh: source.showMesh !== false,
    shaderStrategy: oneOf(source.shaderStrategy, SHADER_IDS, base.shaderStrategy ?? 'elevation'),
    shaderBand: num(source.shaderBand, base.shaderBand ?? 0.45, 0.15, 1.4),
    shaderFlow: num(source.shaderFlow, base.shaderFlow ?? 6, 2, 14),
    shaderWater: num(source.shaderWater, base.shaderWater ?? 0.15, -2, 6),
    shaderErode: num(source.shaderErode, base.shaderErode ?? 0.42, 0, 1),
    treeCover: num(source.treeCover, base.treeCover ?? 0.64, 0, 1),
    scatter: restoreScatter(source, base),
    vectorCount: num(source.vectorCount, base.vectorCount ?? 140, 40, 400),
    particleCount: num(source.particleCount, base.particleCount ?? 28, 8, 80),
    trailLength: num(source.trailLength, base.trailLength ?? 8, 2, 24),
    fieldResolution: num(source.fieldResolution, base.fieldResolution ?? 18, 8, 36),
    timeOfDay: num(source.timeOfDay, base.timeOfDay, 0, 24),
    weather: oneOf(source.weather, WEATHER_IDS, base.weather),
    simEvent: oneOf(source.simEvent, EVENT_IDS, base.simEvent),
    simPlaying: false,
    simTime: num(source.simTime, 0, 0, 1),
    climate: oneOf(source.climate, CLIMATE_IDS, base.climate),
    country: oneOf(source.country, COUNTRY_IDS, base.country),
    breakWind: num(source.breakWind, base.breakWind ?? 0.22, 0, 1),
    breakMasonry: num(source.breakMasonry, base.breakMasonry ?? 0.62, 0, 1),
    breakWood: num(source.breakWood, base.breakWood ?? 0.48, 0, 1),
    breakGravity: num(source.breakGravity, base.breakGravity ?? 1, 0.2, 2),
    breakBuilding: oneOf(source.breakBuilding, BUILDING_IDS, base.breakBuilding ?? 'residential'),
    breakEpoch: 0,
    breakPulse: null,
    planetMapping: oneOf(source.planetMapping, MAPPING_IDS, base.planetMapping ?? 'noise3d'),
    planetMesh: oneOf(source.planetMesh, PLANET_MESH_IDS, base.planetMesh ?? 'uv'),
    planetDetail: num(source.planetDetail, base.planetDetail ?? 64, 32, 192),
    planetRelief: num(source.planetRelief, base.planetRelief ?? 0.55, 0, 1.5),
    ...restoreOcean(source),
    ...restoreAgent(source),
    planetSpin: num(source.planetSpin, base.planetSpin ?? 0.2, 0, 1),
    planetStepped: source.planetStepped === true,
    planetStops: restoreStops(source.planetStops, base.planetStops),
    layers: rawLayers.slice(0, MAX_NOISE_LAYERS).map((layer) => createNoiseLayer(layer)),
    csgSolids: rawSolids.slice(0, MAX_CSG_SOLIDS).map((solid) => createSolid(solid)),
  }
}

export async function saveSettings(user, name, params) {
  const cleanName = String(name ?? '').trim().slice(0, 40) || 'Untitled'
  await addDoc(collection(db, 'settings'), {
    uid: user.uid,
    name: cleanName,
    createdAt: Date.now(),
    params: snapshotParams(params),
  })
}

export async function listSettings(user) {
  const snap = await getDocs(query(collection(db, 'settings'), where('uid', '==', user.uid)))
  const items = []
  snap.forEach((item) => {
    const data = item.data()
    items.push({
      id: item.id,
      name: data.name || 'Untitled',
      createdAt: data.createdAt || 0,
      params: data.params || {},
    })
  })
  items.sort((a, b) => b.createdAt - a.createdAt)
  return items
}

export async function deleteSettings(id) {
  await deleteDoc(doc(db, 'settings', id))
}
