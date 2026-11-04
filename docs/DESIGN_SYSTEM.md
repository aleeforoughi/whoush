# Whoush UI & Design System Contract v1.0

**Status:** implementation contract for Claude. The foundation is built on Feather; Character Studio works browser-local only (server storage and provider upload pending); screenshot fidelity, accessibility and production workflows need verification. Inspired by the user's Runway UI/UX research, not copied Runway source or assets.

## Brand, localization and type
- Product: **Whoush / هووش**. Website and interface **Persian Farsi**, RTL-first. English permitted only for product names, international model names, file extensions and technical terms where needed.
- Primary font: **IRANSans / IRANSansX** using valid commercially licensed self-hosted WOFF2 files. Do not download, redistribute, bundle or commit proprietary font files without a verified license. CSS currently uses IRANSans-family names and safe Tahoma fallback. The user must supply a valid license/font files before claiming font integration is complete.
- `html lang="fa" dir="rtl"`, Persian-friendly line-height, correctly shaped glyphs, bidi isolation for English model names, URLs, digits and currency. Test `تومان`, `نورون`, Latin model names and mixed text.
- Root font size `16px = 1rem`. Spacing scale `8px` increments; exception only for optical hairlines/icon geometry. Consistent typography scale, readable UI, generous breathing room.

## Palette
Dark (default):
- Main canvas **#000000**, panels **#080B12**, surfaces **#141922**, borders **#28313E**, text **#F5F8FF**.
- Primary **Electric Blue #005BFF**, hover **#246FFF**, accent text **#80B4FF**.
Light:
- Main background **#FFFFFF**, soft canvas **#FBFCFF**, panels **#F7F9FC**, text **#181C25**.
- Primary **Google Blue #1A73E8**, hover **#1765CD**, borders **#E3E7EE**.
Use accessible contrast, not just brand fidelity. Blue accents are for meaningful actions and selected state, not decoration. Semantic success/error/status colors should be accessible and subdued. Avoid purple in final design; old prototype purple CSS must be overridden or removed.

## UX & visual language
- Runway-inspired, original three-zone desktop workspace: navigation rail, central media canvas, contextual agent chat. Preserve source research information architecture and user-first flow.
- Minimal, premium, spacious, precise alignment; 8pt rhythm, clear grouping, balanced proportions and proximity. No crowded controls, gratuitous cards or unnecessary gradients.
- Mobile-first: single-focus chat/canvas modes on narrow screens, touch targets **>=44×44px**, responsive asset thumbnails, no horizontal scroll, no hidden critical actions.
- Motion: subtle `cubic-bezier(.22,1,.36,1)` transitions at **140–340ms**, no bouncing, no heavy blur. Respect `prefers-reduced-motion`. Native smooth scroll only when motion is permitted.
- Accessibility: WCAG 2.2 AA target, keyboard navigation, visible focus, screen reader labels, accessible dialog/menus, semantic landmarks, 4.5:1 normal text contrast, 3:1 relevant control boundaries, text scaling, RTL arrow/key behavior.
- Every step clear and explainable: prompt → best Higgsfield media model suggestion → optional alternative choices → fixed whole-Neuron price → explicit approval → queued/running/output → quality check. No public reasoning LLM selector, vendor names or LLM token accounting.
- Do not imply character references, identity lock, phoneme alignment, real-time trend feeds or generation are already live when only scaffolded.

## Status (P0 design foundation)
- The UI is built from the owner's **Feather 1.17.0** design system (`@aleeforoughi/feather-react`, `@aleeforoughi/feather-tokens`) on Tailwind CSS v4. Whoush brands Feather only through tokens; no Feather component is edited or forked.
- **Font: IRANSans v5.00, owner-supplied, local only.** `app/fonts.css` declares six weights (200–900, WOFF2 + WOFF) from `public/fonts/iransans/`. The binaries are git-ignored because this repo is public, so CI and other machines fall back to Inter Variable and Tahoma. The owner confirmed the license covers Whoush (2026-11-04); production still needs the files delivered to the deploy from private storage, never from this public repo.
- RTL: Feather 1.17.0 still uses some physical left/right classes. `app/feather-rtl.css` holds temporary scoped overrides for the parts Whoush renders (remove when aleeforoughi/feather#1 ships logical properties).
- Light and dark brands are two token files because Feather's brand CLI themes one file; `scripts/brand.mjs` merges them (see feather#1).

## Implementation sources
- `brand/tokens.json` (light) and `brand/tokens.dark.json` (dark) → `npm run brand` → `app/styles/brand.css`, `app/styles/brand-fonts.css` (committed, tested for drift).
- `app/globals.css`, `app/fonts.css`, `app/feather-rtl.css`: stylesheet entry, font stacks, temporary RTL overrides.
- `components/theme-toggle.tsx`: dark/light toggle on the `dark` class of `<html>` (`localStorage["whoush-theme"]`, default dark, applied before paint by the inline script in `app/layout.tsx`).
- `app/characters/page.tsx` + `components/character-studio.tsx` (+ `character-parts.tsx`): six-angle Persian Character Studio with consent v1.0, per-angle metadata, duplicate/quality checks, PNG sheet and JSON manifest export. `components/character-picker.tsx`: character selection in the Studio agent panel.
- `lib/skills.ts` + `lib/advanced-skills.ts`: 22 professional skills, routed privately.
- `lib/characters.ts` (pure: consent, metadata, coverage, versioning, manifest, tests in `tests/characters.test.ts`), `lib/character-store.ts` (IndexedDB), `lib/character-files.ts`, `lib/character-export.ts`: browser-local reference data only. Server-side authenticated storage, provider reference upload and a verified reference-capable model are pending; a character in chat yields 422 `no_compatible_model` with a plan.

## Claude acceptance criteria
1. Refactor prototype CSS to tokens, remove purple hardcoded values and inconsistent spacings; dark/light coverage on **every** page.
2. Obtain licensed IRANSans font files from project owner; configure local font loading with correct font weights, fallback and font-display swap. Until then, explicitly show font as pending.
3. Verify desktop (1440, 1280), tablet (768), mobile (390 and 320), light/dark, 200% zoom and keyboard-only flow.
4. Build Storybook components and screenshots for buttons, forms, navigation, model cards, generation proposals, chat, progress, Neuron packages and character angle upload cards.
5. Audit Persian RTL layout, bidi content, accessible contrast and reduced-motion. Run lint/typecheck/tests/build. Do not assert pixel-perfect fidelity without screenshots.
6. Preserve Whoush billing: FX controls **neurons granted** for a toman package; model catalog controls **fixed whole-Neuron spend**. Package gifts and tier discounts visible, underlying unit FX/Neuron price not customer facing.
7. Keep provider use mock-only until legal eligibility, Higgsfield terms, multimodal moderation and secure billing gates pass.
