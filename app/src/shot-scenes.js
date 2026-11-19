// Shot scenes: deterministic full-cover renders used for the entry's
// screenshots. `?shot=cover&scene=<name>` hides the editor chrome and
// renders one exported cover at its exact export size; the screenshot
// driver waits for window.__shotReady. Scenes are recipes, so what the
// screenshot shows is exactly what a user gets from the recipe button.

import { ASPECTS } from './panel-layouts.js';
import { RECIPES } from './grade-presets.js';
import { drawCover } from './cover-renderer.js';
import { SAMPLE_PHOTOS, createState, applyRecipe, buildView } from './studio-editor.js';

const SCENES = {
  face: 'sunset-headliner',
  portrait: 'print-comic',
  square: 'neon-confidential',
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function bootShotScene(params) {
  const sceneName = params.get('scene') || 'face';
  const recipeId = params.get('recipe') || SCENES[sceneName] || 'sunset-headliner';
  const recipe = RECIPES.find((r) => r.id === recipeId) || RECIPES[0];

  document.body.classList.add('shot-mode');
  const state = createState();
  state.photos = await Promise.all(
    SAMPLE_PHOTOS.map(async (s) => {
      const img = await loadImage(`samples/${s.file}`);
      return { img, name: s.name, tag: s.tag };
    }),
  );
  applyRecipe(state, recipe);
  if (params.get('title')) state.captions.title = params.get('title');
  if (params.get('subtitle')) state.captions.subtitle = params.get('subtitle');

  const spec = ASPECTS[state.size];
  const canvas = document.getElementById('shot-canvas');
  canvas.width = spec.w;
  canvas.height = spec.h;
  try {
    await document.fonts.ready;
  } catch (e) { /* fonts fall back */ }
  drawCover(canvas.getContext('2d'), spec.w, spec.h, buildView(state, true));
  requestAnimationFrame(() => {
    window.__shotReady = true;
  });
}
