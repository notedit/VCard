---
name: image-card-generator
description: Generate GPT-image-2-led social image card sets from a brief, article, notes, URL, or topic. Use when Codex needs information-first mobile feed image cards, explainers, visual notes, cover cards, or shareable image-card series with saved prompts, direct GPT Image 2 PNG outputs, and visual QA.
---

# Image Card Generator

## Overview

Create information-first image card sets where GPT Image 2 produces the final visual cards through the project's Aiberm OpenAI-compatible Image API. Text and information hierarchy are the primary deliverable; design is secondary and must serve comprehension.

## Priority

1. Information: the card must communicate the intended claim, number, comparison, step, or takeaway.
2. Readability: title, key labels, and core data must be large enough for mobile feed viewing.
3. Design: composition, material, color, and visual language should make the information easier to scan and remember.

Do not make no-text mood images unless the user explicitly asks for visual-only poster variants.

## Cover Requirements

Card 1 is always the cover unless the user explicitly asks for standalone poster variants.

The cover must:

- make the reader want to continue to the remaining cards.
- be short, forceful, and insight-driven.
- avoid exaggeration, slogans, hype, or clickbait.
- feel premium, restrained, and visually impactful.
- have a clear opening-card feeling.
- keep information simple and avoid word pileup.

The cover may contain only:

- the user-provided title.
- one automatically generated guiding sentence.

The title must be the largest visual focus. The guiding sentence should create curiosity for the next cards without summarizing everything.

## Required References

Load these before generating:

- `references/taste.md`: global visual quality floor.
- `references/workflow.md`: questions, analysis, confirmation, file layout, card planning, and QA.
- `references/gpt-image-2.md`: prompt and Aiberm access discipline for GPT Image 2.
- `references/image-system/schema.md`: registry contract and required outline fields.
- `references/image-system/selection.md`: layout/design-language selection rules.
- `references/image-system/layouts/_index.md`: image layout registry.
- `references/image-system/design-languages/_index.md`: image design-language registry.

Load `references/social-feed-patterns.md` when the target platform is a mobile carousel feed or Chinese social image post.

## Inputs

Collect or infer:

- `content`: source text, notes, URL, topic, or brief.
- `platform`: infer from context; use mobile feed assumptions when the user asks for image carousels, social feed cards, Chinese feed posts, or 微信贴图.
- `ratio`: support only `1:1`, `4:5`, and `9:16` for now. Default to `4:5` for feed-style cards, `1:1` for square social sharing, and `9:16` for story covers. Accept full-width colon input such as `1：1`, `4：5`, and `9：16`.
- `count`: default auto; prefer 3-7 cards for explainers, 1-3 for covers/poster variants.
- `style`: audience, mood, reference images, brand constraints, and any forbidden styles.
- `output`: default `image-cards/<slug>/` unless the user specifies a folder.
- `quality`: default `low` for tests and fast iteration; use `medium` or `high` for final assets when requested or clearly needed.

If facts may be current, disputed, legal, financial, medical, or product-specific, verify before writing card copy. Do not invent numbers, quotes, rankings, or product claims.

## Ask User Questions

Ask for missing generation parameters once near the start, before concept planning. Do not ask again for parameters already explicit in the user's original request.

- First extract known values for `content`, `ratio`, `count`, `style`, `platform/audience`, `output`, `quality`, and constraints.
- Ask at most 5 concise, high-impact questions, in this priority order: `ratio`, `count`, `style`, `platform/audience`, `output/constraints`.
- Skip the question step when the user says `--yes`, `直接生成`, `不用确认`, `跳过确认`, `快速生成`, or otherwise clearly prioritizes speed. In that case, state assumptions briefly and proceed.

Default choices:

- Ratio: `4:5` mobile feed card, `1:1` square social share, `9:16` story/cover.
- Count: auto-recommend, `3` compact narrative, `5` standard explainer, `7` fuller carousel.
- Style: recommend 2-3 scenario-based information treatments when open, such as benchmark card, cost comparison, mechanism diagram, launch update, field-note checklist, or product/specimen note. Do not expose a long preset catalog.

## Confirmation

Ask once before generation unless the user explicitly asked to proceed directly.

For confirmation, present:

- topic, target platform, ratio, count, quality, and output folder.
- recommended story strategy: `story-driven`, `information-dense`, or `comparison/proof`.
- information direction: headline structure, key facts per card, required text, layout mix, primary design language, and text QA risk.
- one row per card: role, core message, required text, image layout, design language, visual anchor, text density, generated image size, and risk.

If confirmation is skipped, state the assumptions in a short progress update and proceed.

## Workflow

1. Analyze content.
   - Save the source in the output folder when it came from a file, URL, or long pasted text.
   - Use `references/workflow.md` and `references/social-feed-patterns.md` when relevant.
   - Identify hook, audience, save value, share trigger, swipe arc, and visual opportunities.
   - Choose the smallest useful card count. Do not make every card low-density unless the user asked for poster variants only.

