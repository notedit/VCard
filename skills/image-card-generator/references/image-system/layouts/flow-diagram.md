---
id: flow-diagram
type: layout
status: stable
best_for: [process, pipeline, mechanism, agent_workflow, cause_effect]
text_capacity: medium
information_roles: [mechanism, process, pipeline, agent_workflow]
ratios: [4:5, 1:1, 9:16]
visual_anchors: [pipeline, node_path, arrows, modular_blocks]
compatible_languages: [data-poster, editorial-artifact, field-notes, swiss-poster]
avoid_languages: [cinematic-still]
reference_friendly: partial
failure_signatures:
  - unreadable spaghetti diagram
  - fake UI nodes
  - arrows without a clear start and end
---

# Flow Diagram

## Use When

Use for mechanism cards: how input becomes output, agent steps, reasoning pipelines, or multimodal fusion.

## Information Contract

Must include a title and 3-5 step labels. The path should communicate sequence or causality.

## Composition Contract

Use 3-5 nodes with a clear path. One node should be dominant or highlighted. Arrows must create directional flow, not decorative confusion.

## Prompt Blocks

- "Create a finished social card as a tactile flow diagram with 3-5 physical nodes."
- "Use clear directional arrows, modular blocks, and one highlighted node."
- "Avoid software UI screens and tiny labels."

## Text Rules

Medium capacity. Use short node labels and one title.

## QA Checks

- Start, path, and endpoint are visually obvious.
- Nodes are not too numerous.
- No fake UI or tiny unreadable labels.

## Repair Prompts

- "Simplify the flow to four large nodes and one clear directional path."
- "Remove fake interface panels and use physical blocks with blank labels."
- "Highlight the key node with color and scale rather than extra text."
