---
id: product-specimen
type: layout
status: stable
best_for: [product_note, model_update, feature_launch, tool_card]
text_capacity: low-medium
information_roles: [feature, capability, product_note, model_update]
ratios: [4:5, 1:1]
visual_anchors: [specimen_object, product_slab, model_card, cutaway_object]
compatible_languages: [product-catalog, editorial-artifact, image-led-magazine, swiss-poster]
avoid_languages: [field-notes]
reference_friendly: true
failure_signatures:
  - looks like a real product photo without disclosure
  - generic floating chip or robot imagery
  - fake logo or brand mark
---

# Product Specimen

## Use When

Use when a model, API, tool, feature, or product needs to be treated as an object of inspection.

## Information Contract

Must include a title and 2-3 feature/capability tags. The specimen object supports the feature message.

## Composition Contract

Show one synthetic specimen object, package, slab, device, model card, or cutaway. Use clean studio control and physical detail. Avoid implying it is a real product photo unless the source asset is real and supplied.

## Prompt Blocks

- "Create a finished social card showing a synthetic product specimen as a physical object under studio light."
- "Use a cropped package, model slab, cutaway, or inspection tag as the dominant anchor."
- "Avoid logos, brand marks, and generic AI chip imagery."

## Text Rules

Low-medium capacity. Use a short title and 2-3 feature tags. Do not ask for exact UI mockups.

## QA Checks

- The specimen is clearly synthetic/editorial.
- No fake logos or brand marks.
- The object is specific to the topic, not generic AI hardware.

## Repair Prompts

- "Remove fake logo marks and replace them with blank inspection tags."
- "Make the specimen more topic-specific using <TOPIC_OBJECT> details."
- "Avoid generic AI chips and robotic elements; use a tactile product slab instead."
