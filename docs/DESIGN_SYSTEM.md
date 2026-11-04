# Whoush UI & Design System Contract v1.0

**Status:** implementation contract for Claude. The foundation is built on Feather; Character Studio works browser-local only (server storage and provider upload pending); screenshot fidelity, accessibility and production workflows need verification. Inspired by the user's Runway UI/UX research, not copied Runway source or assets.

## Brand, localization and type
- Product: **Whoush / هووش**. Website and interface **Persian Farsi**, RTL-first. English permitted only for product names, international model names, file extensions and technical terms where needed.
- Primary font: **IRANSans / IRANSansX** using valid commercially licensed self-hosted WOFF2 files. Do not download, redistribute, bundle or commit proprietary font files without a verified license. CSS currently uses IRANSans-family names and safe Tahoma fallback. The user must supply a valid license/font files before claiming font integration is complete.
- `html lang="fa" dir="rtl"`, Persian-friendly line-height, correctly shaped glyphs, bidi isolation for English model names, URLs, digits and currency. Test `تومان`, `نورون`, Latin model names and mixed text.
- Corner radius: every button, input and control **8px**, cards **12px**, modals and sheets **16px** (Feather shape `rounded` in both brand token files; badges use the control radius via a component token). Circles only for non-button indicators such as progress step dots. The one exception is the full-screen media viewer (below): a surface that is the whole viewport has no corners, so it uses `rounded-none` while its buttons and badges keep the 8px control radius; `tests/design-system.test.ts` allows `rounded-none` in `components/media-viewer.tsx` only.
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

## Media-first assets and the full-screen viewer
Whoush is a media product, so /assets shows media first (`components/assets-gallery.tsx`):
- **Grid:** 1 column below 480px, 2 from 480px, 3 from `lg`, 4 only from `2xl`; 16px gaps; no horizontal scroll at 320px.
- **Card:** a 12px card whose media area fills its width at a fixed **4:5** ratio (`aspect-4/5`, top corners follow the card with `rounded-t-card`). Images are `object-cover`; a video shows its poster frame (`<video preload="metadata" muted playsinline>`) with a centered Play icon; audio and documents show a large kind icon on `bg-surface-subtle`. Laid over the media: the Persian tag Badge (top-start), icon-only download and share buttons (top-end, siblings of the open button, never nested in it), the duration for video and audio (bottom-end), on a bottom gradient made from tokens (`bg-linear-to-t from-background/80`). Under the media a compact strip shows the project Badge link, the relative date, the role label, size and pixel size. The whole media area is the button that opens the viewer («نمایش تمام‌صفحه #تصویر-۱ از پروژهٔ …»).
- **Studio:** attachment chips and tray stay compact, but any image or video thumbnail (and any `#tag` in a sent message) opens the same viewer, which steps through every file of the conversation.

**Full-screen viewer** (`components/media-viewer.tsx`, helpers in `lib/viewer.ts`). Not a modal card: full width, full height, the media centered at the largest size that fits (`object-contain`), with the controls laid over it.
- **Surface:** a Base UI dialog (focus trap, Escape, focus return) from `@base-ui/react/dialog`, the package Feather's own Dialog is built on (it is Feather's dependency, so no new install). Feather's `DialogContent` is not used because its scrim, backdrop blur and rounded frame cannot be overridden through `className`. `fixed inset-0 w-screen h-dvh max-w-none rounded-none`, no padding, no backdrop blur, `role="dialog" aria-modal="true" aria-label="نمایش تمام‌صفحه"`. The element carries the `dark` class and `bg-background`, so Feather's dark tokens apply in both themes (the theme is class based) and no raw color is used.
- **Radius exception:** `rounded-none` here only; see the radius rule above.
- **Controls** (secondary Buttons, 44px, `rounded-control`, aria-labels): top bar on a token gradient with close (start), tag, role and project title (a link to `/studio?project=<id>`) in the middle, and download, share (the same share flow with story, post and reel targets and fit badges), Instagram and «باز کردن پروژه» at the end; on narrow screens the title wraps to a second row. Previous and next sit at the vertical middle of the inline edges with RTL-correct arrows (in RTL next is on the left with `ChevronLeft`); at the ends the button is disabled (no wrap). The counter «۳ از ۱۲» is at the bottom in Persian digits.
- **Keyboard:** Escape closes (or only the share dialog when it is open); ArrowLeft is next and ArrowRight previous in RTL (swapped in LTR); Home and End go to the first and last item. Keys typed in the share dialog, an input or a media control are left alone.
- **Touch:** a horizontal swipe of at least 50px, mostly horizontal (pointer events, `touch-action: pan-y`), moves between items, RTL-correct (drag right = next in RTL).
- **Auto-hide:** the overlays fade (Feather's `motion-state` role) after 3 seconds without pointer movement and come back on pointer move, tap, key press or focus. They stay while keyboard focus (`:focus-visible`) is on one of them. With `prefers-reduced-motion` they are always visible and video does not autoplay.
- **Media:** images `<img>`; video `<video controls playsinline muted autoplay>` (the person unmutes); audio a large icon with `<audio controls>`; other files an icon, name, size, type and a download button. A file whose bytes are not in this browser shows «فایل در این مرورگر موجود نیست».

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
