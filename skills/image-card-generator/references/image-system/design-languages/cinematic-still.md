---
id: cinematic-still
type: design-language
status: stable
best_for: [mood_cover, story_opener, dramatic_implication]
visual_traits: [scene_light, atmosphere, subject_dominance]
compatible_layouts: [full-bleed-poster, contact-sheet]
avoid_layouts: [receipt-comparison, flow-diagram, artifact-board, big-number]
text_strategy: title_plus_one_claim
failure_signatures:
  - vague atmosphere
  - subject too small
  - unreadable dark scene
---

# Cinematic Still

## Use When

Use for story openers, emotional covers, or cards where a scene communicates the idea better than a diagram.

## Visual DNA

Scene, light, atmosphere, subject dominance, motion implication, realistic but synthetic framing.

## Must Use

- A clear subject or event.
- Strong lighting direction.
- Readable silhouette.

## Must Not Use

- Vague moody backgrounds.
- Dense text.
- Charts, receipts, or diagrams.

## Prompt Skeleton

"Create a finished cinematic still information card with a readable title, one short claim, a clear dominant subject, strong directional lighting, readable silhouette, and atmospheric depth. Avoid vague mood-only backgrounds, dense text, logos, and UI."

## Layout Pairings

Best with `full-bleed-poster` and `contact-sheet`.

## Text Strategy

Use a readable title plus one short claim. Do not let atmosphere replace the message.

## QA Checks

- Subject reads immediately.
- Scene is not too dark.
- Title/claim are readable and atmosphere supports a concrete idea.

## Repair Prompts

- "Make the subject larger and clearer in silhouette."
- "Brighten the key light and reduce vague atmospheric haze."
- "Replace mood-only scenery with a specific event: <EVENT>."
