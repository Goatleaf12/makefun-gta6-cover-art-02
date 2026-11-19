// Panel geometry for Sunset State Cover Studio.
//
// Every layout is defined per aspect ('wide' 16:9, 'tall' 4:5, 'square' 1:1)
// in unit space (0..1 on both axes). A panel is either a rect {x, y, w, h}
// or a polygon {poly: [[x, y], ...]} for the slanted comic layouts. The
// renderer scales unit space to the export size and insets each panel by
// half the gutter, so neighbouring panels share one clean gutter line.

function rect(x, y, w, h) {
  return { x, y, w, h };
}

function quad(x0, y0, x1, y1, x2, y2, x3, y3) {
  return { poly: [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] };
}

// A horizontal band split by slanted dividers: `cuts` are the divider
// x-positions at the band's vertical middle; `slant` leans the top edge
// of each divider left by that much and the bottom edge right.
function slantedRow(y0, y1, cuts, slant) {
  const edges = [0, ...cuts, 1];
  const panels = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i];
    const b = edges[i + 1];
    const topA = i === 0 ? 0 : a - slant;
    const botA = i === 0 ? 0 : a + slant;
    const topB = i === edges.length - 2 ? 1 : b - slant;
    const botB = i === edges.length - 2 ? 1 : b + slant;
    panels.push(quad(topA, y0, topB, y0, botB, y1, botA, y1));
  }
  return panels;
}

function grid3x3() {
  const panels = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      panels.push(rect(c / 3, r / 3, 1 / 3, 1 / 3));
    }
  }
  return panels;
}

export const ASPECTS = {
  wide: { label: 'Landscape', w: 1920, h: 1080 },
  tall: { label: 'Portrait', w: 1080, h: 1350 },
  square: { label: 'Square', w: 1080, h: 1080 },
};

