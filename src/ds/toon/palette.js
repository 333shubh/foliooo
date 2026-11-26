// 3D mirror of tokens.css. Every toon surface is three flat tones:
//   shade (faces away from the light) · base · light (faces the light).
// Colours are written as they should appear on screen (colour management is
// off in stage.js), so a hex here is the exact hex you see.

export const ink = '#160923';

export const tones = {
  violet:  { shade: '#3d1b5c', base: '#5b2785', light: '#8a47b8' },
  rock:    { shade: '#22102f', base: '#2f1547', light: '#4a2a66' },
  lilac:   { shade: '#a368d4', base: '#d28eff', light: '#f3d2ff' },
  pod:     { shade: '#b77ae6', base: '#dba2ff', light: '#f6dcff' },
  glass:   { shade: '#4a1f6e', base: '#6d2d93', light: '#a368d4' },
  lime:    { shade: '#4fcf6a', base: '#a6f78f', light: '#d9ffc4' },
  crystal: { shade: '#a368d4', base: '#e2a4ff', light: '#fbe6ff' },
  cloudPink: { shade: '#e9a6f2', base: '#f6c2fb', light: '#ffe3ff' },
  cloudWhite: { shade: '#c9d4ff', base: '#eef1ff', light: '#ffffff' },
  teal:    { shade: '#1f5a55', base: '#2a7a6f', light: '#3a9a85' },
  water:   { shade: '#9a6ee8', base: '#c58cf5', light: '#e6b8ff' },
  sand:    { shade: '#9c3f2c', base: '#d4704e', light: '#f29a72' },
  mesa:    { shade: '#6e2a24', base: '#9c4535', light: '#c4644a' },
  grass:   { shade: '#3f8a4e', base: '#6cbf5f', light: '#a6e083' },
  leaf:    { shade: '#2f7a46', base: '#4fae5a', light: '#86d66e' },
  trunk:   { shade: '#5a2a1e', base: '#7a3a26', light: '#9a5236' },
  planet:  { shade: '#4a1f6e', base: '#7a3aa8', light: '#b06fe0' },
  stone:   { shade: '#7a4a6a', base: '#a06b8b', light: '#c897b0' },
  metal:   { shade: '#6b6488', base: '#9c95bb', light: '#cdc8e6' },
  white:   { shade: '#cfc6e6', base: '#f3efff', light: '#ffffff' },
  red:     { shade: '#a8203a', base: '#e0394f', light: '#ff7a86' },
  roof:    { shade: '#5b2785', base: '#7a3aa8', light: '#a368d4' },
  // the Moon (Work): pale regolith, dark slabs, a coral gas giant
  moon:     { shade: '#5d5287', base: '#9d90c8', light: '#d9cff3' },
  moonDeep: { shade: '#463c6e', base: '#7466a6', light: '#a99cd6' },
  slab:     { shade: '#120a24', base: '#1f1338', light: '#3a2a5e' },
  coral:    { shade: '#c4566a', base: '#f08a7e', light: '#ffc2a8' },
  peach:    { shade: '#d98a6a', base: '#ffbe94', light: '#ffe2c4' },
  ring:     { shade: '#b98fd6', base: '#e9c4ff', light: '#fff0ff' },

};

// One palette per world. The sky is a 3-stop vertical gradient; fog fades
// distant terrain into the horizon colour so the outlines fade with it.
export const worlds = {
  space: {
    label: 'Outer space',
    sky: ['#1d0a33', '#4a1f6e', '#8a47b8'],
    fog: '#5b2785', fogNear: 40, fogFar: 140,
    light: [0.5, 0.8, 0.6],
    stars: 1, constellation: true,
  },
  water: {
    label: 'Water world',
    sky: ['#f3b8ff', '#b9a6f7', '#8aa2f2'],
    fog: '#b2a8f6', fogNear: 30, fogFar: 120,
    light: [-0.4, 0.9, 0.5],
    stars: 0, constellation: false,
  },
  earth: {
    label: 'Earth world',
    sky: ['#3f7ff0', '#7fb2ff', '#c4d9ff'],
    fog: '#b8d0ff', fogNear: 35, fogFar: 140,
    light: [0.6, 0.9, 0.3],
    stars: 0, constellation: false,
  },
  golden: { // About: hills at golden hour
    label: 'Golden hills',
    sky: ['#6f6be0', '#f2a2c6', '#ffc58e'],
    fog: '#f3b4a6', fogNear: 50, fogFar: 230,
    light: [0.8, 0.38, 0.32],
    stars: 0, constellation: false,
  },
  lagoon: { // Contact: the lagoon at dusk
    label: 'Lagoon at dusk',
    sky: ['#24206e', '#7a58d4', '#f39ec8'],
    fog: '#8d6fd8', fogNear: 40, fogFar: 200,
    light: [-0.6, 0.42, 0.5],
    stars: 0.6, constellation: false,
  },
  galaxy: { // Work: a star system where every project is its own planet
    label: 'A star system',
    sky: ['#070418', '#1c0f45', '#4a2380'],
    fog: '#1c0f45', fogNear: 80, fogFar: 260,
    light: [-0.75, 0.35, 0.5],
    stars: 1.6, constellation: false,
  },
  moon: { // Work: a quiet lunar plain under a ringed planet
    label: 'The Moon',
    sky: ['#0b0724', '#2a1a5c', '#8a62c9'],
    fog: '#3b2a78', fogNear: 45, fogFar: 240,
    light: [0.75, 0.45, 0.35],
    stars: 1.2, constellation: false,
  },
  dusk: { // the "night lake" window: water world after dark, constellations out
    label: 'Night lake',
    sky: ['#2f22c4', '#5a45e6', '#c38df0'],
    fog: '#7c5cf0', fogNear: 30, fogFar: 120,
    light: [-0.5, 0.7, 0.5],
    stars: 0.7, constellation: true,
  },
};
