# Orbit: design system

A cel-shaded sci-fi portfolio in the spirit of the reference site: calm paper UI floating over
painted 3D worlds. Each work category is its own world.
Run `npm run dev` and open `/design-system.html` to see everything live.

## Feel
- **Painted, not rendered.** Flat colour, three hard light bands, 1px ink lines, film grain over everything.
- **Paper UI in a painted world.** Controls are small, flat and calm, so the scene does the talking.
- **Simple transitions.** Fades, content rising into place, a gliding camera. Nothing flashy.

## Files
| File | What it is |
| --- | --- |
| `src/ds/tokens.css` | Colour, type, space, radius, motion tokens |
| `src/ds/components.css` | Header, buttons, card, cloud, help card, stepper, dots, tag, caption, orbit ring, cockpit, reveal/page-fade styles |
| `src/ds/patterns.css` | Page blocks: section head, chips, pill, portrait, about, project card + grid, filters, timeline, education, skills, awards, exploring constellation, interests, CTA band, status card, footer, case study, form, contact cards, socials, location |
| `src/ds/transitions.js` | `reveal()` fades `[data-reveal]` blocks up (70ms stagger) · `pageTransitions()` fades between pages |
| `src/ds/grain.js` | Film grain layer |
| `src/ds/toon/*` | three.js: palette, toon materials, `Stage` (ink post pass), props, worlds |

## Sitemap → blocks
**Home:** Hero (space world) · About preview (`.about`, `.portrait`, `.facts`) · Selected work (cockpit or `.project-grid`) ·
Experience (`.timeline`) · Education (`.edu`) · Skills (`.skills`, `.chip`) · Achievements (`.awards`) ·
Currently exploring (`.exploring` constellation) · Interests (`.interests`) · Contact CTA (`.cta-band`, `.status-card`) · Footer (`.site-footer`)

**Work:** `.filters`: All · Development · UI/UX · Graphic · Branding · Research, over a `.project-grid` of `.project-card`s

**Case study (one page per project):** `.case-hero` (category sky + horizon) · `.case-meta` · `.case-section` (pinned label) · `.case-figure` · `.case-stats` · `.case-next`

**Contact:** `.sec-head` · `.form` (`.field`, `.choices`) · `.contact-card` (copy email) · `.socials` · `.location` (live local time)

## Categories → worlds
| Category | World | Card sky |
| --- | --- | --- |
| Development | Earth: green hills, trees, red mesas | `--sky-earth` |
| UI/UX Design | Water: teal cliffs, lilac lagoon | `--sky-water` |
| Graphic Design | Desert: red rock, boulders | blue → rust |
| Branding | Outer space: asteroids, planet, gem | `--sky-space` |
| Research | Night lake: constellations | `--sky-dusk` |

`CATEGORY_WORLDS` in `worlds.js` holds this map, so the cockpit, filters and case-study heroes all agree.

## Colour
Ink `#160923` · Violet `#6d2d93` (brand) · Lilac `#d28eff` (accent) · Paper `#fbfbfb` / `#eeede7` · Lime `#7bf583` (live / now / found).
3D surfaces use exactly three tones from one ramp in `palette.js`.

## Type
Inter Tight stands in for Haffer (swap via `--font`). Mostly weight 500, tight tracking. Scale: 96 / 64 / 32 / 22 / 16 / 15 / 12.

## 3D rules
1. `toon(tone, { flat, rim })`: three hard bands. Use `flat: 1` for rocks and gems.
2. Ink is drawn by `Stage` in post. Opt out with `userData.noInk` (sky, clouds, stars).
3. Grain is one CSS layer on top of everything.
4. Fog fades the lines, so distant terrain stays soft.

## Motion
`--ease-out` 900ms for UI arriving · `--ease-in-out` 1800ms for camera moves · `--ease-spring` 420ms for small controls.
Pages fade through blur in 420ms. Reduced motion turns all of it off.
