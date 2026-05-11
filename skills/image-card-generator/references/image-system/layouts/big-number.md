---
id: big-number
type: layout
status: stable
best_for: [metric, benchmark, price, milestone, ranking]
text_capacity: low-medium
information_roles: [metric, benchmark, price, milestone]
ratios: [4:5, 1:1, 9:16]
visual_anchors: [large_number, scale_marker, gauge, numeric_slab]
compatible_languages: [data-poster, swiss-poster, newsroom-poster, editorial-artifact]
avoid_languages: [cinematic-still]
reference_friendly: partial
failure_signatures:
  - wrong or distorted number
  - too many competing metrics
  - number lacks context or physical presence
---

# Big Number

## Use When

Use when one number is the point: price, benchmark, ratio, date, version, model ID, or score.

## Information Contract

Must render the primary number accurately, plus a short label explaining what the number means. Optional: one short context note.

## Composition Contract

One primary number dominates the image. Supporting objects explain context. The number should feel intentional as a poster element, gauge, tag, or slab, not a random overlay.

## Prompt Blocks

- "Create a finished social card dominated by one large clean number as the visual anchor."
- "Use a physical numeric slab, gauge, poster numeral, or stamped metric plate."
- "Keep only two or three supporting marks around the number."

## Text Rules

Low-medium capacity. Exact numbers must be few, large, and checked carefully: one main number, one label, optional context. Avoid many small digits.

## QA Checks

- The main number is correct and readable.
- No extra hallucinated numbers compete.
- Supporting context does not overload the poster.

## Repair Prompts

- "Correct the numeric anchor: render only the number '<NUMBER>' in large clean typography."
- "Remove secondary numbers and keep two abstract support marks."
- "Make the number occupy half the card and reduce surrounding clutter."
