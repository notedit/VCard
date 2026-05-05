# Theme Presets

Use these presets as palette and composition starting points for card sets. Do not copy external CSS wholesale. Define fresh local tokens for the card set and adapt the palette to the content, audience, platform, and ratio.

## Token Model

Every card set should define a compact theme token block before component styling:

- `--bg`, `--bg-soft`
- `--surface`, `--surface-2`
- `--border`, `--border-strong`
- `--text-1`, `--text-2`, `--text-3`
- `--accent`, `--accent-2`, `--accent-3`
- `--good`, `--warn`, `--bad`
- `--grad`, `--grad-soft`
- `--radius`, `--radius-sm`, `--radius-lg`
- `--shadow`, `--shadow-lg`
- `--font-sans`, `--font-serif`, `--font-mono`, `--font-display`

Use tokens in component CSS. Avoid scattering literal colors outside the token block unless a one-off asset or data visualization genuinely requires it.

## Preset Catalog

### `xiaohongshu-white`

Warm white background, red/pink accents, soft shadows, editorial consumer feel.

Use for Xiaohongshu posts, lifestyle, beauty, product notes, creator explainers, and warm social content.

### `soft-pastel`

Pale pink/blue/yellow accents, low contrast surfaces, rounded cards.

Use for friendly consumer content, lightweight guides, onboarding, calm announcements, wellness, education, and soft product explainers.

### `magazine-bold`

Cream background, black editorial text, orange spot color, large display headlines.

Use for cover cards, opinion pieces, columns, shareable hooks, cultural topics, and strong editorial narratives.

### `editorial-serif`

Cream paper feel, serif display type, muted brown/red accents.

Use for brand stories, longform summaries, literary or cultural topics, historical context, and text-led explainers.

### `corporate-clean`

White background, navy text, blue accent, conservative borders.

Use for B2B, reports, finance, board updates, formal business cards, operations summaries, and enterprise product messaging.

### `pitch-deck-vc`

White background, blue-to-violet accent, generous whitespace.

Use for product launches, startup narratives, fundraising, growth stories, metrics, market maps, and investor-facing summaries.

### `engineering-whiteprint`

White coordinate-grid feel, navy ink, mono display, square corners.

Use for API, architecture, system design, technical documentation, workflows, diagrams, developer education, and engineering explainers.

### `blueprint`

Deep blue grid, light technical lines, mono type, schematic feel.

Use for system maps, architecture diagrams, engineering plans, workflows, infrastructure, and technical roadmaps.

### `tokyo-night`

Dark blue developer palette, blue/violet accents, readable code-friendly contrast.

Use for AI, infrastructure, coding, developer updates, changelogs, technical analysis, and code-heavy content.

### `terminal-green`

Black/green terminal palette, mono type, subtle glow.

Use sparingly for CLI, terminal, retro computing, security, hacker-style cards, command references, and tool announcements.

### `news-broadcast`

White/gray base, strong red accent, hard editorial blocks.

Use for announcements, news, launches, version updates, breaking changes, comparisons, and high-urgency factual cards.

### `neo-brutalism`

Off-white base, black borders, hard shadows, yellow/pink/blue accents.

Use for bold opinions, youth-oriented campaigns, counter-positioning, intentionally loud covers, and high-energy social posts.

## Scenario Mapping

When the style is ambiguous, recommend 2-3 presets as concept directions:

- Business/report: `corporate-clean`, `pitch-deck-vc`, `minimal-white`-style restraint.
- Engineering/API/system: `engineering-whiteprint`, `blueprint`, `tokyo-night`.
- Social/Xiaohongshu: `xiaohongshu-white`, `soft-pastel`, `magazine-bold`.
- News/update: `news-broadcast`, `corporate-clean`, `tokyo-night`.
- Bold/opinion: `neo-brutalism`, `magazine-bold`, `news-broadcast`.
- CLI/cyber/dev: `terminal-green`, `tokyo-night`, restrained `cyberpunk-neon`-style accents.

## Guardrails

- Keep letter spacing at `0` unless uppercase micro-label tracking is necessary. Do not use negative letter spacing.
- Avoid one-note palettes unless the user explicitly asks for a monochrome look.
- Use high-effect themes such as terminal, neon, vaporwave, or aurora sparingly and only when the content benefits from drama.
- For technical topics, prefer `engineering-whiteprint`, `blueprint`, or `tokyo-night` before defaulting to generic neon tech styling.
- For final exports, keep source inspiration in `sources.md` or `credits.md` when relevant.
