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
