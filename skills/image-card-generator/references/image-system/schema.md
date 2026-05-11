# Image System Registry Schema

This registry defines prompt-native image layouts and design languages for `image-card-generator`. It is intentionally not a CSS/layout system. Each spec is an information and composition contract for GPT Image 2 plus QA and repair guidance.

## Extension Contract

To add a layout:

1. Create `references/image-system/layouts/<id>.md`.
2. Follow the layout front matter and section schema below.
3. Add one row to `references/image-system/layouts/_index.md`.

To add a design language:

1. Create `references/image-system/design-languages/<id>.md`.
2. Follow the design-language front matter and section schema below.
3. Add one row to `references/image-system/design-languages/_index.md`.

Do not edit the core workflow for ordinary additions. The workflow reads indexes first, then only opens the selected specs.

## Layout Front Matter

```yaml
id: artifact-board
type: layout
status: stable
best_for: [explainer, proof, benchmark, comparison]
text_capacity: medium
information_roles: [proof, benchmark, comparison]
ratios: [4:5, 1:1]
visual_anchors: [paper_slips, pinned_board, specimen_tags]
compatible_languages: [editorial-artifact, field-notes, data-poster]
avoid_languages: [cinematic-still]
reference_friendly: true
failure_signatures:
  - cluttered board without dominant anchor
  - fake tiny labels
```

## Layout Sections

Every layout spec should include:

- `Use When`
- `Information Contract`
- `Composition Contract`
- `Prompt Blocks`
- `Text Rules`
- `QA Checks`
- `Repair Prompts`

## Design-Language Front Matter

```yaml
id: editorial-artifact
type: design-language
status: stable
best_for: [technical_explainer, product_note, model_update]
visual_traits: [tactile_artifacts, asymmetric_space, editorial_crop]
compatible_layouts: [artifact-board, product-specimen, receipt-comparison]
avoid_layouts: [cinematic-still]
text_strategy: headline_plus_evidence_labels
failure_signatures:
  - generic desk still life
  - too many fake labels
```

## Design-Language Sections

Every design-language spec should include:

- `Use When`
- `Visual DNA`
- `Must Use`
- `Must Not Use`
- `Prompt Skeleton`
- `Layout Pairings`
- `Text Strategy`
- `QA Checks`
- `Repair Prompts`

## Outline Fields

Every card in `outline.md` should include:

```markdown
**Image Layout**:
**Design Language**:
**Compatibility Reason**:
**Information Role**:
**Required Text**:
**Information Hierarchy**:
**Visual Anchor**:
**Composition Contract**:
**Text Plan / Text Risk**:
**Reference Strategy**:
**Primary Failure Risk**:
**Repair Strategy**:
```

These fields replace vague visual-concept-only planning. They make the generated card auditable before and after image generation.
