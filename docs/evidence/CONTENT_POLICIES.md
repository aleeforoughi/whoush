# Media providers' content policies (read 2026-11-08)

Official pages only, read by a research pass on 2026-11-08. Nothing here is inferred: where a provider documents nothing, the entry says so. Several vendor
sites render with JavaScript, so some policy bodies could not be read; those are marked **not retrieved** and stay open items.

Whoush's own rules are separate (docs/MODERATION_POLICY.md, `lib/region-policy.ts`). Every provider below forbids bypassing its safety filters
(Google Prohibited Use Policy; BytePlus video terms; Higgsfield Terms 5.2(xiii); Kling removal of labels III(VIII)(6)), so Whoush never disguises
prompts: it words them clearly, switches provider when one refuses, and tells the user.

## Google (Gemini API: Nano Banana images)
- Sources: Prohibited Use Policy https://policies.google.com/terms/generative-ai/use-policy (updated 2024-12-17); safety settings
  https://aistudio.google.com/docs/safety-settings; error codes https://aistudio.google.com/docs/api-errors; image generation
  https://aistudio.google.com/docs/image-generation; Omni and video https://aistudio.google.com/docs/omni, https://aistudio.google.com/docs/video;
  usage policies https://aistudio.google.com/docs/usage-policies.
- Prohibited: content for pornography or sexual gratification; violence or its incitement; hate; child sexual abuse or exploitation; non-consensual
  intimate imagery; misleading claims about governmental or democratic processes; impersonating a person "without explicit disclosure, in order to deceive".
- Real people: uploading and editing images of "certain recognizable people is not supported"; minors' images cannot be uploaded or edited in the
  EEA, Switzerland and the UK; search grounding does not use real-world images of people (Nano Banana 2 and 2.1).
- Not documented: public figures or celebrities as such, fictional vs graphic violence, swimwear, weapons, drugs, brands.
- Parameters: safety categories `harassment`, `hate_speech`, `sexually_explicit`, `dangerous_content`, `jailbreak` with thresholds `off`,
  `block_only_high`, `block_medium_and_above`, `block_low_and_above` (child safety always blocked); the page does not cover image models. No person
  generation parameter is documented for the image models. Every image and video carries SynthID; no parameter turns it off.
- Refusal codes (HTTP 400, message "Input blocked: ..."): `safety`, `jailbreak`, `prohibited_content`, `blocklist`, `spii`, `recitation`,
  `image_safety`, `image_prohibited_content`, `image_recitation`, `image_other`, `content_blocked` (also `language`, `no_image`, which are not
  refusals). Prompts, context and outputs are kept 55 days; projects can be suspended.
- Veo is not available in the Gemini API (ended 2026-10-22, docs/evidence/GOOGLE.md).

## BytePlus ModelArk (Seedream 5.0, Seedance 2.0)
- Sources (prefix B = https://ai.byteplus.com/ark/region:ap-southeast-1/docs/, `.md`): B/Content_Pre-filter (updated 2026-09-10), B/error-codes,
  B/seedance-portrait-asset-guide, B/copyright_and_portrait_feature_usage_rules, B/update-endpoint-api. GenAI Acceptable Use Policy, general AUP
  (2026-08-31) and the video generation terms (2026-09-08): **bodies not retrieved**.
- Filter categories: minor safety; hate; "Nudity, Sexual, and Graphic Content" (pornography, abuse, violence, self-harm); misinformation.
- Real people: Seedance does not accept reference images or videos with real human faces, except preset digital characters, the account's own prior
  outputs (`asset://<ID>`) or authorized real-person assets. Portrait materials must not be used for deepfakes of public figures or in political,
  sensitive or reputation-damaging contexts.
- Parameters: per-endpoint content filter (on by default; a baseline stays when off); endpoint `Moderation.Strategy` `Default`, `Basic`, `Skip`,
  `Customized`; `watermark` (Seedream default visible); `safety_identifier` per end user.
- Refusal codes (HTTP 400; a video task ends `failed` with `error.code`): `SensitiveContentDetected`, `Input{Text,Image,Video,Audio}SensitiveContentDetected`
  (also `.PolicyViolation`, `.PrivacyInformation` "may contain a real person"), `Output{Text,Image,Video,Audio}SensitiveContentDetected` (also
  `.PolicyViolation`, `OutputImageSensitiveContentDetected.DeepFake`).

## Kling (official API, Kling 3.0)
- Sources: Terms of Service https://kling.ai/docs/user-policy (effective 2026-04-21); Community Guidelines https://kling.ai/docs/community-policy
  (effective 2026-09-08); error codes https://kling.ai/document-api/api/get-started/error-codes (rendered with JavaScript; summary only).
- Prohibited: sexually explicit content; impersonation; portrait, personality or privacy violations; harassment; content encouraging crime or
  self-harm; discrimination; election disinformation; inciting the overthrow of a government; glorifying violence; selling weapons or drugs; any
  sexualised content involving minors (under 18), including virtual ones. Political campaigning, advocacy or lobbying needs Kling's written consent.
  Outputs must be labelled as Kling-generated and commercial use needs written permission (Terms 4.5, 4.6).
- Not documented: celebrities as such, nudity outside a sexual context, swimwear, fictional vs graphic violence. No safety parameter.
- Refusal codes: 1300 and 1301 (policy or safety; docs/evidence/KLING.md); 1301 confirmed as "Trigger strategy", HTTP 400.

## Higgsfield (Seedance 2.5, Soul, Genjutsu)
- Sources: Terms of Use https://higgsfield.ai/terms-of-use-agreement (updated 2026-10-23); https://docs.higgsfield.ai/docs/help/faq.md,
  /concepts/requests.md, /concepts/errors.md, /concepts/billing-and-retention.md; moderation article
  https://higgsfield.ai/creator-hub/help-center/troubleshooting/content-flagged-as-nsfw (2026-09-01).
- Prohibited: unlawful, threatening, harassing, defamatory, obscene, hateful or profane content; promoting suicide, self-harm or disordered eating;
  harming or inappropriately depicting minors; depicting people without permission (consent needed for any submitted likeness or voice); non-consensual
  intimate imagery; removing provenance marks. Politics, violence, weapons, drugs, swimwear and celebrities by name: not addressed.
- Underlying models (Nano Banana, Seedream, Kling and others) keep their own safety systems; rules "may vary depending on the specific model".
- Refusal: terminal status `nsfw` ("input or output was rejected by content moderation"); `nsfw` and `failed` are not charged.
- Its own advice for false positives (swimwear or revealing clothing, athletic or fitness content, medical or anatomical imagery): neutral and
  specific wording, a descriptive prompt with an image, a different reference image, or a different model.

## Open items
- BytePlus AUP and video terms bodies, Kling code 1300's exact meaning, Google's `finishReason`/`blockReason` values, and Higgsfield's per-model rules
  were not retrieved. Re-read before production and record the dates here.
