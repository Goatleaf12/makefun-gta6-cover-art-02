// Editor wiring for Sunset State Cover Studio.
//
// Holds the cover state (photos, panel assignment, per-panel pan/zoom,
// grade, effects, captions, tags), renders the live preview through the
// same drawCover routine the exports use, and handles every control:
// photo add / drag-to-panel, panel drag-pan, scroll-zoom, double-click
// re-centre, fill-all, spread-all, recipes, layouts, grades and exports.

import { ASPECTS, LAYOUTS, layoutById, panelBox } from './panel-layouts.js';
import { GRADES, gradeById, RECIPES, DEFAULT_CAPTIONS } from './grade-presets.js';
import { drawCover, renderCoverCanvas } from './cover-renderer.js';

export const SAMPLE_PHOTOS = [
  { file: 'beach-palms.jpg', name: 'Palm Cove', tag: { place: 'PALM COVE', sub: '6:42 PM · GOLDEN HOUR' } },
  { file: 'ocean-drive-car.jpg', name: 'Ocean Drive', tag: { place: 'OCEAN DRIVE', sub: 'CRUISING AT DUSK' } },
  { file: 'speedboat.jpg', name: 'Turbo Lagoon', tag: { place: 'TURBO LAGOON', sub: 'FULL THROTTLE' } },
  { file: 'neon-street.jpg', name: 'Neon Row', tag: { place: 'NEON ROW', sub: '11:58 PM · AFTER THE RAIN' } },
  { file: 'marina.jpg', name: 'Harbour Lights', tag: { place: 'HARBOUR LIGHTS', sub: 'BLUE HOUR' } },
  { file: 'boardwalk.jpg', name: 'Starlight Pier', tag: { place: 'STARLIGHT PIER', sub: 'FERRIS AT TWILIGHT' } },
  { file: 'rooftop-pool.jpg', name: 'Skyline Roof', tag: { place: 'SKYLINE ROOF', sub: 'THE HIGH LIFE' } },
  { file: 'motel-highway.jpg', name: 'Route 27 Motel', tag: { place: 'ROUTE 27 MOTEL', sub: 'CHECK-IN ANY TIME' } },
  { file: 'lifeguard-beach.jpg', name: 'South Beach', tag: { place: 'SOUTH BEACH', sub: 'ON DUTY' } },
  { file: 'causeway-aerial.jpg', name: 'The Causeway', tag: { place: 'THE CAUSEWAY', sub: 'SEVEN MILES OF SKY' } },
];

export function createState() {
  return {
    photos: [], // {img, name, tag:{place, sub}}
    size: 'wide',
    layoutId: 'hero-classic',
    gradeId: 'vice-sunset',
    fx: { strength: 0.85, contrast: 1, saturation: 1, grain: 0.35, vignette: 0.45 },
    halftone: false,
    paper: true,
    gutterStyle: 'auto',
    showTags: true,
    captions: { ...DEFAULT_CAPTIONS },
    assign: [],
    views: [],
    tagOverrides: {},
    selected: 0,
    activePhoto: 0,
    status: 'LOADING SAMPLE PHOTOS…',
  };
}

export function panelsFor(state) {
  return layoutById(state.layoutId).build(state.size);
}

export function ensureAssignments(state) {
  const count = panelsFor(state).length;
  const n = Math.max(1, state.photos.length);
  while (state.assign.length < count) state.assign.push(state.assign.length % n);
  state.assign.length = count;
  while (state.views.length < count) state.views.push({ dx: 0, dy: 0, zoom: 1 });
  state.views.length = count;
  if (state.selected >= count) state.selected = count - 1;
}

export function spreadPhotos(state) {
  const count = panelsFor(state).length;
  const n = Math.max(1, state.photos.length);
  state.assign = Array.from({ length: count }, (_, i) => i % n);
  state.views = Array.from({ length: count }, () => ({ dx: 0, dy: 0, zoom: 1 }));
}

