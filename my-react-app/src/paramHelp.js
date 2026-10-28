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
  shaderBand: 'World height between contour lines. Smaller bands pack the lines closer.',
  shaderFlow: 'How many downhill streaks cross the slope. Direction comes from the surface normal.',
  shaderWater:
    'Height of the shore. Land below this reads as water. Scatter layers use this line when they decide to stay dry or gather at the edge. The height grid is not rebuilt.',
  shaderErode:
    'How far the unknown has climbed out of the valleys. Gullies run ahead of the front. Eaten ground drops into a glitch void, and trees there break apart.',
  treeCover:
    'How much gentle ground is planted. Tall trees fill the low land, medium trees the middle slopes, short trees the high ground. Cliffs stay bare.',
  treesDensity:
    'How thick the tree layer is. 0 clears the trees. 1 fills every spot the cliff and water rules allow. High ground stays a little thinner.',
  rocksDensity:
    'How many stones are placed. They still only land on cliffs or near the water, so a high value packs those places rather than covering the flats.',
  bushesDensity:
    'How thick the shrub layer is inside its slope and water band. Wetter ground inside that band grows more of them.',
  windmillsDensity:
    'How many mills to try. The layer stays sparse. Higher values look for more flat sites, not a forest of mills.',
  cliffAvoid:
    'How willing this layer is to climb steep ground. Low values avoid cliffs. High values allow steeper slopes.',
  rockCliffs:
    'How strongly rocks seek cliffs. Low values let them sit on milder slopes. High values keep them on steep ground. Shore stones still appear when Water is high.',
  scatterWater:
    'Where this layer sits relative to the water line. Low values stay dry and higher up. High values pull it onto the shore.',
  vectorCount:
    'How many streaks cover the water. Higher values fill the surface so the currents and the vortices are easier to read.',
  particleCount:
    'How many motes ride the field. A few are fish in the valley and one is the bear. The rest are wind on the spiral.',
  trailLength:
    'How many steps each mote remembers. Short trails keep the ground clear. Longer trails show where the wind, the fish, and the bear have been.',
  fieldResolution:
    'How fine the flow grid is. Higher resolution follows the valleys and the whirlpools more closely. It does not change the terrain mesh.',
  breakWind:
    'Steady push on the tree. Low wind only leans the crown. High wind bends the limbs until a joint snaps. Gust is a short burst on top of this.',
  breakMasonry:
    'How much tension, shear, and bending the columns and floor joints can take. Low values let a quake open the frame. High values keep the tower standing.',
  breakWood:
    'How much bending the trunk and branches can take. A gust snaps one joint and the limb above it falls in one piece.',
  breakGravity:
    'Pull on every loose piece. It also sets how much weight each joint has to carry. Higher gravity makes spans fail sooner.',
  planetRelief:
    'How far the noise height pushes the ground out from the center. 0 is a smooth ball. Higher values raise taller mountains and dig deeper basins. Amplitude A on each layer still sets which layer wins.',
  planetSpin: 'How fast the planet turns under the sun. 0 holds it still.',
  planetTowns:
    'How many towns to place on land. Roads link every town to its neighbors and add a few loops. Roads never cross water, so islands stay separate.',
  planetRoadWidth: 'Width of the asphalt in world units. The paved curb adds a little on each side.',
  planetHouses:
    'How tightly houses cluster around each town and line the roads. Their walls block the robot. 0 removes them.',
  planetLamps: 'Street lamp spacing. They alternate sides of the road. 0 removes them.',
  planetTrees: 'How many trees grow on land away from the roads and houses.',
  planetCars: 'How many cars drive the roads. At each town they pick a new road at random.',
  planetAgentSize:
    'Height of the robot in world units. Default 0.5 is about 5% of the planet radius, so houses and trees stand taller than the person, as on Messenger.',
  planetAgentSpeed:
    'Walking pace in world units per second. Run multiplies it. House walls block the capsule; water is entered by standing on the seabed, so the robot wades instead of floating.',
  planetDetail:
    'Mesh resolution. On UV rings it is the segment count around the planet and from pole to pole. On Cube it is the cell count along each face. Higher detail shows finer coastlines and ridges but takes longer to rebuild.',
  planetStop:
    'Where this color sits on the elevation scale. 0 is the lowest point on the planet, 1 is the highest. Gradient blends between neighbors. Stepped holds each color until the next stop.',
  planetSeaLevel:
    'The water is a sphere of radius base + sea level, in world units. Below 0 sinks it under the base sphere so more land shows: archipelagos and peaks. Above 0 floods the world into scattered islands. 0 sits at the planet’s average surface. If you raise Relief a lot, lower this to keep coastlines.',
  planetOceanRes:
    'Width and height segments of the water sphere, 8 to 512. The water is smooth, so it rarely needs to match the ground. Raise it only if a large wave Height shows facets or the coastline looks polygonal.',
  planetClarity:
    'How see-through the open water is. 0 is nearly opaque. Higher values let the sea floor show. Foam and ripples always stay solid.',
  planetDeep: 'Open water, far from land.',
  planetShallow:
    'The band approaching the coast, four times the coastline Depth wide. Close to Deep gives a uniform sea. Strong contrast gives a tropical lagoon.',
  planetFoam:
    'The bright line at the waterline, and the color of the ripple rings. A near-white tint reads best.',
  planetWaveSpeed:
    'How fast the water moves. It also scrolls the ripple rings, so 0 freezes both.',
  planetWaveScale: 'How many swells cross the sphere. Higher values make more, tighter waves.',
  planetWaveHeight:
    'How far the surface bobs in and out, in world units. Keep it small so the water shimmers instead of churning. Large values need a higher Resolution.',
  planetFoamDepth:
    'How deep the water can be and still count as near the coast. It sets the foam line width and, four times over, the shallow band. Raising it pushes the whole shallow zone out to sea.',
  planetFoamSoft:
    'The foam line’s edge. 0 is a crisp rim. 1 is a wide, hazy fade. To widen only the shallow tint without a thick rim, raise Depth and drop Softness.',
  planetRippleWidth:
    'Spacing and thickness of each ring. Small values pack many thin rings near the shore. Large values give a few bold bands.',
  planetRippleDistance:
    'How far from the shore the rings reach before they fade. It is separate from coastline Depth, so a thin foam rim can pair with rings that travel far out.',
}

export function getParamHelp(label, key) {
  if (key && PARAM_HELP[key]) return PARAM_HELP[key]
  return PARAM_HELP[label] ?? ''
}
