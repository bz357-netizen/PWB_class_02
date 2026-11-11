import { worldBuildReport } from './worldReport.js'

/**
 * Tiny Glade-style reveal of THIS planet. Holds add up to 3:30 at 1×
 * so a recorded pass is presentation length. Rate 1 is the talk clock.
 */
export const PROCESS_STAGES = [
  {
    id: 'sphere',
    title: 'Unit sphere',
    report: 'Unit sphere',
    hold: 16,
    flags: {
      wire: true,
      filled: false,
      land: false,
      ocean: false,
      roads: false,
      houses: false,
      trees: false,
      lamps: false,
      cars: false,
      ufo: false,
      agent: false,
    },
  },
  {
    id: 'height',
    title: 'Sample height',
    report: 'Sample height',
    hold: 18,
    flags: {
      wire: true,
      filled: true,
      land: true,
      ocean: false,
      roads: false,
      houses: false,
      trees: false,
      lamps: false,
      cars: false,
      ufo: false,
      agent: false,
    },
  },
  {
    id: 'color',
    title: 'Color bands',
    report: 'Color bands',
    hold: 18,
    flags: {
      wire: false,
      filled: true,
      land: false,
      ocean: false,
      roads: false,
      houses: false,
      trees: false,
      lamps: false,
      cars: false,
      ufo: false,
      agent: false,
    },
  },
  {
    id: 'sea',
    title: 'Sea',
    report: 'Sea',
    hold: 18,
    flags: {
      wire: false,
      filled: true,
      land: false,
      ocean: true,
      roads: false,
      houses: false,
      trees: false,
      lamps: false,
      cars: false,
      ufo: false,
      agent: false,
    },
  },
  {
    id: 'roads',
    title: 'Roads',
    report: 'Roads',
    hold: 18,
    flags: {
      wire: false,
      filled: true,
      land: false,
      ocean: true,
      roads: true,
      houses: false,
      trees: false,
      lamps: false,
      cars: false,
      ufo: false,
      agent: false,
    },
  },
  {
    id: 'houses',
    title: 'Houses',
    report: 'Houses',
    hold: 20,
    flags: {
      wire: false,
      filled: true,
      land: false,
      ocean: true,
      roads: true,
      houses: true,
      trees: false,
      lamps: false,
      cars: false,
      ufo: false,
      agent: false,
    },
  },
  {
    id: 'trees',
    title: 'Trees',
    report: 'Trees',
    hold: 20,
    flags: {
      wire: false,
      filled: true,
      land: false,
      ocean: true,
      roads: true,
      houses: true,
      trees: true,
      lamps: false,
      cars: false,
      ufo: false,
      agent: false,
    },
  },
  {
    id: 'lamps',
    title: 'Lamps and cars',
    report: 'Lamps and cars',
    hold: 16,
    flags: {
      wire: false,
      filled: true,
      land: false,
      ocean: true,
      roads: true,
      houses: true,
      trees: true,
      lamps: true,
      cars: true,
      ufo: false,
      agent: false,
    },
  },
  {
    id: 'ufo',
    title: 'UFO',
    report: 'UFO',
    hold: 16,
    flags: {
      wire: false,
      filled: true,
      land: false,
      ocean: true,
      roads: true,
      houses: true,
      trees: true,
      lamps: true,
      cars: true,
      ufo: true,
      agent: false,
    },
  },
  {
    id: 'walker',
    title: 'Walker',
    report: 'Walker',
    hold: 20,
    flags: {
      wire: false,
      filled: true,
      land: false,
      ocean: true,
      roads: true,
      houses: true,
      trees: true,
      lamps: true,
      cars: true,
      ufo: true,
      agent: true,
    },
  },
  {
    id: 'world',
    title: 'This world',
    report: 'Noise stack',
    hold: 30,
    flags: {
      wire: false,
      filled: true,
      land: false,
      ocean: true,
      roads: true,
      houses: true,
      trees: true,
      lamps: true,
      cars: true,
      ufo: true,
      agent: true,
    },
  },
]

export function createProcessParams() {
  return {
    processOn: false,
    processPaused: false,
    processRate: 1,
    processSeek: null,
    processRecord: false,
  }
}

export function processDuration(stages = PROCESS_STAGES) {
  return stages.reduce((sum, stage) => sum + stage.hold, 0)
}

export function processStageStart(index, stages = PROCESS_STAGES) {
  const i = Math.max(0, Math.min(stages.length - 1, Math.round(index) || 0))
  let time = 0
  for (let n = 0; n < i; n++) time += stages[n].hold
  return time
}

export function processAt(time, stages = PROCESS_STAGES) {
  const total = processDuration(stages)
  const clamped = Math.max(0, Math.min(total, Number(time) || 0))
  let rest = clamped
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    if (rest < stage.hold || i === stages.length - 1) {
      return {
        index: i,
        local: rest,
        stage,
        total,
        time: clamped,
        done: clamped >= total - 1e-4,
      }
    }
    rest -= stage.hold
  }
  const last = stages[stages.length - 1]
  return { index: stages.length - 1, local: last.hold, stage: last, total, time: total, done: true }
}

export function processCaption(stage, params, stats) {
  if (stage.id === 'world') {
    return {
      title: stage.title,
      detail:
        'The same pipeline Debug lists, played in order. Seed stays locked so this world can play again.',
      step: PROCESS_STAGES.length,
      steps: PROCESS_STAGES.length,
    }
  }
  const report = worldBuildReport(params, stats)
  const hit = report.find((item) => item.title === stage.report)
  const step = report.findIndex((item) => item.title === stage.report)
  return {
    title: stage.title,
    detail: hit?.detail ?? '',
    step: step >= 0 ? step + 1 : 1,
    steps: report.length,
  }
}

export function formatProcessTime(seconds) {
  const t = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(t / 60)
  const s = Math.floor(t - m * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
