---
id: product-catalog
type: design-language
status: stable
best_for: [product, tool, model_specimen, feature_sheet]
visual_traits: [studio_object, catalog_crop, controlled_surface]
compatible_layouts: [product-specimen, split-field, contact-sheet]
avoid_layouts: [receipt-comparison, field-notes]
text_strategy: short_feature_labels
failure_signatures:
  - fake real product claim
  - logo hallucination
  - generic gadget render
---

# Product Catalog

## Use When

Use for tools, model releases, feature cards, product-like capabilities, and controlled specimen visuals.

## Visual DNA

Studio-lit object, catalog crop, measured surface, controlled shadows, product detail without fake branding.

## Must Use

- A single specimen or product-like object.
- Clean controlled composition.
- Specific material detail tied to the topic.

## Must Not Use

- Fake logos.
- Generic gadget renders.
- Real product photo implication unless supplied.

## Prompt Skeleton

"Create a finished product-catalog style information card with a clear title, 2-3 feature tags, and a synthetic topic-specific specimen under controlled studio light, with precise material detail, catalog crop, and no logos or fake brand marks."

## Layout Pairings

Best with `product-specimen`, `split-field`, and `contact-sheet`.

## Text Strategy

Title plus short feature labels. Use 2-3 tags that explain the specimen. Avoid UI mocks and dense feature tables.

## QA Checks

- Object is specific to the topic and feature labels are readable.
- No fake logo or real-product implication.
- Catalog polish does not become sterile.

## Repair Prompts

- "Remove all logos and replace them with blank inspection details."
- "Make the object less generic by adding <TOPIC_DETAIL>."
- "Use warmer material and stronger crop to avoid sterile render."