export const LAYOUTS = [
  {
    id: 'hero-classic',
    name: 'Hero Classic',
    build(aspect) {
      if (aspect === 'tall') {
        return [
          rect(0, 0, 1, 0.52),
          rect(0, 0.535, 0.49, 0.215),
          rect(0.51, 0.535, 0.49, 0.215),
          rect(0, 0.765, 0.49, 0.235),
          rect(0.51, 0.765, 0.49, 0.235),
        ];
      }
      if (aspect === 'square') {
        return [
          rect(0, 0, 0.55, 0.62),
          rect(0.565, 0, 0.435, 0.62),
          rect(0, 0.635, 0.32, 0.365),
          rect(0.335, 0.635, 0.32, 0.365),
          rect(0.67, 0.635, 0.33, 0.365),
        ];
      }
      return [
        rect(0, 0, 0.55, 1),
        rect(0.565, 0, 0.435, 0.32),
        rect(0.565, 0.335, 0.435, 0.32),
        rect(0.565, 0.67, 0.21, 0.33),
        rect(0.79, 0.67, 0.21, 0.33),
      ];
    },
  },
  {
    id: 'hero-right',
    name: 'Hero Right',
    build(aspect) {
      if (aspect === 'tall') {
        return [
          rect(0, 0.48, 1, 0.52),
          rect(0, 0.25, 0.49, 0.215),
          rect(0.51, 0.25, 0.49, 0.215),
          rect(0, 0, 0.49, 0.235),
          rect(0.51, 0, 0.49, 0.235),
        ];
      }
      if (aspect === 'square') {
        return [
          rect(0.45, 0, 0.55, 0.62),
          rect(0, 0, 0.435, 0.62),
          rect(0, 0.635, 0.33, 0.365),
          rect(0.345, 0.635, 0.32, 0.365),
          rect(0.68, 0.635, 0.32, 0.365),
        ];
      }
      return [
        rect(0.45, 0, 0.55, 1),
        rect(0, 0, 0.435, 0.32),
        rect(0, 0.335, 0.435, 0.32),
        rect(0, 0.67, 0.21, 0.33),
        rect(0.225, 0.67, 0.21, 0.33),
      ];
    },
  },
  {
    id: 'comic-slant',
    name: 'Comic Slant',
    build(aspect) {
      if (aspect === 'tall') {
        return [
          ...slantedRow(0, 0.34, [0.55], 0.045),
          ...slantedRow(0.355, 0.66, [0.45], 0.045),
          ...slantedRow(0.675, 1, [0.5], 0.045),
        ];
      }
      if (aspect === 'square') {
        return [
          ...slantedRow(0, 0.4, [0.58], 0.05),
          ...slantedRow(0.415, 0.72, [0.42], 0.05),
          ...slantedRow(0.735, 1, [0.55], 0.05),
        ];
      }
      return [
        ...slantedRow(0, 0.52, [0.6], 0.04),
        ...slantedRow(0.535, 1, [0.38, 0.68], 0.04),
      ];
    },
  },
  {
    id: 'grid-nine',
    name: 'Grid 3×3',
    build() {
      return grid3x3();
    },
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    build(aspect) {
      if (aspect === 'tall') {
        return [
          rect(0, 0, 0.58, 0.36),
          rect(0.595, 0, 0.405, 0.24),
          rect(0.595, 0.255, 0.405, 0.28),
          rect(0, 0.375, 0.58, 0.27),
          rect(0, 0.66, 0.32, 0.34),
          rect(0.335, 0.66, 0.33, 0.34),
          rect(0.68, 0.55, 0.32, 0.45),
        ];
      }
      if (aspect === 'square') {
        return [
          rect(0, 0, 0.46, 0.5),
          rect(0.475, 0, 0.525, 0.3),
          rect(0.475, 0.315, 0.25, 0.34),
          rect(0.74, 0.315, 0.26, 0.34),
          rect(0, 0.515, 0.46, 0.485),
          rect(0.475, 0.67, 0.25, 0.33),
          rect(0.74, 0.67, 0.26, 0.33),
        ];
      }
      return [
        rect(0, 0, 0.38, 0.55),
        rect(0.395, 0, 0.29, 0.38),
        rect(0.70, 0, 0.30, 0.55),
        rect(0.395, 0.395, 0.29, 0.27),
        rect(0, 0.565, 0.38, 0.435),
        rect(0.395, 0.68, 0.29, 0.32),
        rect(0.70, 0.565, 0.30, 0.435),
      ];
    },
  },
  {
    id: 'single-spotlight',
    name: 'Single Spotlight',
    build(aspect) {
      const stripY = aspect === 'tall' ? 0.82 : 0.79;
      const stripH = 1 - stripY - 0.015;
      return [
        rect(0, 0, 1, 1),
        rect(0.015, stripY, 0.31, stripH),
        rect(0.345, stripY, 0.31, stripH),
        rect(0.675, stripY, 0.31, stripH),
      ];
    },
  },
  {
    id: 'split-duo',
    name: 'Split Duo',
    build(aspect) {
      const topH = aspect === 'tall' ? 0.68 : 0.72;
      const y = topH + 0.015;
      const h = 1 - y;
      return [
        quad(0, 0, 0.58, 0, 0.42, topH, 0, topH),
        quad(0.58, 0, 1, 0, 1, topH, 0.42, topH),
        rect(0, y, 0.32, h),
        rect(0.34, y, 0.32, h),
        rect(0.68, y, 0.32, h),
      ];
    },
  },
  {
    id: 'cover-story',
    name: 'Cover Story',
    build(aspect) {
      const topH = aspect === 'tall' ? 0.42 : 0.46;
      const midY = topH + 0.015;
      const midH = aspect === 'tall' ? 0.3 : 0.3;
      const botY = midY + midH + 0.015;
      return [
        rect(0, 0, 1, topH),
        rect(0, midY, 0.32, midH),
        rect(0.34, midY, 0.32, midH),
        rect(0.68, midY, 0.32, midH),
        rect(0, botY, 0.49, 1 - botY),
        rect(0.51, botY, 0.49, 1 - botY),
      ];
    },
  },
  {
    id: 'filmstrip',
    name: 'Filmstrip',
    build(aspect) {
      const topH = aspect === 'tall' ? 0.52 : 0.58;
      const y = topH + 0.015;
      const panels = [rect(0, 0, 1, topH)];
      for (let i = 0; i < 4; i++) {
        panels.push(rect(i * 0.2525, y, 0.235, 1 - y));
      }
      return panels;
    },
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

// Bounding box of a panel in unit space (polygons use their point bounds).
export function panelBox(panel) {
  if (!panel.poly) return { x: panel.x, y: panel.y, w: panel.w, h: panel.h };
  const xs = panel.poly.map((p) => p[0]);
  const ys = panel.poly.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
