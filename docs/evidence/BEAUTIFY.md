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

**Open:** the lint and light (the model holds back on the outfit when told to keep it). A second, local pass on the shirt with the selection lock would do it reliably.
