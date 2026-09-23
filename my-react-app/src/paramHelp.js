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
  'Voxel cells':
    'How many cubes across the xz plane. 24 is chunky and fast. 48 is the default. 64 is finer but heavier to rebuild.',
  'Time of day':
    'Moves the sun (or moon) around the terrace. Dawn and dusk make long warm shadows. Noon is high and bright. Night dims the land and brings stars back.',
  Weather:
    'Changes the sky, fog, and rain. Clear has sharp sunlight. Overcast is gray and soft. Fog hides distance. Rain and Storm wet the mesh and add falling drops.',
  Scenario:
    'Pick a seasonal simulation that paints maps and the 3D terrace. Forest fire spreads a burn front. Flood season raises water in the valleys. Heavy snow builds a snowpack on high ground. Hydraulic erosion uses D8 flow accumulation and stream-power incision. Living settlement marks where villages, roads, and highways would likely grow on this landscape.',
  Climate:
    'Environmental rules for living settlement. Arid favors valleys. Alpine stays off the steepest slopes. Tropical and monsoon avoid the wettest low ground. Coastal hugs gentler edges.',
  Country:
    'Settlement pattern. Netherlands and the United States lay denser, more gridded roads. Japan and Switzerland follow valleys. Egypt clings to low land. India and China pack more villages. Norway stays sparse along easier coastal grades.',
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
  'CSG op':
    'How this solid combines with the shape built so far. Union keeps both. Subtract cuts this solid out. Intersect keeps only the overlap. Smooth versions fillet the join. The first solid is always the base.',
  Shape:
    'Signed distance primitive. Negative density is inside. Sphere, box, torus, cylinder, capsule, cone, octahedron, half-space, and gyroid are included.',
  'Smooth k':
    'Blend radius for smooth union, subtract, and intersect. 0 is a sharp crease. Larger k rounds the join.',
  'CSG cells':
    'How many voxels along each axis. Cost grows with the cube of this number times how many solids you stack. 16 is coarse. 28 is the default. 40 is finer and slower. Empty chunks are skipped.',
  Mesh:
    'How the density field becomes triangles. Cubes keep a quad per face. Greedy merges flat faces. Marching cubes places vertices where the density crosses zero.',
  'Position x': 'Move this solid along world X.',
  'Position y': 'Move this solid along world Y. The density slice cuts at this height.',
  'Position z': 'Move this solid along world Z.',
  'Rotate rx': 'Pitch this solid around local X, in degrees.',
  'Rotate ry': 'Yaw this solid around local Y, in degrees.',
  'Rotate rz': 'Roll this solid around local Z, in degrees. Use this to aim a cylinder tunnel.',
  'Radius r':
    'Primitive size. For a sphere this is the radius. For a cylinder or capsule it is the shaft radius.',
  'Major r': 'Distance from the torus center to the tube center.',
  'Tube t': 'Radius of the torus tube.',
  Fillet: 'How much the box edges are rounded before the density is evaluated.',
  Thickness: 'Gyroid wall half-width. Larger means chunkier foam.',
  'Width X': 'Box or ellipsoid size along local X.',
  'Height Y': 'Box size along local Y.',
  'Depth Z': 'Box or ellipsoid size along local Z.',
  'Radius X': 'Ellipsoid radius along local X.',
  'Radius Y': 'Ellipsoid radius along local Y.',
  'Radius Z': 'Ellipsoid radius along local Z.',
  'Half-height': 'Cylinder or cone extent along local Y, from the center to each end.',
  'Half-length': 'Capsule shaft length from the center to each rounded end.',
  'Base r': 'Cone radius at the wide end.',
  'Size s': 'Octahedron radius, measured to the axis tips.',
  Frequency: 'How tight the gyroid repeats. Higher frequency means smaller cells.',
}

export function getParamHelp(label, key) {
  if (key && PARAM_HELP[key]) return PARAM_HELP[key]
  return PARAM_HELP[label] ?? ''
}
