# «زیباسازی» (Beautify it)

**Status:** added 2026-11-08 at the owner's request. Code: `lib/beautify.ts`, with the offer in `lib/orchestrator.ts` and the card in `components/plan-details.tsx`.

## What it is

A package that turns an everyday photo of a person into an editorial one they love to share.
- **Every change is natural:** the same person, the same place and viewpoint, and the same outfit, hairstyle and beard style.
- **Parts:** there is one switch per part:
  - lens, framing and focus;
  - posture and expression;
  - light;
  - skin;
  - hair, beard and brows;
  - face and jaw shape (very slight);
  - clothes;
  - colour settings.

## When it is offered

Whoush never forces it; it offers it as an option.

- **On upload:** the photo's safety check (the same vision call) also judges whether this is an everyday photo of a person that a professional edit would clearly improve. It lists what it sees, one note per part. The card appears in the chat right away, with those notes under the switches.
- **In a message:** the vision step that reads an edit request also says whether the user is trying to look better (a glow-up, editorial, a professional photo). The card appears on its own, or under the edit card when there are areas to mark.
- **Starting parts:** the parts the photo needs start on, plus colour. The rest start off.

## Rules

- **Never guess (owner, 2026-11-08):** only what the photo shows changes.
  - No new head or face angle.
  - No teeth when the mouth is closed.
  - Closed eyes are never opened.
  - No hidden side of the face or hair is shown.
- **Camera:** it only removes wide-lens distortion, levels the frame and centres the face. The viewpoint and background stay the same.
- **Under 18:** if the person looks under 18 (judged by either check), only lens and framing, light, clothes and colour are offered. The server also enforces this from its own record, whatever the request says.
- **Findings stay on the server:** the findings live in the server's record of the checked photo. The browser sends only the chosen parts, so it cannot change the brief.

## Live test on the owner's selfie (dev, no charge, Nano Banana 2, 3:4)

**Found on upload:** shot from below so the face looks wider; a stern expression; harsh light from above and behind; shine and uneven tone; stray beard hairs and untidy brows; lint on the black T-shirt; exposure fighting the bright sky.

| Run | Brief | Result |
|---|---|---|
| 1 | "Every change slight", "when unsure, keep the photo" | Almost no visible change |
| 2 | Fixes done fully; camera "as if shot at eye level" | Clearly better grooming, clothes and light, but the viewpoint and background changed (a re-shoot, risking drift) |
| 3 | Fixes done fully; the same viewpoint, background and head angle; lens distortion only | The viewpoint and background are kept. The face is slightly less wide, the beard and brows are clean, the skin is cleaner with its texture kept, and the colour is richer. The lint on the T-shirt remained, and the light improved only a little. |

**Owner's review of runs 2 and 3:** run 2 is amazing but lost the selfie's mood and the face language. Run 3 only retouched the skin: no angle fix, the face still deformed, no feature refinement, no beard trim, no fill for the thinning hair, and the clothes not cleaned.

**Brief after the review:**
- the fixes are done fully, including a slight camera move or perspective warp to undo the low angle and wide lens;
- less facial puffiness and a natural jawline;
- the features refined subtly;
- the beard trimmed by a barber, and thinning hair filled while the hairline is kept;
- the clothes lint-free and wrinkle-free;
- the photo's mood, setting and colour kept;
- the face's emotion and vibe read and refined into a slight editorial modelling gesture.

The never-guess rule stays.

| Run | Result |
|---|---|
| 4 | Angle corrected moderately, the face no longer widened, a barber-trimmed beard, shaped brows, the T-shirt clean (lint and wrinkles gone), the expression kept. The sky went out of view. |
| 5 | Near eye level, the face slimmer and no longer puffy, a natural jawline, the beard and brows clean, the T-shirt clean, the calm expression kept. The sky is still out of view: moving the camera changes what is behind. |

**One shot:** every run is a single generation (one Neuron in dev). The owner's goal is one shot to save money. A multi-step pipeline (relight, then face, then clothes), with each step priced on the card, is only worth building if one shot stops being enough.

## Goal, self-check and quality (2026-11-08)

- **Goal (owner):** social-media ready. The person proudly posts it and gets likes; it is beautiful and still them. The goal leads the brief.
- **Self-check:** after the result, a private vision call compares it with the original, asking:
  - would they share it for likes;
  - is it beautiful and natural (not CGI or plastic);
  - is it the same person;
  - is the mood kept.

  The card shows «آماده‌ی انتشار» with one sentence, or «هنوز آماده‌ی انتشار نیست» with the one fix. This is advice only; nothing is generated or charged again on its own.
- **Quality:** the brief demands a real photograph with every pore and texture kept, and no pixelation. The proposal recommends the cheapest 2K-or-higher model, but never one that stamps a visible mark.
- **The card:** four general switches and one line of what was seen.

**Run 6 (Seedream 5.0 Pro · 2K, 1776×2368):**
- **Better than before:** the sky and window were kept in view (the mood held), the angle corrected, the face slimmer, the beard groomed, the shirt clean, real pores at full resolution.
- **Wrong:**
  - BytePlus's visible «AI generated» mark sat bottom right;
  - the identity drifted more than with Nano Banana (heavier brows, wider eyes).

  The self-check judged it not ready.
- **Since then:** a watermarking model is never preferred, so «زیباسازی» uses Nano Banana again until the owner decides on Seedream's watermark (docs/PROVIDERS.md).

## Whoush's own review of a result (2026-11-08)

The owner's wording: «باید پوست رو طبیعی نگه دارم، ابرو رو برگردونم. یه بار دیگه با پرامپت جدید اصلاح کنم اینا رو یا همین خوبه؟»

- **The two checks:** the self-check (on «زیباسازی» results) and the quality assessor (on every other picture, with or without a person) write the fixes twice:
  - in Whoush's own first-person voice in Persian, for the card;
  - as precise English instructions, which stay on the server.
- **The result card:** Whoush's line, «یه بار دیگه با پرامپت جدید اصلاحش کنم یا همین خوبه؟», and «آره، اصلاحش کن» / «همین خوبه».
- **«آره، اصلاحش کن»:** the quote route derives a new private turn from that job's turn (`deriveTurnWithFix`). It has the same prompt, references, selection lock and «زیباسازی» source, and the review's fixes come first. It is quoted at the normal price and run as a new card under the original.
- **No loops:** a fixed result is never offered another fix.
- **Never a failure:** nothing is refunded; the fix is a new, priced request the user chose.
- **Replaced:** the earlier behaviour, where the assessor posted a «زیباسازی» card.