2. Plan the set.
   - Write `analysis.md` and `outline.md` before generating images.
   - Card 1 must be a cover following Cover Requirements: only user title plus one generated guiding sentence; title is the largest visual focus.
   - Every card needs an information role: hook, context, comparison, benchmark, mechanism, proof, checklist, pricing, or takeaway.
   - Every card needs required text: at minimum a headline or one dominant information unit, unless the user requested visual-only variants.
   - Every card still needs a visual anchor, but it must support the information role rather than replace it.
   - Because the final output is a generated image, keep text concise and treat text legibility as a QA risk, especially for Chinese.
   - Prefer concise information-led cards with 1 headline plus 1-4 supporting facts.
   - Use the image-system registry as a composition contract:
     - read layout and design-language indexes.
     - open only the selected layout and design-language specs.
     - fill `Information Role`, `Required Text`, `Image Layout`, `Design Language`, `Compatibility Reason`, `Visual Anchor`, `Composition Contract`, `Text Plan / Text Risk`, `Reference Strategy`, `Primary Failure Risk`, and `Repair Strategy` for every card in `outline.md`.
   - A 1-3 card set should use at least 2 image layouts unless the user asked for variants. A 4-7 card set should use at least 3 image layouts.

3. Write prompts first.
   - Create `prompts/NN-{type}-{slug}.md` for every image before invoking any image tool or script.
   - Prompts must specify exact required text first, then subject, composition, material/rendering, palette, lighting, safe text placement, and exclusions.
   - Compose prompts from the selected layout's `Prompt Blocks` plus the selected design-language `Prompt Skeleton`.
   - Include "render only the specified text; no extra words, letters, logos, captions, watermarks, UI, or pseudo text".
   - Specify exact short text and explicitly ask for clean, large, mobile-readable typography. Keep a note in `outline.md` that text fidelity must be inspected.
   - For card 1, include only the user title and one guiding sentence. Explicitly prohibit extra text, subtitles, labels, captions, badges, and page numbers.

4. Generate with GPT Image 2.
   - Use `gpt-image-2` through Aiberm: `AIBERM_API_KEY`, `AIBEAM_API_KEY`, or `API_KEY` with base URL `https://aiberm.com/v1`.
   - Use the Image API endpoints: `POST /images/generations` for new images and `POST /images/edits` for reference-image or mask edits.
   - Do not silently fall back to another model, relay, Responses API, or direct OpenAI. If Aiberm rejects the request, stop and report the model, size, quality, and endpoint.
   - Prefer `scripts/generate-aiberm-image.mjs` when no project-specific image script exists.
   - Default to `--quality low` for tests and fast iteration. Use `medium` or `high` only for final assets or when the user asks for higher quality.
   - Image 1 is generated without a reference image. Images 2+ may use image 1 as `--ref` when style continuity matters and the endpoint supports edits.
   - Save final card PNGs as `assets/NN-{type}-{slug}.png`.

5. QA and repair.
   - QA the generated PNGs directly.
   - Score information first: exact text, claim clarity, key data readability, then selected layout spec, selected design-language spec, boundary, unwanted text artifacts, image quality, visual anchor support, set consistency, platform fit, and taste baseline.
   - For card 1, reject the image if the title is not the largest visual focus, if it contains any text beyond title plus guiding sentence, or if the copy feels exaggerated/slogan-like.
   - Use the selected specs' `Repair Prompts` for regeneration or edits. Limit to 3 repair rounds per card, then report remaining risk.

6. Complete.
   - Provide output paths, ratio, count, model, quality, and any source/credit notes.
   - Keep `source.md`, `analysis.md`, `outline.md`, `prompts/`, generated card PNGs in `assets/`, and `credits.md` together in the output folder.

## Recommended Files

```
image-cards/<topic-slug>/
├── source.md
├── analysis.md
├── outline.md
├── credits.md
├── prompts/
│   ├── 01-cover-<slug>.md
│   └── 02-content-<slug>.md
└── assets/
    ├── 01-cover-<slug>.png
    └── 02-content-<slug>.png
```

## Image System Registry

The image system is extensible by adding files:

- layouts live in `references/image-system/layouts/<id>.md`.
- design languages live in `references/image-system/design-languages/<id>.md`.
- update only the relevant `_index.md` when adding a new spec.
- do not change the core workflow for ordinary additions.

Current layouts:

- `full-bleed-poster`
- `split-field`
- `artifact-board`
- `big-number`
- `contact-sheet`
- `product-specimen`
- `flow-diagram`
- `receipt-comparison`

Current design languages:

- `editorial-artifact`
- `data-poster`
- `field-notes`
- `image-led-magazine`
- `newsroom-poster`
- `product-catalog`
- `cinematic-still`
- `swiss-poster`

## Scripts

Generate one image:

```bash
node skills/image-card-generator/scripts/generate-aiberm-image.mjs \
  --prompt-file image-cards/my-set/prompts/01-cover.md \
  --output image-cards/my-set/assets/01-cover.png \
  --model gpt-image-2 \
  --size 1280x1600 \
  --quality low
```

Generate a follow-up image with the cover as reference:

```bash
node skills/image-card-generator/scripts/generate-aiberm-image.mjs \
  --prompt-file image-cards/my-set/prompts/02-content.md \
  --output image-cards/my-set/assets/02-content.png \
  --model gpt-image-2 \
  --size 1280x1600 \
  --quality low \
  --ref image-cards/my-set/assets/01-cover.png
```

## Guardrails

- Always include concise text and information as the primary content of each card.
- Do not bypass the project default Aiberm endpoint unless the user explicitly asks for another provider and provides credentials.
- Do not use pure black, default centered hero compositions, fake data, generic AI copy, AI purple-blue gradients, or meaningless decorative grids as the main style.
- Do not hotlink external assets.
- Do not overwrite user-edited source, outline, prompt, or image files without backing them up first.
- Do not present a generated image as a real product photo, real event photo, or factual evidence unless it is clearly labeled synthetic.
