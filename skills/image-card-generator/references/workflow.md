# Workflow

This workflow creates information-first GPT-image-led social card sets. GPT Image 2 produces the final card PNGs directly. Text and information hierarchy are primary; design is secondary.

Use the image-system registry as the composition contract:

- `references/image-system/schema.md`
- `references/image-system/selection.md`
- `references/image-system/layouts/_index.md`
- `references/image-system/design-languages/_index.md`

Open only the selected layout and design-language spec files after choosing from the indexes.

## File Layout

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

Use a 2-4 word kebab-case slug. Before overwriting any user-editable file, back it up as `<name>-backup-YYYYMMDD-HHMMSS.<ext>`.

## Step 0: Ask User Questions

Ask for missing generation parameters once near the start, before concept planning. Skip only when the user clearly asks to proceed directly.

Extract known values first:

- content/topic.
- ratio.
- card count.
- platform/audience.
- visual style.
- output folder.
- quality.
- constraints such as "visual-only variant", "poster variants only", "must use supplied reference image", or "exact dense text required".

Ask at most 5 concise questions in this priority order:

1. ratio.
2. count.
3. visual style.
4. platform/audience.
5. output/constraints.

Useful defaults:

- Ratio: `4:5` for mobile feed, `1:1` for square social sharing, `9:16` for stories/covers.
- Count: auto, `3` compact narrative, `5` explainer, `7` fuller carousel.
- Quality: `low` for tests and fast iteration; `medium` or `high` for final assets.

## Step 1: Analyze

Write `analysis.md` with:

- source summary and language.
- target platform and audience.
- content type: recommendation, explainer, checklist, tutorial, comparison, warning, personal story, cover/poster.
- hook strength and revised cover hook.
- save value, share trigger, and swipe motivation.
- recommended ratio, count, strategy, visual style, quality, and image model path.
- visual opportunity map: object, scene, metaphor, diagram, product, person, artifact, large number, texture.
- information role and required text per card.
- text risk: concise baked-in text, dense exact text, numeric fidelity, or language fidelity.
- candidate image layouts and design languages from the registry.
- user-provided title for the cover.
- one generated cover guiding sentence that is concise, insightful, non-hype, and designed to make the reader continue.

## Cover Requirements

Card 1 is always the cover unless the user explicitly asks for standalone poster variants.

The cover must:

- attract the reader to continue to the remaining cards.
- be short, forceful, and insight-driven.
- avoid exaggeration, slogans, hype, or clickbait.
- feel premium, restrained, and visually impactful.
- have a clear opening-card feeling.
- avoid word pileup.

The cover may contain only:

- the user-provided title.
- one automatically generated guiding sentence.

The title must be the largest visual focus. The guiding sentence should create curiosity for the next cards without summarizing everything.

## Step 2: Select Layouts And Design Languages

Read:

- `references/image-system/schema.md`
- `references/image-system/selection.md`
- `references/image-system/layouts/_index.md`
- `references/image-system/design-languages/_index.md`

Then:

1. Decide information routing:
   - `concise information card`: preferred for `image-card-generator`.
   - `headline + 1-4 facts`: allowed, but mark text QA risk.
   - `visual-only`: use only when explicitly requested.
   - `exact logo/UI/brand detail`: require supplied assets.
2. Choose 2-3 candidate layouts based on information role and text capacity first, visual style second.
3. Select one layout per card.
4. Open the selected layout specs only.
5. Choose one primary design language for the set and optional card-level modifier.
6. Open the selected design-language specs only.
7. Record compatibility reasons. If either selected spec says to avoid the pairing, choose another pair unless the user explicitly requested the risk.

Set rules:

- Card 1 uses the cover requirements above before any layout/design-language preference.
- 1-3 card sets should use at least 2 image layouts unless the user asked for variants.
- 4-7 card sets should use at least 3 image layouts.
- Use one primary design language across the set for continuity.
- Every card needs a concrete information role, required text, visual anchor, and primary failure risk.

## Step 3: Confirm

Default behavior is confirm before generation. Skip only when the current request clearly asks to proceed directly.

Present three strategy choices when the direction is open:

- `story-driven`: hook, pain, discovery, mechanism, takeaway.
- `information-dense`: claim, context, mechanism, proof, checklist, closer.
- `comparison/proof`: hook, metric/contrast, evidence, implication, takeaway.

