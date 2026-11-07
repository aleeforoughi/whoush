# Research-first generation

**Owner direction, 2026-11-06:** Whoush plans first and researches before it generates. It never relies on an image or video model alone for something with a real identity, in any category. Research is quick, effective and cheap, and then Whoush moves on.

**Categories:**
- places, landmarks, city skylines and architectural styles;
- product models (a car, a sneaker);
- garments and traditional or period dress;
- dishes;
- sports kits;
- musical instruments;
- animal and plant species;
- artifacts and artworks;
- historical figures, eras and events.

## When research runs

All three must hold:
1. **The planner marks the subject as needing research** (`research.subjects` in the plan, lib/creative-plan.ts):
   - Only public, well-documented subjects that are easy to find on Wikipedia or with an image search.
   - Never private people or the user's own things (their product, logo, face, tattoos, outfit). For those, Whoush asks the user for photos (lib/reference-needs.ts).
   - Never generic scenes.
2. **The user gave no references of their own:** no attached image and no saved character.
3. **The research text passes the plan-text safety check.** Modern political figures are refused. Pre-1900 figures are allowed, per docs/MODERATION_POLICY.md.

## Steps (lib/orchestrator.ts; stage `researching`, after `checking`, before `pricing`)

| Step | Where | Limits |
|---|---|---|
| Requirements: what must look right, as Persian facts for the report and English hard constraints in the prompt | planner (`preparePrivateCreativeRequest`) | at most 3 subjects, 1 or 2 queries each |
| Search: Wikimedia Commons first, Openverse only if Wikimedia is short; open licenses only (public domain, CC0, CC BY, CC BY-SA; never NC or ND) | lib/research.ts | 3 candidates per subject; 6-second requests; results cached for a day |
| Inspection: a private vision model judges relevance (the right culture and era, for example not Egyptian for Achaemenid) and safety (no nudity, gore or modern political content). One call for all images. Unavailable means no references are used. | lib/reference-inspect.ts | 512px images |
| Keep: Whoush-owned copies, with title, author, license and source link | lib/media-store.ts | 2 per subject, 4 in all; the whole research gets a 10-second budget |
| Report and confirmation: the proposal card shows «تحقیق هووش» (facts, the reference package as thumbnails, notes). The user removes a wrong one with ✕ or corrects Whoush in the chat; «با این مرجع‌ها بسازش» confirms. | components/research-report.tsx | |
| Quote: the kept references are bound into the signed quote and its `inputsDigest`. The server holds the list; the client only sends what was removed. | lib/quotes.ts | the model's own limit |
| Generation: references go inline to models that take them, with a note to follow their details but not their composition | lib/providers/google.ts, byteplus.ts | Nano Banana 2 and 2.1: 10; Seedream 5.0 Pro: 10; Lite: 14 |

**Video:** no video model takes reference images yet. The facts still shape the prompt, and the report says so.

**Next step:** make an accurate keyframe image from the references, then animate it (image to video).

## Cost

| Item | Cost |
|---|---|
| Wikimedia and Openverse searches | free (Openverse anonymous: 20 per minute, 200 per day) |
| One inspection call (Haiku-class model, about 12 small images at most) | a fraction of a cent |
| Reference images at generation | Nano Banana: input tokens; Seedream 5.0 Pro: about $0.003 per extra image. Within the approved SKUs. |

## Open owner items

- **A contact address in the research User-Agent** before production: Wikimedia requires one. Today it is the repository URL.
- **A registered Openverse application** (free; it needs an email) for higher limits.
- **General web image search is not used:** Google's Custom Search JSON API is closed to new customers and shuts down on 2027-01-01 (docs/evidence/GOOGLE.md).
- **Attribution in shared outputs:** CC BY and CC BY-SA references ask for credit if their content is reproduced. Whoush uses them as guidance, not as content, and keeps the attribution with each reference.