export function buildView(state, forExport, sizeOverride) {
  const size = sizeOverride || state.size;
  const panels = layoutById(state.layoutId).build(size);
  const n = Math.max(1, state.photos.length);
  const assign = panels.map((_, i) => state.assign[i] ?? i % n);
  const views = panels.map((_, i) => state.views[i] || { dx: 0, dy: 0, zoom: 1 });
  const tags = panels.map((_, i) => {
    if (state.tagOverrides[i]) return state.tagOverrides[i];
    const photo = state.photos[assign[i]];
    return photo ? photo.tag : null;
  });
  return {
    panels,
    photos: state.photos.map((p) => p.img),
    assign,
    views,
    grade: gradeById(state.gradeId),
    fx: state.fx,
    halftone: state.halftone,
    paper: state.paper,
    gutterStyle: state.gutterStyle,
    captions: state.captions,
    tags,
    showTags: state.showTags,
    selected: forExport ? null : state.selected,
    forExport: !!forExport,
  };
}

function pointInPanel(u, v, panel) {
  if (!panel.poly) {
    return u >= panel.x && u <= panel.x + panel.w && v >= panel.y && v <= panel.y + panel.h;
  }
  let inside = false;
  const pts = panel.poly;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function hitPanel(state, u, v) {
  const panels = panelsFor(state);
  for (let i = panels.length - 1; i >= 0; i--) {
    if (pointInPanel(u, v, panels[i])) return i;
  }
  return -1;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function bootEditor(state, els) {
  const render = () => {
    ensureAssignments(state);
    const spec = ASPECTS[state.size];
    const scale = Math.min(1, 1152 / spec.w);
    els.canvas.width = Math.round(spec.w * scale);
    els.canvas.height = Math.round(spec.h * scale);
    drawCover(els.canvas.getContext('2d'), els.canvas.width, els.canvas.height, buildView(state, false));
    els.status.textContent = state.status;
    els.sizeLine.textContent = `${spec.label.toUpperCase()} · ${spec.w} × ${spec.h} PNG`;
    syncPanelPanel(state, els);
  };
  state.render = render;

  // ----- photos -----
  const refreshPhotoGrid = () => {
    els.photoGrid.innerHTML = '';
    state.photos.forEach((photo, i) => {
      const cell = document.createElement('div');
      cell.className = 'photo-cell' + (i === state.activePhoto ? ' active' : '');
      const thumb = document.createElement('img');
      thumb.src = photo.img.src;
      thumb.alt = photo.name;
      thumb.draggable = true;
      thumb.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', String(i));
      });
      const label = document.createElement('span');
      label.textContent = photo.name;
      const fill = document.createElement('button');
      fill.type = 'button';
      fill.textContent = 'FILL ALL';
      fill.title = 'Fill every panel from this photo';
      fill.addEventListener('click', () => {
        state.activePhoto = i;
        state.assign = state.assign.map(() => i);
        state.status = `ALL PANELS FILLED FROM ${photo.name.toUpperCase()}`;
        refreshPhotoGrid();
        render();
      });
      cell.append(thumb, label, fill);
      cell.addEventListener('click', () => {
        state.activePhoto = i;
        refreshPhotoGrid();
      });
      els.photoGrid.appendChild(cell);
    });
  };
  state.refreshPhotoGrid = refreshPhotoGrid;

  const addPhotoFiles = async (files) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        state.photos.push({
          img,
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'My photo',
          tag: { place: 'MY PHOTO', sub: 'ADDED BY YOU' },
        });
      } catch (e) { /* skip unreadable file */ }
    }
    state.status = `${state.photos.length} PHOTOS LOADED`;
    refreshPhotoGrid();
    render();
  };

  els.fileInput.addEventListener('change', () => {
    addPhotoFiles([...els.fileInput.files]);
    els.fileInput.value = '';
  });
  els.btnSpread.addEventListener('click', () => {
    spreadPhotos(state);
    state.status = 'PHOTOS SPREAD ACROSS PANELS';
    render();
  });

  // ----- canvas interaction -----
  let drag = null;
  const canvasPos = (ev) => {
    const r = els.canvas.getBoundingClientRect();
    return { u: (ev.clientX - r.left) / r.width, v: (ev.clientY - r.top) / r.height, px: ev.clientX, py: ev.clientY };
  };
  els.canvas.addEventListener('pointerdown', (ev) => {
    const { u, v, px, py } = canvasPos(ev);
    const hit = hitPanel(state, u, v);
    if (hit >= 0) {
      state.selected = hit;
      drag = { panel: hit, x: px, y: py };
      els.canvas.setPointerCapture(ev.pointerId);
      render();
    }
  });
  els.canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const r = els.canvas.getBoundingClientRect();
    const box = panelBox(panelsFor(state)[drag.panel]);
    const view = state.views[drag.panel];
    view.dx += (ev.clientX - drag.x) / (r.width * box.w);
    view.dy += (ev.clientY - drag.y) / (r.height * box.h);
    view.dx = Math.max(-0.6, Math.min(0.6, view.dx));
    view.dy = Math.max(-0.6, Math.min(0.6, view.dy));
    drag.x = ev.clientX;
    drag.y = ev.clientY;
    render();
  });
  els.canvas.addEventListener('pointerup', () => { drag = null; });
  els.canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const { u, v } = canvasPos(ev);
    const hit = hitPanel(state, u, v);
    if (hit < 0) return;
    state.selected = hit;
    const view = state.views[hit];
    view.zoom = Math.max(1, Math.min(4, view.zoom * Math.exp(-ev.deltaY * 0.0012)));
    render();
  }, { passive: false });
  els.canvas.addEventListener('dblclick', (ev) => {
    const { u, v } = canvasPos(ev);
    const hit = hitPanel(state, u, v);
    if (hit >= 0) {
      state.views[hit] = { dx: 0, dy: 0, zoom: 1 };
      state.selected = hit;
      render();
    }
  });
  els.canvas.addEventListener('dragover', (ev) => ev.preventDefault());
  els.canvas.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const { u, v } = canvasPos(ev);
    const hit = hitPanel(state, u, v);
    if (hit < 0) return;
    if (ev.dataTransfer.files && ev.dataTransfer.files.length) {
      addPhotoFiles([...ev.dataTransfer.files]).then(() => {
        state.assign[hit] = state.photos.length - 1;
        state.selected = hit;
        render();
      });
      return;
    }
    const idx = Number(ev.dataTransfer.getData('text/plain'));
    if (Number.isInteger(idx) && state.photos[idx]) {
      state.assign[hit] = idx;
      state.selected = hit;
      state.status = `PANEL ${hit + 1} ← ${state.photos[idx].name.toUpperCase()}`;
      render();
    }
  });
  els.stage.addEventListener('dragover', (ev) => ev.preventDefault());
  els.stage.addEventListener('drop', (ev) => {
    if (ev.dataTransfer.files && ev.dataTransfer.files.length) {
      ev.preventDefault();
      addPhotoFiles([...ev.dataTransfer.files]);
    }
  });

  // ----- size tabs -----
  els.sizeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      state.size = tab.dataset.size;
      els.sizeTabs.forEach((t) => t.classList.toggle('active', t === tab));
      ensureAssignments(state);
      render();
    });
  });

  // ----- layouts (mini-map picker) -----
  const drawMinimap = (cv, layout) => {
    const mctx = cv.getContext('2d');
    const panels = layout.build(state.size);
    mctx.fillStyle = '#241536';
    mctx.fillRect(0, 0, cv.width, cv.height);
    mctx.fillStyle = '#8f7bb5';
    panels.forEach((p) => {
      if (!p.poly) {
        mctx.fillRect(p.x * cv.width + 1, p.y * cv.height + 1, p.w * cv.width - 2, p.h * cv.height - 2);
      } else {
        mctx.beginPath();
        p.poly.forEach(([x, y], i) => {
          if (i === 0) mctx.moveTo(x * cv.width, y * cv.height);
          else mctx.lineTo(x * cv.width, y * cv.height);
        });
        mctx.closePath();
        mctx.fill();
      }
    });
  };
  els.layoutGrid.innerHTML = '';
  LAYOUTS.forEach((layout) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-btn' + (layout.id === state.layoutId ? ' active' : '');
    btn.dataset.layout = layout.id;
    const cv = document.createElement('canvas');
    cv.width = 76;
    cv.height = 48;
    drawMinimap(cv, layout);
    const name = document.createElement('span');
    name.textContent = layout.name;
    btn.append(cv, name);
    btn.addEventListener('click', () => {
      state.layoutId = layout.id;
      els.layoutGrid.querySelectorAll('.layout-btn').forEach((b) => b.classList.toggle('active', b === btn));
      ensureAssignments(state);
      state.status = `LAYOUT — ${layout.name.toUpperCase()}`;
      render();
    });
    els.layoutGrid.appendChild(btn);
  });
  state.refreshMinimaps = () => {
    els.layoutGrid.querySelectorAll('.layout-btn').forEach((btn) => {
      const layout = layoutById(btn.dataset.layout);
      drawMinimap(btn.querySelector('canvas'), layout);
    });
  };

  // ----- grades -----
  els.gradeList.innerHTML = '';
  GRADES.forEach((grade) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grade-btn' + (grade.id === state.gradeId ? ' active' : '');
    btn.dataset.grade = grade.id;
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = `linear-gradient(135deg, ${grade.overlay.from}, ${grade.overlay.to})`;
    const name = document.createElement('span');
    name.textContent = grade.name;
    btn.append(sw, name);
    btn.addEventListener('click', () => {
      state.gradeId = grade.id;
      if (grade.halftoneDefault) state.halftone = true;
      els.gradeList.querySelectorAll('.grade-btn').forEach((b) => b.classList.toggle('active', b === btn));
      syncFxInputs(state, els);
      state.status = `GRADE — ${grade.name.toUpperCase()}`;
      render();
    });
    els.gradeList.appendChild(btn);
  });

  // ----- recipes -----
  els.recipeList.innerHTML = '';
  RECIPES.forEach((recipe) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recipe-btn';
    btn.textContent = recipe.name;
    btn.addEventListener('click', () => {
      applyRecipe(state, recipe);
      syncAllInputs(state, els);
      state.status = `RECIPE — ${recipe.name.toUpperCase()}`;
      render();
    });
    els.recipeList.appendChild(btn);
  });

  // ----- fx sliders & toggles -----
  const bindSlider = (input, key, fmt) => {
    input.addEventListener('input', () => {
      state.fx[key] = Number(input.value);
      input.nextElementSibling.textContent = fmt(Number(input.value));
      render();
    });
  };
  bindSlider(els.fxStrength, 'strength', (v) => v.toFixed(2));
  bindSlider(els.fxContrast, 'contrast', (v) => v.toFixed(2));
  bindSlider(els.fxSaturation, 'saturation', (v) => v.toFixed(2));
  bindSlider(els.fxGrain, 'grain', (v) => v.toFixed(2));
  bindSlider(els.fxVignette, 'vignette', (v) => v.toFixed(2));
  els.optHalftone.addEventListener('change', () => { state.halftone = els.optHalftone.checked; render(); });
  els.optPaper.addEventListener('change', () => { state.paper = els.optPaper.checked; render(); });
  els.optTags.addEventListener('change', () => { state.showTags = els.optTags.checked; render(); });
  els.optGutter.addEventListener('change', () => { state.gutterStyle = els.optGutter.value; render(); });

  // ----- captions -----
  const bindCaption = (input, key, isNumber) => {
    input.addEventListener('input', () => {
      state.captions[key] = isNumber ? Number(input.value) : input.value;
      render();
    });
  };
  bindCaption(els.capTitle, 'title');
  bindCaption(els.capSubtitle, 'subtitle');
  bindCaption(els.capTagline, 'tagline');
  bindCaption(els.capQuote, 'quote');
  bindCaption(els.capSeal, 'seal');
  bindCaption(els.capSealSub, 'sealSub');
  bindCaption(els.capVolume, 'volume');
  bindCaption(els.capWanted, 'wanted');
  bindCaption(els.capRibbon, 'ribbon');
  bindCaption(els.capStars, 'stars', true);

  // ----- selected panel -----
  els.tagPlace.addEventListener('input', () => {
    const cur = currentTag(state);
    state.tagOverrides[state.selected] = { place: els.tagPlace.value, sub: cur ? cur.sub : '' };
    render();
  });
  els.tagSub.addEventListener('input', () => {
    const cur = currentTag(state);
    state.tagOverrides[state.selected] = { place: cur ? cur.place : '', sub: els.tagSub.value };
    render();
  });
  els.btnRecentre.addEventListener('click', () => {
    state.views[state.selected] = { dx: 0, dy: 0, zoom: 1 };
    render();
  });
  els.btnFillSelected.addEventListener('click', () => {
    const idx = state.assign[state.selected];
    state.assign = state.assign.map(() => idx);
    state.status = `ALL PANELS FILLED FROM PANEL ${state.selected + 1}'S PHOTO`;
    render();
  });

  // ----- export -----
  const doExport = async (sizeKey) => {
    const spec = ASPECTS[sizeKey];
    const view = buildView(state, true, sizeKey);
    const canvas = renderCoverCanvas(spec.w, spec.h, view);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sunset-state-cover-${sizeKey}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    state.status = `SAVED sunset-state-cover-${sizeKey}.png — ${spec.w} × ${spec.h} PNG`;
    render();
  };
  els.exportButtons.forEach((btn) => {
    btn.addEventListener('click', () => doExport(btn.dataset.size));
  });
  els.btnExportAll.addEventListener('click', async () => {
    for (const key of ['wide', 'tall', 'square']) {
      await doExport(key);
    }
    state.status = 'ALL 3 SIZES SAVED — 1920×1080 · 1080×1350 · 1080×1080 PNG';
    render();
  });

  // ----- load samples, compose the opening cover -----
  const loaded = await Promise.all(
    SAMPLE_PHOTOS.map(async (s) => {
      const img = await loadImage(`samples/${s.file}`);
      return { img, name: s.name, tag: s.tag };
    }),
  );
  state.photos = loaded;
  spreadPhotos(state);
  state.status = `READY — ${loaded.length} SAMPLE PHOTOS LOADED`;
  refreshPhotoGrid();
  syncAllInputs(state, els);
  render();
  return { render };
}

