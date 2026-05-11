---
id: editorial-artifact
type: design-language
status: stable
best_for: [technical_explainer, product_note, model_update]
visual_traits: [tactile_artifacts, asymmetric_space, editorial_crop]
compatible_layouts: [artifact-board, product-specimen, receipt-comparison, flow-diagram]
avoid_layouts: [cinematic-still]
text_strategy: headline_plus_evidence_labels
failure_signatures:
  - generic desk still life
  - too many fake labels
---

# Editorial Artifact

## Use When

Use for technical explanations that should feel physical, inspected, and source-aware.

## Visual DNA

Tactile paper, acrylic, tags, clips, marked proof slips, soft shadows, editorial crop, asymmetrical whitespace.

## Must Use

- One object that feels like evidence.
- Real material texture.
- Controlled, restrained palette.

## Must Not Use

- Generic AI chips, robot hands, holograms.
- Fake readable labels or logos.
- Overly clean SaaS dashboard visuals.

## Prompt Skeleton

"Create a finished editorial artifact information card with a clear headline, 2-3 evidence labels, tactile evidence objects, cropped edges, paper/acrylic materials, and one dominant physical anchor. Use restrained off-white, graphite, muted accent colors, soft studio shadows, and no fake logos or tiny text."

## Layout Pairings

Best with `artifact-board`, `product-specimen`, `receipt-comparison`, and `flow-diagram`.

## Text Strategy

Headline plus evidence labels. Use 1 title and 2-3 short proof labels/numbers. Prefer abstract ruled lines only for decorative secondary notes.

## QA Checks

- The topic is represented by a specific artifact, not generic AI imagery.
- Materials look tactile and coherent.
- Required headline and evidence labels are present, readable, and intended.

## Repair Prompts

- "Make the scene less generic by replacing abstract AI objects with <TOPIC_ARTIFACT>."
- "Remove fake labels and use blank tags with ruled marks."
- "Increase editorial crop and asymmetrical whitespace."
