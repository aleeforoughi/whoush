# Whoush UI & Design System Contract v1.0

**Status:** implementation contract for Claude. The existing foundation and Character Studio are scaffolds; screenshot fidelity, accessibility and production workflows need verification. Inspired by the user's Runway UI/UX research, not copied Runway source or assets.

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

## Implementation sources
- `app/design-system.css`: token layer and initial theme overrides.
- `components/theme-toggle.tsx`: dark/light toggle, local preference.
- `app/characters/page.tsx` + `components/character-studio.tsx`: six-angle Persian Character Studio.
- `lib/skills.ts` + `lib/advanced-skills.ts`: 22 professional skills, routed privately.
- `lib/characters.ts` + `lib/character-store.ts`: browser-local reference data only; not yet a server-side identity asset graph.

## Claude acceptance criteria
1. Refactor prototype CSS to tokens, remove purple hardcoded values and inconsistent spacings; dark/light coverage on **every** page.
2. Obtain licensed IRANSans font files from project owner; configure local font loading with correct font weights, fallback and font-display swap. Until then, explicitly show font as pending.
3. Verify desktop (1440, 1280), tablet (768), mobile (390 and 320), light/dark, 200% zoom and keyboard-only flow.
4. Build Storybook components and screenshots for buttons, forms, navigation, model cards, generation proposals, chat, progress, Neuron packages and character angle upload cards.
5. Audit Persian RTL layout, bidi content, accessible contrast and reduced-motion. Run lint/typecheck/tests/build. Do not assert pixel-perfect fidelity without screenshots.
6. Preserve Whoush billing: FX controls **neurons granted** for a toman package; model catalog controls **fixed whole-Neuron spend**. Package gifts and tier discounts visible, underlying unit FX/Neuron price not customer facing.
7. Keep provider use mock-only until legal eligibility, Higgsfield terms, multimodal moderation and secure billing gates pass.
