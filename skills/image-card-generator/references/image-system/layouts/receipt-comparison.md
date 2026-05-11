---
id: receipt-comparison
type: layout
status: stable
best_for: [pricing, cost, checklist, bill_of_materials, tradeoff]
text_capacity: medium
information_roles: [pricing, cost, checklist, tradeoff]
ratios: [4:5, 1:1]
visual_anchors: [receipt, bill, price_tag, comparison_slip]
compatible_languages: [field-notes, editorial-artifact, data-poster, newsroom-poster]
avoid_languages: [cinematic-still]
reference_friendly: true
failure_signatures:
  - hallucinated prices or fake line items
  - fake brand logos
  - too many receipt rows
---

# Receipt Comparison

## Use When

Use for pricing, token cost, tradeoffs, checklists, deployment decisions, and "what changed" summaries with cost implications.

## Information Contract

Must include a title and 2-4 line items or checklist facts. If prices are included, they must be large and few.

## Composition Contract

Use one dominant receipt, invoice, bill, price wedge, or comparison slip. Keep row count low. The physical receipt should carry the metaphor, not a full spreadsheet.

## Prompt Blocks

- "Create a finished social card centered on a tactile receipt or price comparison slip."
- "Use one large receipt-like artifact with two or three clear line groups."
- "Avoid fake company logos, random prices, and tiny receipt clutter."

## Text Rules

Medium capacity but high text risk. Use one title plus 2-4 large line items. Exact prices and numbers must be large and QA'd.

## QA Checks

- Exact prices, if requested, are correct.
- No extra hallucinated line items.
- The receipt metaphor is clear without looking like a real invoice.

## Repair Prompts

- "Remove all small receipt rows and keep only the exact prices: <PRICE_LIST>."
- "Replace fake logos with blank stamps and ruled lines."
- "Enlarge the cost comparison area and reduce decorative paper clutter."
