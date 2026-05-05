---
name: card-generator
description: Generate polished, consistent shareable card image sets from user-provided content. Use when Codex needs to plan, design, code, render, audit, and export social cards/poster cards in ratios such as 1:1, 3:4, 9:16, or custom aspect ratios, with optional card count, style direction, per-card HTML pages, Playwright screenshots, visual QA scoring, and iterative regeneration.
---

# Card Generator

## Overview

Create a set of shareable visual cards from source content. Treat each card as its own webpage, keep all cards the same size and style system, render them with Playwright, export images, and iterate on weak cards.

## Inputs

Collect or infer:

- `content`: source text, outline, notes, URL, topic, or brief.
- `ratio`: default to `1:1` unless the user requests `3:4`, `9:16`, or another ratio.
- `count`: default to an automatic count based on content density; accept explicit quantities.
- `style`: accept explicit style directions, brand constraints, audience, mood, language, and platform.
- `output`: choose a clear local folder such as `cards/<slug>/` unless the user specifies one.

If important facts may be current or disputed, search or verify before planning. Keep source attribution available for the user when research affects the content.

## Design Context

Prefer existing design context over inventing a new visual system.

- Before planning the cards, look for any user-provided or local brand assets, previous card sets, screenshots, Figma/UI kit references, project design systems, existing webpages, or code styles that should influence the result.
- Extract a compact visual DNA summary: palette, typography feel, information density, border radius, shadow/depth, image or illustration treatment, layout rhythm, and copy tone.
- If no reliable design context is available, derive the visual direction from the content, audience, platform, and requested mood, and state that assumption in the plan.

## Theme Presets

Use theme presets as starting points, not as copied CSS. Define a fresh token block for each card set and adapt the palette to the content.

- Load `references/themes/presets.md` when the user asks for style options, when the style is ambiguous, or when the card set needs a clear visual direction.
- Use 2-3 presets from the catalog as concept directions before coding when appropriate.
- Do not copy external theme CSS wholesale. Recreate the needed palette and behavior in the local card style.

## Workflow

1. Expand and structure the content.
   - Extract the core message, audience, emotional hook, claims, and supporting points.
   - If `count` is missing, choose the smallest number of cards that covers the idea without crowding; prefer 3-7 cards for explainers and 1-3 cards for announcements.
   - Decide a title, subtitle, and key visual idea for every card.

2. Plan concepts and request confirmation.
   - Present the ratio, card count, style direction, content outline, and first-card concept.
   - Make card 1 a precise high-impact cover: it must communicate the topic instantly, create curiosity, and feel worth opening and sharing.
   - When the task is high-impact or the style is ambiguous, offer 2-3 visual directions before coding. Cover distinct options such as brand-aligned/conservative, structured/information-graphic, and bolder/shareable.
   - For each direction, describe the cover concept, overall visual language, and the situation where it works best.
   - Skip concept variations when the user already specified the visual style, explicitly asked to proceed without confirmation, or needs a fast direct export.
   - Ask the user to confirm before coding unless they explicitly asked to proceed without confirmation.

3. Build the card webpages.
   - Create one HTML page per card, named predictably such as `card-01.html`, `card-02.html`.
   - Use one shared CSS file or shared design tokens so size, typography, spacing, palette, border radius, and component styling stay consistent.
   - Set an explicit fixed canvas size derived from the ratio. Recommended bases:
     - `1:1`: `1080x1080`
     - `3:4`: `1080x1440`
     - `9:16`: `1080x1920`
     - Custom `a:b`: use width `1080` and height `round(1080*b/a)` unless the user requests exact pixels.
   - Keep every card inside a single fixed-size `.card` root. Do not allow body scrolling.
   - Use real HTML/CSS text instead of baking text into images.
   - Use the same style language across cards; vary composition only enough to fit content.

4. Score and regenerate each card.
   - Render and screenshot every card before judging it.
   - Score each card on:
     - Boundary: no obvious clipping, unintended scrollbars, text outside the canvas, or important elements touching edges.
     - Color: palette is legible, attractive, intentional, and consistent with the requested style.
     - Layout: hierarchy is clear, whitespace is balanced, and content density fits the ratio.
   - If any category fails, revise that card and rerender. Limit each card to 3 repair rounds.
   - If a card still fails after 3 rounds, report the remaining risk and keep the best version.

5. Export final images.
   - Use Playwright screenshots, not browser manual screenshots.
   - Export one PNG per card with stable names such as `card-01.png`.
   - Provide the user with the output paths and a concise summary of the final ratio, count, and style.

## Asset and Source Discipline

- Keep generated files contained in the requested output folder.
- Place any local images, logos, screenshots, textures, icons, or other assets used by the cards in `cards/<slug>/assets/` unless the user specifies another output path.
- Record research sources, external asset sources, and important factual references in `sources.md` or `credits.md` inside the output folder.
- Do not rely on external hotlinked assets for final exports. External URLs may be used during research or temporary preview only.
- Copy only the minimum assets actually used by the card set; do not bulk-copy unrelated asset folders.

## Rendering Helper

Use `scripts/render-cards.mjs` when a project does not already have an equivalent Playwright export script.

```bash
node /path/to/card-generator/scripts/render-cards.mjs \
  --input ./cards/my-set \
  --output ./cards/my-set/exports \
  --ratio 9:16
```

The script:

- Scans the input folder for `.html` files.
- Sets the viewport from `--ratio` or `--size`.
- Screenshots `.card` when present, otherwise the viewport.
- Writes PNG files to the output folder.
- Writes `audit.json` with DOM overflow and out-of-bounds signals.

If Playwright is missing in the target project, install or use it with the local package manager, then install Chromium as needed:

```bash
npm install -D playwright
npx playwright install chromium
```

## Implementation Rules

- Keep all cards visually siblings: shared tokens, shared base layout, shared type scale, shared image treatment.
- Prefer existing design context over inventing a new visual system.
- Use concept variations before coding when style is ambiguous or the card set is high-impact.
- Define theme tokens first: background, surface levels, border levels, text levels, accent trio, semantic colors, gradients, radius, shadow, and fonts.
- Use tokens in component CSS. Avoid scattering literal colors outside the token block unless a one-off asset or data visualization genuinely requires it.
- Do not copy external theme CSS wholesale. Recreate the needed palette and behavior in the local card style, and keep source inspiration in `sources.md` or `credits.md` when relevant.
- Avoid one-note palettes unless the user explicitly asks for a monochrome look.
- Fit text by editing, grouping, or changing layout before shrinking everything.
- Use responsive CSS only for development preview; the export canvas must remain fixed.
- Prefer semantic HTML and CSS over canvas for card content unless the visual requires custom drawing.
- Keep assets and source attribution inside the output folder.
- Keep letter spacing at `0` unless the file's existing design system clearly requires uppercase tracking; do not use negative letter spacing.
- Do not skip visual verification. The final answer must state whether rendering and export succeeded.
