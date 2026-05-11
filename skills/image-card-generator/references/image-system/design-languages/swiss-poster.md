---
id: swiss-poster
type: design-language
status: stable
best_for: [bold_thesis, simple_comparison, graphic_hook]
visual_traits: [geometric_fields, scale_contrast, restrained_palette]
compatible_layouts: [full-bleed-poster, split-field, big-number, flow-diagram]
avoid_layouts: [artifact-board]
text_strategy: very_short_text
failure_signatures:
  - flat generic template
  - too many shapes
  - typography errors
---

# Swiss Poster

## Use When

Use for bold theses, simple comparisons, model/version hooks, and cards that need graphic confidence.

## Visual DNA

Geometric fields, strong alignment, scale contrast, restrained palette, simple shapes with intent.

## Must Use

- Strong scale contrast.
- Clear alignment logic.
- One or two dominant color fields.

## Must Not Use

- Generic centered poster template.
- Many decorative shapes.
- Dense text or tiny labels.

## Prompt Skeleton

"Create a finished Swiss-inspired information poster with very large short text, a clear metric or contrast label, geometric fields, strong scale contrast, disciplined alignment, restrained color, and one clear graphic anchor. Avoid generic centered templates and decorative clutter."

## Layout Pairings

Best with `full-bleed-poster`, `split-field`, `big-number`, and `flow-diagram`.

## Text Strategy

Very short, very large text. Use a bold title or metric plus one contrast label. Typography must be inspected closely.

## QA Checks

- Graphic hierarchy is immediate.
- Alignment feels intentional.
- Required text is short, large, accurate, and not distorted.

## Repair Prompts

- "Reduce shapes to two dominant fields and one anchor."
- "Move away from centered template composition with an asymmetric scale contrast."
- "Render only the exact short title '<TITLE>' in large clean type."