function currentTag(state) {
  if (state.tagOverrides[state.selected]) return state.tagOverrides[state.selected];
  const photo = state.photos[state.assign[state.selected]];
  return photo ? photo.tag : { place: '', sub: '' };
}

function syncPanelPanel(state, els) {
  if (!els.panelInfo) return;
  const photo = state.photos[state.assign[state.selected]];
  els.panelInfo.textContent = `PANEL ${state.selected + 1} — ${photo ? photo.name.toUpperCase() : 'EMPTY'}`;
  const tag = currentTag(state);
  if (document.activeElement !== els.tagPlace) els.tagPlace.value = tag ? tag.place : '';
  if (document.activeElement !== els.tagSub) els.tagSub.value = tag ? tag.sub : '';
}

function syncFxInputs(state, els) {
  els.fxStrength.value = state.fx.strength;
  els.fxContrast.value = state.fx.contrast;
  els.fxSaturation.value = state.fx.saturation;
  els.fxGrain.value = state.fx.grain;
  els.fxVignette.value = state.fx.vignette;
  [els.fxStrength, els.fxContrast, els.fxSaturation, els.fxGrain, els.fxVignette].forEach((input) => {
    input.nextElementSibling.textContent = Number(input.value).toFixed(2);
  });
  els.optHalftone.checked = state.halftone;
  els.optPaper.checked = state.paper;
  els.optTags.checked = state.showTags;
  els.optGutter.value = state.gutterStyle;
}

