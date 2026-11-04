const TALK = {
  water: {
    where: 'underwater',
    chips: [
      { id: 'hi', label: 'Hi' },
      { id: 'wet', label: 'Are you underwater?' },
      { id: 'out', label: 'Can you get back to shore?' },
    ],
    greetings: [
      "I'm under the waterline. The mesh is still here — a house is not allowed.",
      "This is the lake. I can stand on the seabed. I cannot plant a town.",
      "Look up. A saucer is hovering the deep water. Settlement still cannot.",
    ],
    fallbacks: [
      "It's wet down here. Ask me about shore, or why nothing is built in the lake.",
      "Bubbles. I still only know the land rule: stay out of the water to settle.",
    ],
    hi: ["Hi from under the sea. Don't build here.", "Hey. My feet are on the mesh. The mesh is flooded."],
    going: ["Back up the slope, until the ground is dry enough for a house.", "Out. Wherever the radius climbs above the sea."],
    land: ["Dry land is the rule. Under here is a limit, not a lot."],
  },
  shore: {
    where: 'near the water',
    chips: [
      { id: 'hi', label: 'Hi' },
      { id: 'land', label: 'Why stay on dry land?' },
      { id: 'close', label: 'How close is too close?' },
    ],
    greetings: [
      "I'm on the beach. One step wetter and a house would fail the shore test.",
      "Shore is the edge of the rule. Foam is pretty. Planting is not.",
    ],
    fallbacks: [
      "Ask me about the waterline, or why the town stops here.",
      "This is the last dry ring. I can wade. Settlement cannot.",
    ],
    hi: ["Hi. Watch the tide line — that's the plant limit.", "Hey. Dry enough to stand. Barely enough to build."],
    going: ["Along the coast, or back inland if the slope drowns.", "Wherever the ground stays above the sea plus a little extra."],
    land: ["Houses need a shore margin. If I plant here, a corner sits in the lake."],
  },
  house: {
    where: 'by a house',
    chips: [
      { id: 'hi', label: 'Hi' },
      { id: 'who', label: 'Who lives here?' },
      { id: 'through', label: 'Why not walk through?' },
    ],
    greetings: [
      "I'm next to a house. The walls are a box. I walk around, not through.",
      "This lot passed the dry-land test, so a house got to stand here. I just visit.",
    ],
    fallbacks: [
      "Ask me about the walls, the road, or why this house is not in the lake.",
      "I'm the walker, not the resident. The box is solid.",
    ],
    hi: ["Hi. Don't walk into the wall — I already tried.", "Hey. Someone could live here. I just bounce off the footprint."],
    going: ["Around the house, then back to the road. The door is painted, not open.", "Wherever the box isn't. Walls shove me out."],
    land: ["This house sits on dry ground with a shore gap. That's why it gets to exist."],
  },
  road: {
    where: 'on the road',
    chips: [
      { id: 'hi', label: 'Hi' },
      { id: 'going', label: 'Where does this road go?' },
      { id: 'cars', label: 'Watch the cars?' },
    ],
    greetings: [
      "I'm on the asphalt. Roads stay on dry ground, same rule as the houses.",
      "This stripe is a town edge. Cars use it. I try not to stand in the middle.",
    ],
    fallbacks: [
      "Ask me where the road goes, or why it never paints across the lake.",
      "Asphalt, paint, a walker. That's the Messenger street on a class planet.",
    ],
    hi: ["Hi. Keep to the side — cars own the middle.", "Hey. Roads are the skeleton. Houses hang off them."],
    going: ["Along this strip, town to town, as long as the path stays dry.", "Follow the paint. If it hits water, the path was never drawn."],
    land: ["Roads are a mask on dry land. No land, no street, no town."],
  },
  car: {
    where: 'by a car',
    chips: [
      { id: 'hi', label: 'Hi' },
      { id: 'hit', label: 'Did that car hit you?' },
      { id: 'shove', label: 'Why do cars shove back?' },
    ],
    greetings: [
      "There's a car right here. If we bump, it stuns, or I knock it off the road.",
      "Watch it — the cars are solid. They stop, or they get pushed, then they find the asphalt again.",
    ],
    fallbacks: [
      "Ask me about the bump, or how the car finds the road again.",
      "I'm smaller than a house and louder than a tree, to a car.",
    ],
    hi: ["Hi. That car will shove if I keep walking.", "Hey. Don't stand in the grille."],
    going: ["Around the car if I can. If I'm stuck, I turn and pick another heading.", "Not through the chassis. Around, then back to walking."],
    land: ["Cars only spawn on dry roads. If I knock one off, it slides, then snaps back to the paint."],
  },
  forest: {
    where: 'stuck in the trees',
    chips: [
      { id: 'hi', label: 'Hi' },
      { id: 'out', label: 'Can you get out?' },
      { id: 'why', label: 'Why are the trees solid?' },
    ],
    greetings: [
      "I'm boxed in by trunks. The canopy is a hat. The post is a wall.",
      "Forest is in the way. I'll try a sharper turn, then reverse if I have to.",
    ],
    fallbacks: [
      "Ask me how I unstick, or why the trunk counts and the leaves don't.",
      "Too many posts. I need a heading that isn't a tree.",
    ],
    hi: ["Hi. I'm stuck in the trees. Give me a second.", "Hey. Trunks don't move. I do, once I find a gap."],
    going: ["Out of this clump, then wherever the ground is clear.", "Another way. If every heading is a trunk, I reverse."],
    land: ["Trees plant on dry ground too. I just wish they left a path."],
  },
  jammed: {
    where: 'boxed in by house and trees',
    chips: [
      { id: 'hi', label: 'Hi' },
      { id: 'stuck', label: "You're boxed in?" },
      { id: 'way', label: 'Find another way?' },
    ],
    greetings: [
      "House on one side, trunks on the other. That's a dead end until I turn hard.",
      "I'm jammed between a wall and the trees. I'll pick another heading.",
    ],
    fallbacks: [
      "Ask me how I get out, or why the town and the forest both count as solid.",
      "Too much settlement in one pocket. I need a gap.",
    ],
    hi: ["Hi. I'm stuck between a house and the trees.", "Hey. No through-path here. I'm turning."],
    going: ["Not forward. A sharper yaw, or a reverse, then around the lot.", "Wherever this pocket opens. The wall and the trunks both shove."],
    land: ["The house earned its dry lot. The trees did too. Together they closed the path."],
  },
  land: {
    where: 'on dry land',
    chips: [
      { id: 'hi', label: 'Hi' },
      { id: 'going', label: 'Where are you going?' },
      { id: 'land', label: 'Why stay on dry land?' },
    ],
    greetings: [
      "Hey. I'm the walker on this ball. Settlement has to follow the ground — same as me.",
      "You found me. I only stand where the land can hold a house.",
    ],
    fallbacks: [
      "I'm just a walker. Try asking about the land, the water, or the town.",
      "Say that again? I know houses, trees, cars, and dry ground.",
      "Hmm. Ask me where I'm going, or why nothing sits in the lake.",
    ],
    hi: ["Hi. Don't stand in the lake.", "Hey. Watch the cars — they shove back."],
    going: ["Around the ball. If a house, a trunk, or a car is in front, I turn.", "Wherever the mesh is clear."],
    land: ["Towns follow the roads, and roads stay on dry ground. That is the SimCity rule on a Messenger planet."],
  },
}

