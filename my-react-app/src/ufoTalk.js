const CHIPS = [
  { id: 'why', label: 'Why here?' },
  { id: 'build', label: 'Can I build under you?' },
  { id: 'under', label: 'What is under you?' },
]

const GREET =
  'I park over the middle of the ocean. Deep water, no land, no house. That is the point.'

export function ufoChips() {
  return CHIPS
}

export function ufoGreeting() {
  return GREET
}

export function ufoReply(line) {
  const t = String(line ?? '').trim().toLowerCase()
  if (!t) return null
  if (/\b(why|here|park|hover|sit|middle|center)\b/.test(t)) {
    return 'Farthest water from land. If a house could stand here, the land rule is broken.'
  }
  if (/\b(build|house|town|settle|road|plant)\b/.test(t)) {
    return 'No. A house needs a dry footprint. A road needs dry ground. Under me is sea.'
  }
  if (/\b(under|below|water|ocean|sea|lake|wet)\b/.test(t)) {
    return 'Water. The mesh is still there, pushed in. Settlement is not allowed on it.'
  }
  if (/\b(walker|robot|person|agent)\b/.test(t)) {
    return 'The walker is on land. Click them for the town. I only watch the water.'
  }
  if (/\b(beam|light|scan)\b/.test(t)) {
    return 'The beam is a look, not a city. Nothing plants in it.'
  }
  if (/\b(messenger)\b/.test(t)) {
    return 'Messenger is the look. The rule is ours: stay out of the water to settle.'
  }
  return 'Ask why I sit here, or whether you can build. The answer is the shore test.'
}
