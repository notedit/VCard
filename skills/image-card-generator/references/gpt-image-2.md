# GPT Image 2 Via Aiberm

In this project, `gpt-image-2` image generation should use the Aiberm OpenAI-compatible Image API by default.

Project default:

- env key: `AIBERM_API_KEY`, with `AIBEAM_API_KEY` and `API_KEY` accepted for shared secret files.
- base URL: `https://aiberm.com/v1`
- generation endpoint: `POST https://aiberm.com/v1/images/generations`
- edit endpoint: `POST https://aiberm.com/v1/images/edits`
- client style: OpenAI-compatible `images.generate` and `images.edit`
- direct OpenAI and Responses API are not the default path; use them only when the user explicitly asks and verifies endpoint/model support.

## Required Environment

```bash
export AIBERM_API_KEY=...
# or
export AIBEAM_API_KEY=...
# or
export API_KEY=...
```

Optional overrides:

- `AIBERM_BASE_URL` or `AIBEAM_BASE_URL`: defaults to `https://aiberm.com/v1`.

## Size And Quality Defaults

Use sizes that are valid for GPT Image 2 style custom dimensions and practical for social cards:

| Ratio | Size |
|-------|------|
| `1:1` | `1536x1536` |
| `4:5` | `1280x1600` |
| `9:16` | `1088x1920` |

Only these card ratios are supported by the skill for now: `1:1`, `4:5`, and `9:16`. The image endpoint also accepts canonical sizes such as `1024x1024`, `1536x1024`, `1024x1536`, `2048x2048`, `2048x1152`, `3840x2160`, and `2160x3840`.

Size constraints:

- each side must be a multiple of 16 px.
- longest side must not exceed 3840 px.
- long:short side ratio must not exceed 3:1.
- total pixels must be between 655,360 and 8,294,400.

Default to `quality=low` for tests and prompt/layout iteration. Use `medium` or `high` for final exports when quality matters. `auto` is also accepted.

The generated PNG is the final card output for this skill.

## Output Options

- `output_format`: `png`, `jpeg`, or `webp`. Default `png`.
- `output_compression`: integer `0-100`, only for `jpeg` and `webp`.
- `background`: do not request `transparent`; `gpt-image-2` does not currently support transparent background through this path.
- `moderation`: `auto` or `low`; default `auto`.
- `stream` and `partial_images`: compatibility-dependent. Unless Aiberm support is confirmed for the current endpoint, use standard non-streaming JSON and read `data[0].b64_json`.

## Prompt Rules

For image-card generation:

- Ask for the full finished card image.
- Put the required text and information hierarchy before the visual description in each prompt file.
- Include the selected image layout id and design-language id in the prompt file for traceability.
- Build the prompt from `references/image-system/layouts/<id>.md` prompt blocks and `references/image-system/design-languages/<id>.md` prompt skeleton.
- Keep requested text short and explicit; use no-text only for explicitly requested visual-only variants.
- If text is required, specify large, clean, mobile-readable typography and exact wording.
- Exclude unwanted extra words, pseudo-letters, UI, logos, page numbers, captions, signatures, and watermarks.
- Use concrete nouns and materials: "folded inspection tag", "cropped package corner", "desk photo with marked proof slips".
- Avoid generic "AI future", floating chips, holographic brain, robot hands, and purple-blue glow unless explicitly requested.

GPT Image 2 text rendering is improved but still requires human inspection, especially for Chinese, logos, labels, and UI mockups.

For cover cards:

- Required Text may contain only the user-provided title and one generated guiding sentence.
- The title must be the largest visual focus.
- The guiding sentence must be shorter, secondary, restrained, and curiosity-building.
- Exclude every other word-like element: badges, labels, captions, page numbers, subtitles, metadata, fake marks, and pseudo text.

Prompt skeleton:

```markdown
Create a high-resolution finished social image card.

Required Text: exact short title and key facts to render.
Information Hierarchy: largest title, second-level metric/claim, supporting labels.
Subject: ...
Scene/Object: ...
Composition: ...
Style: ...
Lighting/Material: ...
Palette: ...
Quality: crisp, high detail, mobile-readable silhouette.
Exclusions: no unwanted extra text, no pseudo-letters, no logos, no watermark, no UI, no captions, no page number.
```

## Reference Images And Masks

Use reference images only when they materially improve continuity.

- Card 1: no reference unless the user supplied a brand/product/style reference.
- Cards 2+: optional `--ref assets/01-cover-*.png` for visual continuity.
- Multiple `--ref` images can guide a new composition.
- Do not use references when the next card needs a very different subject and the reference would force the wrong composition.
- Mask edits require an original image and a mask with matching dimensions, matching format, and an alpha channel. Treat masks as guidance, not pixel-perfect selections.
- Do not pass `input_fidelity` with `gpt-image-2`; the model handles input images at high fidelity automatically.

Record reference use in the prompt file:

```yaml
references:
  - path: assets/01-cover-topic.png
    usage: style-continuity
```

## Failure Handling

- If `AIBERM_API_KEY`, `AIBEAM_API_KEY`, and `API_KEY` are all missing, stop and report that an Aiberm key is required for real generation. For demos/tests, placeholder assets may be acceptable only if the user asked for a dry run.
- If Aiberm rejects `gpt-image-2`, do not silently switch models or endpoints. Report the model, size, quality, output format, and endpoint used.
- If complex prompts take a long time, use a reasonable command timeout or background task.
- If the result lacks `b64_json` but returns a temporary URL, download it and save the image.
- If the image contains unwanted text artifacts, update the prompt exclusions and regenerate.