function pack(ctx = {}) {
  return TALK[ctx.place] ?? TALK.land
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function hourLabel(hour) {
  const t = ((hour ?? 12) + 24) % 24
  if (t < 5 || t >= 21) return 'night'
  if (t < 8) return 'dawn'
  if (t < 11) return 'morning'
  if (t < 16) return 'midday'
  if (t < 19) return 'afternoon'
  return 'evening'
}

export const TALK_CHIPS = TALK.land.chips

export function talkChips(ctx = {}) {
  return pack(ctx).chips
}

export function placeLabel(place) {
  return (TALK[place] ?? TALK.land).where
}

export function agentGreeting(ctx = {}) {
  return { text: pick(pack(ctx).greetings), emote: ctx.place === 'car' || ctx.place === 'jammed' ? 'No' : 'Wave' }
}

/** Short in-world replies. No network. `ctx` may have place, weather, timeOfDay, zone, stuck. */
export function agentReply(line, ctx = {}) {
  const t = String(line ?? '')
    .trim()
    .toLowerCase()
  if (!t) return null
  const lines = pack(ctx)

  if (/\b(hi|hello|hey|yo)\b/.test(t)) {
    return { text: pick(lines.hi), emote: 'Wave' }
  }
  if (/\b(bye|goodbye|later|thanks|thank)\b/.test(t)) {
    return {
      text:
        ctx.place === 'water'
          ? 'I will climb out. See you on the dry side.'
          : ctx.place === 'forest' || ctx.place === 'jammed'
            ? 'I will keep turning until there is a gap.'
            : pick(['See you on the dry side.', 'I will keep walking.']),
      emote: 'ThumbsUp',
    }
  }
  if (/\b(name|who are you|what are you)\b/.test(t)) {
    return {
      text: "I'm the class walker. Same robot as the three.js example, but I have to obey the land.",
      emote: 'Wave',
    }
  }
  if (/\b(where|going|walk|heading|path|way|out|get out)\b/.test(t)) {
    return { text: pick(lines.going), emote: 'Yes' }
  }
  if (/\b(water|lake|ocean|sea|swim|flood|underwater|shore|beach|tide)\b/.test(t)) {
    if (ctx.place === 'water') return { text: pick(lines.land), emote: 'No' }
    if (ctx.place === 'shore') return { text: pick(lines.land), emote: 'No' }
    return {
      text: "Water is a limit, not a texture. A house in the lake means the land is not finished. I can wade. I cannot plant.",
      emote: 'No',
    }
  }
  if (/\b(house|who lives|through|wall|town|city|settlement)\b/.test(t)) {
    if (ctx.place === 'house' || ctx.place === 'jammed') return { text: pick(lines.hi.concat(lines.land)), emote: 'No' }
    return {
      text: "Towns follow the roads, and roads stay on dry ground. That is the SimCity rule on a Messenger planet.",
      emote: 'Yes',
    }
  }
  if (/\b(road|asphalt|street|paint)\b/.test(t)) {
    if (ctx.place === 'road' || ctx.place === 'car') return { text: pick(lines.going), emote: 'Yes' }
    return { text: 'Roads are a mask on dry land. No land, no street, no town.', emote: 'Yes' }
  }
  if (/\b(tree|trunk|forest|canopy|leaves)\b/.test(t)) {
    if (ctx.place === 'forest' || ctx.place === 'jammed') return { text: pick(lines.going), emote: 'No' }
    return {
      text: 'Trunks are solid. I stop, turn, and go around. The canopy is just a hat.',
      emote: 'No',
    }
  }
  if (/\b(car|cars|traffic|hit|shove|grille)\b/.test(t)) {
    if (ctx.place === 'car') return { text: pick(lines.land.concat(lines.hi)), emote: 'Punch' }
    return {
      text: 'If I bump a car it stops, or I knock it off the asphalt. Then it finds the road again.',
      emote: 'Punch',
    }
  }
  if (/\b(weather|rain|sun|storm|fog|night|day)\b/.test(t)) {
    const when = hourLabel(ctx.timeOfDay)
    const wx = ctx.weather && ctx.weather !== 'clear' ? ctx.weather : 'clear'
    return {
      text: `It is ${when} and ${wx}. The sun still makes the relief readable.`,
      emote: 'ThumbsUp',
    }
  }
  if (/\b(stuck|lost|help|boxed|jammed)\b/.test(t)) {
    if (ctx.place === 'forest') return { text: pick(lines.going), emote: 'Yes' }
    if (ctx.place === 'jammed') return { text: pick(lines.going), emote: 'Yes' }
    return {
      text: 'If I get boxed in I try a sharper turn, then I reverse. Ask me about the land if you want the rule.',
      emote: 'Yes',
    }
  }
  if (/\b(ufo|saucer|alien|ship)\b/.test(t)) {
    return {
      text: 'A saucer sits over the middle of the ocean. Deep water, no land, no house. That is the point.',
      emote: 'Wave',
    }
  }
  if (/\b(messenger)\b/.test(t)) {
    return {
      text: 'Messenger is the look: toon ink, roads painted on the ball, a person walking. The land here is ours.',
      emote: 'Wave',
    }
  }
  if (/\b(close|too close|margin)\b/.test(t) && ctx.place === 'shore') {
    return { text: pick(lines.land), emote: 'No' }
  }

  return { text: pick(lines.fallbacks), emote: 'No' }
}
