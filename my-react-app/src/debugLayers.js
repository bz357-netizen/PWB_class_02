/**
 * Debug is a costume change. Each button peels one layer of the pretty
 * planet so you can see the number or the rule underneath.
 */
export const DEBUG_LESSON = [
  {
    id: 'land',
    label: '1. Land',
    see: 'Green is dry land. Yellow is the shore. Blue is water. A house may only stand on green. If you ever saw a house in the lake, it was because we used to test one point. Now the whole footprint has to be green.',
  },
  {
    id: 'elev',
    label: '2. Height',
    see: 'This is the height number at every vertex, low to high. The pretty green and sand bands are only a coloring of this number. The ball is still a smooth hill, not stairs.',
  },
  {
    id: 'graph',
    label: '3. Roads',
    see: 'Cyan lines are the roads the computer actually drew. It tries to connect towns on dry land. If a path would cross water, that path is thrown away. Orange dots are town seeds that never got a road.',
  },
  {
    id: 'refuse',
    label: '4. Refused',
    see: 'Each dot is a house that tried to sit down and was told no. Red = in the water. Cyan = on the road. Orange = too close to another house. Purple = too far from a road. This is the land rule, drawn.',
  },
]

export const DEBUG_MORE = [
  {
    id: 'axes',
    label: 'Axes',
    see: 'Red X, green Y, blue Z. The planet spins around the green stick. These do not spin with the ball.',
  },
  {
    id: 'grid',
    label: 'Grid',
    see: 'Rings through the middle of the planet. They are a ruler in world units. The ball’s radius is 10.',
  },
  {
    id: 'wire',
    label: 'Wire',
    see: 'The net of triangles. Look at the poles: the cells get skinny. That is UV rings, not a bug in the noise.',
  },
  {
    id: 'sites',
    label: 'Sites',
    see: 'Dots on houses, trees, and lamps that did get planted. They sit on the mesh, not on a second map.',
  },
  {
    id: 'agent',
    label: 'Walker',
    see: 'Yellow cage around the robot, blue line for the way it is facing. Walls and tree trunks are solid, so this cage is what bumps them.',
  },
]

const ALL_SEE = [...DEBUG_LESSON, ...DEBUG_MORE]

export const DEBUG_GROUPS = [
  { id: 'lesson', title: 'Try in this order', note: 'Turn on one at a time. The picture will change.', tools: DEBUG_LESSON },
  { id: 'more', title: 'More', note: 'Helpers if you need them.', tools: DEBUG_MORE },
]

export function debugNow(debug = {}) {
  const on = ALL_SEE.filter((tool) => debug[tool.id] === true)
  if (!on.length) {
    return 'Click 1. Land. You should see green land, yellow shore, blue water instead of the pretty colors.'
  }
  if (on.length === 1) return on[0].see
  return `${on[0].see} ${on.length} overlays are on, so it may look noisy. Clear overlays and go one at a time.`
}

export function debugChallenges(params, stats) {
  const items = []
  const meshMs = stats?.ms
  const townMs = stats?.townMs
  const planted = stats?.houses ?? 0
  const refused = stats?.refused ?? 0
  const tried = stats?.tried ?? 0
  const wanted = Math.round(params.planetTowns ?? 9)
  const towns = stats?.towns ?? 0

  if (meshMs != null) {
    items.push({
      id: 'mesh',
      kind: meshMs > 45 ? 'perf' : 'ok',
      title: meshMs > 45 ? 'Slow: rebuilding the ball' : 'Speed: rebuilding the ball is fine',
      detail: `It took ${meshMs} ms this time. If you drag Detail up, this number goes up. The skinny triangles at the poles are from the UV mesh, not from noise.`,
    })
  }

  if (townMs != null) {
    items.push({
      id: 'town',
      kind: townMs > 80 ? 'perf' : 'ok',
      title: townMs > 80 ? 'Slow: laying the town' : 'Speed: laying the town is fine',
      detail: `${townMs} ms. It tried ${tried} houses, planted ${planted}, said no ${refused} times.`,
    })
  }

  if (refused > planted) {
    items.push({
      id: 'rule',
      kind: 'logic',
      title: 'Fight: the land rule vs wanting a full town',
      detail: `More houses were refused (${refused}) than planted (${planted}). Turn on 4. Refused to see the dots. Empty coasts are not a missing texture. The footprint did not fit on dry land.`,
    })
  }

  if (towns < wanted) {
    items.push({
      id: 'islands',
      kind: 'logic',
      title: 'Fight: roads cannot cross water',
      detail: `${towns} of ${wanted} towns made it. Turn on 3. Roads. A line that would go through a lake is deleted, so islands stay alone.`,
    })
  }

  if ((stats?.agent?.stuck ?? 0) >= 2) {
    items.push({
      id: 'jam',
      kind: 'logic',
      title: 'Fight: the walker is stuck',
      detail: `It is bumping ${stats.agent.place ?? 'a house or tree'}. Turn on Walker. The yellow cage is the solid body. Tight lots can trap it.`,
    })
  }

  items.push({
    id: 'shader',
    kind: 'ok',
    title: 'Already fixed: color bands are not stairs',
    detail: 'Turn on 2. Height. That rainbow is what the shader paints. The mesh stays round, like Messenger.',
  })

  return items
}
