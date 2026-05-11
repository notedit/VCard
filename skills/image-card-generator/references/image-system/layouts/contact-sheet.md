---
id: contact-sheet
type: layout
status: stable
best_for: [video, timeline, multi_example, visual_evidence, sequence]
text_capacity: low-medium
information_roles: [evidence, timeline, sequence, multi_example]
ratios: [4:5, 1:1, 9:16]
visual_anchors: [film_strip, contact_frames, timeline, frame_sequence]
compatible_languages: [image-led-magazine, newsroom-poster, cinematic-still, editorial-artifact]
avoid_languages: [product-catalog]
reference_friendly: true
failure_signatures:
  - fake subtitles or UI chrome
  - frames look unrelated
  - too many tiny unreadable panels
---

# Contact Sheet

## Use When

Use for video model updates, event localization, before/after sequences, multi-example evidence, or "what the model saw" stories.

## Information Contract

Must include a title and clear evidence structure: 3-5 frames, each with either a simple visual distinction or a short label. Avoid fake subtitles inside frames.

## Composition Contract

Use 3-7 frames, not a dense grid. One frame may dominate while others form a strip or timeline. Frames should share a visual story.

## Prompt Blocks

- "Create a finished social card using a curated contact sheet of video-like frames."
- "Use one dominant frame plus a side strip of smaller frames and waveform or timeline cues."
- "Avoid UI chrome, subtitles, captions, or readable frame labels."

## Text Rules

Low-medium text capacity. Use one title and up to three short evidence labels outside frames. Avoid captions inside frames.

## QA Checks

- Frames feel related.
- No fake subtitles, player controls, timestamps, or logos.
- The main frame is readable on mobile.

## Repair Prompts

- "Remove fake UI: replace player controls, subtitles, and timestamps with clean film-frame borders."
- "Reduce frame count to one dominant frame and four supporting frames."
- "Unify the sequence with consistent lighting and subject matter."
