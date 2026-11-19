# Sunset State Cover Studio

A GTA-style cover-art maker for the make.fun competition
[gta6-cover-art-01](https://make.fun/c/gta6-cover-art-01): turn your
photos into multi-panel, sunset-graded poster covers and export them as
PNGs in the three post sizes — 1920×1080, 1080×1350 and 1080×1080.

![Competition](https://make.fun/badge/gta6-cover-art-01.svg)
![Rank](https://make.fun/badge/gta6-cover-art-01/Goatleaf12/makefun-gta6-cover-art-02/rank.svg)
![Reward](https://make.fun/badge/gta6-cover-art-01/Goatleaf12/makefun-gta6-cover-art-02/reward.svg)

## What it does

- **Nine panel layouts** (Hero Classic, Hero Right, Comic Slant,
  Grid 3×3, Mosaic, Single Spotlight, Split Duo, Cover Story,
  Filmstrip), each defined for all three aspect ratios, plus a mini-map
  layout picker.
- **Nine colour grades** — Vice Sunset, Neon Night, Golden Hour,
  Duotone Pink/Teal, Comic Ink, Natural, Noir Mono, Chrome Dusk and
  Painterly Wash — with strength / contrast / saturation / grain /
  vignette sliders, halftone dots and a paper-texture print finish.
- **Five one-click cover recipes** that set layout, grade, size and a
  full caption set in the style of classic poster covers.
- **Per-panel photo editing**: click to select, drag to pan, scroll to
  zoom, double-click to re-centre, drag a photo onto a panel to replace
  it, fill every panel from one photo, or spread photos across panels.
- **Full canvas lettering**: gradient display title with outline and
  hard shadow, neon script subtitle, star row and review quote,
  starburst seal, volume tag, wanted pill, corner ribbon, a
  palm-silhouette tagline band, catalog microtext and a drawn barcode,
  plus an editable location tag on every panel.
- **One render routine** draws the live preview and every export, so
  the PNG you save is pixel-for-pixel the cover you composed.
- Opens with ten AI-generated sample photos loaded and a finished cover
  already composed. Everything runs offline; your photos never leave
  your machine.

## Run it

```sh
node serve.ts
```

then open http://localhost:8080 in a desktop browser. The app is plain
static files under `app/` — no build step, no network requests.

Fonts (Anton, Oswald, Pacifico) are self-hosted under `app/fonts/` and
licensed under the SIL Open Font License 1.1 (see `app/fonts/OFL.txt`).
All artwork, lettering and sample photos are original to this entry.
