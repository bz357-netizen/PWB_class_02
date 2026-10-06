import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore'
import { createNoiseLayer, MAX_NOISE_LAYERS } from './noise.js'
import { MAX_CSG_SOLIDS, createSolid } from './density.js'
import { WEATHER_OPS } from './daylight.js'
import { EVENT_SIMS } from './eventSim.js'
import { CLIMATES, COUNTRIES } from './livingSim.js'
import { MESH_MODES } from './meshing.js'
import { SHADER_STRATEGIES } from './shaders.js'
import { SCATTER_LAYERS } from './scatter.js'
import { db } from './firebase.js'

const WEATHER_IDS = WEATHER_OPS.map((item) => item.id)
const EVENT_IDS = EVENT_SIMS.map((item) => item.id)
const CLIMATE_IDS = CLIMATES.map((item) => item.id)
const COUNTRY_IDS = COUNTRIES.map((item) => item.id)
const MESH_IDS = MESH_MODES.map((item) => item.id)
const SHADER_IDS = SHADER_STRATEGIES.map((item) => item.id)

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