The confirmed plan should include one row per card:

| Card | Role | Core Message | Required Text | Image Layout | Design Language | Visual Anchor | Density | Risk |
|------|------|--------------|---------------|--------------|-----------------|---------------|---------|------|

## Step 4: Outline

Write `outline.md` before generating. Each card entry includes:

```markdown
## Card 1 of 5

**Role**: Cover
**Filename**: assets/01-cover-topic.png
**Prompt File**: prompts/01-cover-topic.md
**Ratio/Size**: 4:5 / 1280x1600
**Core Message**: ...
**Information Role**: hook / context / comparison / benchmark / mechanism / proof / checklist / pricing / takeaway
**Cover Rule**: for card 1 only, title is largest; only user title + one generated guiding sentence; no extra text
**Required Text**:
- Title:
- Guiding sentence or key facts:
**Image Layout**: ...
**Design Language**: ...
**Compatibility Reason**: ...
**Visual Anchor**: ...
**Composition Contract**: ...
**Text Plan**:
- Exact text to render
**Text Risk**: concise baked-in text / numeric fidelity / Chinese fidelity / dense exact text risk
**Reference Strategy**: none / style-continuity / direct reference / mask edit
**Swipe Hook**: ...
**Primary Failure Risk**: ...
**Repair Strategy**: ...
```

## Step 5: Prompt Files

Write every prompt file before invoking the image backend. The prompt file is the source of truth for regeneration.

Recommended prompt sections:

- Brief: one sentence describing the exact final card image.
- Required Text: exact title and key facts to render; this comes before visual description.
- Information Hierarchy: what must be largest, second largest, and supporting.
- Image Layout: selected layout id and the relevant composition contract.
- Design Language: selected design-language id and the relevant visual DNA.
- Composition: crop, camera angle, focal object, layer depth, mobile-safe margins.
- Text Placement: where title and key facts sit, with safe margins.
- Style: image treatment, material, texture, palette, lighting.
- Platform fit: mobile-first, high readability after crop, no tiny details.
- Exclusions: no unwanted text, logos, watermark, UI, captions, page number, external brand marks.
- Reference use: direct/style/palette and file path, if any.

Build prompts from:

- selected layout `Prompt Blocks`.
- selected design-language `Prompt Skeleton`.
- user content and card-specific message.

For card 1 prompt files:

- Required Text must include only the user-provided title and one generated guiding sentence.
- Information Hierarchy must say: title is the largest visual focus; guiding sentence is secondary.
- Exclusions must prohibit all extra words, badges, labels, captions, subtitles, page numbers, and pseudo text.
- Copy must be concise, insightful, restrained, and non-hype.

## Step 6: Generate

Use the local script unless the project has an equivalent:

```bash
node skills/image-card-generator/scripts/generate-aiberm-image.mjs \
  --prompt-file image-cards/my-set/prompts/01-cover.md \
  --output image-cards/my-set/assets/01-cover.png \
  --model gpt-image-2 \
  --size 1280x1600 \
  --quality low
```

Image continuity:

- Generate card 1 first without a reference unless the user supplied one.
- For cards 2+, use card 1 as `--ref` only when style continuity matters and the next card has a compatible composition.
- Do not stack many references unless the user explicitly wants a collage/fusion style.

## Step 7: QA

Score before final delivery:

- Boundary: no important elements clipped and no critical text near unsafe edges.
- Information: the intended claim is understandable without external explanation.
- Required text: title/key facts are present, accurate, and readable.
- Cover: for card 1, only the title and guiding sentence are present; title is the largest focus; copy is not exaggerated or slogan-like.
- Layout contract: selected layout's composition contract is visible.
- Design language: selected language's visual DNA is recognizable.
- Text: exact requested text is readable and has no unwanted extra words, pseudo-letters, or logo-like marks.
- Image: sharp enough, no mushy details, no strange anatomy/objects, no unwanted watermark.
- Layout: information hierarchy is dominant; the visual anchor supports the message instead of competing with it.
- Information: the set includes useful detail, not only vibes.
- Consistency: images feel like one set without becoming copies.
- Platform: ratio and safe zones fit the target feed/story context.
- Taste: `references/taste.md` passes.

Repair weak cards by changing the prompt, regenerating the image, or editing with a reference/mask when appropriate. Prefer the selected specs' `Repair Prompts`. Keep repair rounds to 3 per card.
