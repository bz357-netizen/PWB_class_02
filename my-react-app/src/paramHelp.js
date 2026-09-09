export const PARAM_HELP = {
  'Edit layer':
    'Choose which noise layer you are editing. Each layer has its own equation and sliders. The 3D terrain is all layers mixed together.',
  Mix: 'How strong this layer is in the stack. 0 turns the layer off. 1 uses it at full strength.',
  Blend:
    'How this layer combines with the layers under it. Add piles height on top. Mix fades toward this layer. Max keeps peaks. Min keeps valleys. Multiply punches holes.',
  Equation:
    'The recipe that builds this layer’s height. Analytic types (Perlin, Value, Simplex…) are formulas. Gray–Scott, Erosion, Waves, and Diffusion are simulations that bake a map, then we sample it.',
  'Frequency f':
    'How stretched or tight the pattern is. Low frequency = large rolling hills. High frequency = small, busy detail.',
  'Amplitude A':
    'How tall the hills are. This is the “volume” of the layer. 0 is flat. Higher values raise and lower the grid more.',
  Octaves:
    'How many copies of the pattern we stack, each one smaller than the last. More octaves add fine detail. 1 is a simple wave.',
  'Lacunarity L':
    'How quickly each octave gets smaller (higher frequency). 2 means each extra octave is twice as tight as the one before.',
  'Persistence P':
    'How strong those extra octaves stay. High persistence = crunchy detail. Low persistence = the first octave (big shapes) wins.',
  'Offset ox':
    'Slide the pattern along X. Same as panning a texture. Also used as a seed shift for simulations.',
  'Offset oz':
    'Slide the pattern along Z. Together with ox this lets you hunt for a nicer part of the field.',
  Operation:
    'A remap applied after the noise equation, before amplitude. Identity leaves n as-is. Billow, Ridged, Power, Terrace, Clamp, and Gain change the shape of hills and valleys.',
  Resolution:
    'How many cells the 3D plane uses. Snap to 95, 300, 500, or 1000, or drag up to 1000. 95 is light. 300 is the default. 500 and 1000 show finer drainage but take longer to rebuild.',
  'Time of day':
    'Moves the sun (or moon) around the terrace. Dawn and dusk make long warm shadows. Noon is high and bright. Night dims the land and brings stars back.',
  Weather:
    'Changes the sky, fog, and rain. Clear has sharp sunlight. Overcast is gray and soft. Fog hides distance. Rain and Storm wet the mesh and add falling drops.',
  Scenario:
    'Pick a seasonal simulation that paints maps and the 3D terrace. Forest fire spreads a burn front. Flood season raises water in the valleys. Heavy snow builds a snowpack on high ground. Hydraulic erosion uses D8 flow accumulation and stream-power incision: smooth noise becomes dendritic river networks and sharp ridges.',
  Timeline:
    'Where you are in the event. Drag to jump. Press Start to play forward, Stop to pause, Reset to go back to the beginning.',
  'Sharpness k':
    'For Ridged: how sharp the mountain creases are. Higher k makes thin, pointy ridges.',
  'Ridge offset':
    'Shifts the ridge pattern so peaks line up differently. Try this if ridges sit in the wrong place.',
  'Exponent e':
    'For Power: raises |n| to this power. Above 1 flattens most of the land and keeps a few spikes. Below 1 makes slopes gentler.',
  Steps:
    'How many times the simulation updates. More steps = a more “finished” map, but it takes longer when you move a slider.',
  Sharpness:
    'For Terrace: 0 is a smooth slope, 1 is hard stair-steps. In between is a blend of both.',
  Low: 'For Clamp: the lowest noise value allowed. Anything below this is cut off (flatten the bottoms).',
  High: 'For Clamp: the highest noise value allowed. Anything above this is cut off (flatten the tops).',
  'Gain g':
    'Contrast around the middle. Higher gain pushes values toward black and white, so hills and valleys look punchier.',
  'Feed F':
    'Gray–Scott feed rate. Small changes make spots, stripes, or worms. Move it slowly and watch the U and V maps.',
  'Kill K':
    'Gray–Scott kill rate. Together with Feed F it picks a pattern family. Look up a Gray–Scott “FK diagram” if you want known recipes.',
  Droplets:
    'How many rain drops carve the erosion map. More droplets = more river-like grooves and deposited sediment.',
  Damping:
    'How fast waves die out. Low damping = ripples keep ringing. High damping = the surface settles quickly.',
  shapeMix:
    'How far to blend from the original noise toward the billow shape (|n|). 0 is unchanged, 1 is full billow hills.',
}

export function getParamHelp(label, key) {
  if (key && PARAM_HELP[key]) return PARAM_HELP[key]
  return PARAM_HELP[label] ?? ''
}
