---
name: elev-design
description: Use this skill to generate well-branded interfaces and assets for ELEV (personal running/trail coaching & tracking brand), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key facts to remember (aligned with the shipped product on 2026-08-21 — see readme.md):

- **Dark theme only.** Canvas `#0C0F0E`, then three surface steps: `#181D1B`, `#202622`, `#242B27`. Cold neutrals, never warm. Depth comes from surface contrast, not from borders.
- **One accent: the brand green `#6B8E4E`.** Rare and meaningful — GPX profile, primary button, active state, keyboard focus, positive progress. Never on every border, title or chart. Target split: 80% neutral / 15% sage / 5% signal green. Text on a green fill uses the canvas `#0C0F0E` (5.14:1), never white (3.75:1, fails WCAG AA).
- **Three type families, each with an exclusive role.** Raleway 700/800 for headings. Inter for body copy and labels. **IBM Plex Mono 500/600 for numeric values only** — distances, paces, elevation gain, durations, dates, scores. Never for running text. A mono is tabular by construction, so `font-variant-numeric` is redundant on those elements.
- **Text contrast**, measured against the lightest surface: primary `#F0F3F0` 12.96:1, secondary `#A9B1AC` 6.60:1, muted `#8B958E` 4.68:1. `#5F6863` sits at 2.52:1 and is reserved for disabled controls, which WCAG exempts.
- **Chart colours are validated, not chosen by eye.** Run `validate_palette.js` from the `dataviz` skill before shipping any series palette. Training load uses `#3D9E4F` / `#6F8FD8`; heart-rate zones use a single-hue ordinal ramp, `#2F5D3A` → `#8AD489`.
- **No logo file** — render "ELEV" in type, next to the mountain mark used in the sidebar.

The earlier two-tone light proposal (anthracite `#2B2B2B` + off-white `#F2F1EE`, no accent, IBM Plex Sans everywhere) was never implemented and must not be used.
