---
id: data-poster
type: design-language
status: stable
best_for: [metrics, benchmarks, comparison, pricing]
visual_traits: [large_numbers, structured_fields, proof_marks]
compatible_layouts: [big-number, split-field, flow-diagram, artifact-board, receipt-comparison]
avoid_layouts: [cinematic-still]
text_strategy: short_numeric_text
failure_signatures:
  - fake extra numbers
  - generic infographic grid
  - equal metric boxes with no hierarchy
---

# Data Poster

## Use When

Use when numbers, benchmarks, price, or ratios are the reason to save the card.

## Visual DNA

Large numeric anchors, measured fields, proof stamps, calibrated marks, restrained color, evidence-first structure.

## Must Use

- One dominant metric or a clear metric hierarchy.
- Numeric scale or measurement metaphor.
- Support marks that feel deliberate.

## Must Not Use

- Many equal metric boxes.
- Random extra numbers.
- Fake rankings or unsourced claims.

## Prompt Skeleton

"Create a finished data poster information card with one dominant exact metric, one clear label, optional support metrics, measured fields, proof marks, and a restrained editorial palette. Make numbers large and clean. Avoid extra fake numbers, tiny labels, and generic infographic grids."

## Layout Pairings

Best with `big-number`, `split-field`, `flow-diagram`, `artifact-board`, and `receipt-comparison`.

## Text Strategy

Exact numbers are the content. Use one primary metric, one clear label, and up to two support metrics. All numbers must be large and QA'd. Avoid dense tables.

## QA Checks

- Main number and label are correct.
- No hallucinated extra metrics.
- Hierarchy is stronger than the grid.

## Repair Prompts

- "Render only these exact numbers: <NUMBERS>; remove all other digits."
- "Make one number dominant and reduce equal metric boxes."
- "Replace generic grid background with measured poster fields and proof marks."
