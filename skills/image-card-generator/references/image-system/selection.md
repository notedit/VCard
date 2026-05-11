# Image System Selection

Use this before writing prompts. Read the indexes first, then open only the selected layout and design-language spec files. Select for information clarity first and visual character second.

## Selection Flow

1. Decide information routing:
   - `concise information card`: preferred for `image-card-generator`.
   - `headline + 1-4 facts`: allowed, but mark text QA risk.
   - `visual-only`: use only when the user explicitly asks for poster variants.
   - `exact logo/UI/brand detail`: require supplied assets.
2. Read `layouts/_index.md`.
3. Choose 2-3 candidate layouts based on information role, ratio, and text capacity.
4. Select one layout per card. A set can reuse a layout, but avoid repeating the same composition card after card.
5. Open the selected layout spec.
6. Use the layout's `compatible_languages` to choose a design language.
7. Read `design-languages/_index.md`, then open only the selected design-language spec.
8. Fill the outline fields from `schema.md`.
9. Write prompts using the selected layout prompt blocks plus the design-language prompt skeleton.

## Set-Level Rules

- A 1-3 card set should use at least 2 image layouts unless the user asked for variants.
- A 4-7 card set should use at least 3 image layouts.
- Use one primary design language across the set for continuity; use a second language only as a card-level modifier.
- The first card should prioritize a clear hook and readable title; the visual anchor supports the hook.
- Every card should carry useful concrete information unless the user explicitly asked for visual-only variants.
- A normal image card should include a title plus 1-4 key facts, labels, numbers, or steps.

## Compatibility Policy

Compatibility is bidirectional:

- Layout specs list `compatible_languages` and `avoid_languages`.
- Design-language specs list `compatible_layouts` and `avoid_layouts`.
- If either side says avoid, do not pair them unless the user explicitly asks and the risk is recorded.
- If a pair is not listed, treat it as experimental and record the compatibility reason in `outline.md`.

## QA Routing

After generation, QA against both selected specs:

- layout contract: information hierarchy, composition, visual anchor support, text capacity, safe margins.
- design language: material, palette, lighting, mood, forbidden tropes.
- shared taste baseline: no generic AI traces, fake data, unwanted marks, or overloaded text.
