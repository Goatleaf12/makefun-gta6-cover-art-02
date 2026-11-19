// Sunset State Cover Studio — entry point.
//
// Normal load boots the editor (samples preloaded, a finished cover
// already composed). `?shot=cover&scene=…` renders a single exported
// cover for screenshots; `?shot=editor` boots the editor with a recipe
// applied so the editor screenshot shows a composed cover too.

import { createState, bootEditor, applyRecipe } from './studio-editor.js';
import { RECIPES } from './grade-presets.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

function editorElements() {
  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => [...document.querySelectorAll(sel)];
  return {
    canvas: q('#preview-canvas'),
    stage: q('#stage'),
    status: q('#status-line'),
    sizeLine: q('#size-line'),
    photoGrid: q('#photo-grid'),
    fileInput: q('#file-input'),
    btnSpread: q('#btn-spread'),
    sizeTabs: qa('.size-tab'),
    layoutGrid: q('#layout-grid'),
    gradeList: q('#grade-list'),
    recipeList: q('#recipe-list'),
    fxStrength: q('#fx-strength'),
    fxContrast: q('#fx-contrast'),
    fxSaturation: q('#fx-saturation'),
    fxGrain: q('#fx-grain'),
    fxVignette: q('#fx-vignette'),
    optHalftone: q('#opt-halftone'),
    optPaper: q('#opt-paper'),
    optTags: q('#opt-tags'),
    optGutter: q('#opt-gutter'),
    capTitle: q('#cap-title'),
    capSubtitle: q('#cap-subtitle'),
    capTagline: q('#cap-tagline'),
    capQuote: q('#cap-quote'),
    capSeal: q('#cap-seal'),
    capSealSub: q('#cap-sealsub'),
    capVolume: q('#cap-volume'),
    capWanted: q('#cap-wanted'),
    capRibbon: q('#cap-ribbon'),
    capStars: q('#cap-stars'),
    panelInfo: q('#panel-info'),
    tagPlace: q('#tag-place'),
    tagSub: q('#tag-sub'),
    btnRecentre: q('#btn-recentre'),
    btnFillSelected: q('#btn-fill-selected'),
    exportButtons: qa('.btn-export'),
    btnExportAll: q('#btn-export-all'),
  };
}

async function boot() {
  if (shot === 'cover') {
    const { bootShotScene } = await import('./shot-scenes.js');
    await bootShotScene(params);
    return;
  }
  const state = createState();
  const els = editorElements();
  document.getElementById('btn-add-photos').addEventListener('click', () => els.fileInput.click());
  await bootEditor(state, els);
  if (shot === 'editor') {
    const recipe = RECIPES.find((r) => r.id === (params.get('recipe') || 'sunset-headliner')) || RECIPES[0];
    applyRecipe(state, recipe);
    state.selected = 0;
    state.status = `READY — ${state.photos.length} SAMPLE PHOTOS LOADED`;
    state.render();
    try {
      await document.fonts.ready;
    } catch (e) { /* ignore */ }
    state.render();
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  }
}

boot();