function syncAllInputs(state, els) {
  syncFxInputs(state, els);
  els.capTitle.value = state.captions.title;
  els.capSubtitle.value = state.captions.subtitle;
  els.capTagline.value = state.captions.tagline;
  els.capQuote.value = state.captions.quote;
  els.capSeal.value = state.captions.seal;
  els.capSealSub.value = state.captions.sealSub;
  els.capVolume.value = state.captions.volume;
  els.capWanted.value = state.captions.wanted;
  els.capRibbon.value = state.captions.ribbon;
  els.capStars.value = state.captions.stars;
  els.sizeTabs.forEach((t) => t.classList.toggle('active', t.dataset.size === state.size));
  els.layoutGrid.querySelectorAll('.layout-btn').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layoutId));
  els.gradeList.querySelectorAll('.grade-btn').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.gradeId));
  if (state.refreshMinimaps) state.refreshMinimaps();
}

export function applyRecipe(state, recipe) {
  state.size = recipe.size;
  state.layoutId = recipe.layout;
  state.gradeId = recipe.grade;
  state.gutterStyle = recipe.gutter;
  state.halftone = recipe.halftone;
  state.paper = recipe.paper;
  state.fx = { ...recipe.fx };
  state.captions = { ...recipe.captions };
  state.tagOverrides = {};
  state.selected = 0;
  spreadPhotos(state);
}
