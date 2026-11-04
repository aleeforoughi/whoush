# Whoush Professional Creative Skills v1.1.0

**Status (P2):** all 22 skills (15 base in `lib/skills.ts` + 7 in `lib/advanced-skills.ts`) now drive a private, typed orchestration layer used by `/api/agent`: `lib/orchestrator.ts` (safety -> `preparePrivateCreativeRequest` -> planner -> invariants -> plan inspection -> proposal), `lib/creative-plan.ts` (zod contracts, public projection), `lib/private-audit.ts` (hash-only audit) and `lib/llm-anthropic.ts` (live adapter). Live planning is off by default and fail-closed (`llmPolicy` in `lib/llm.ts`: needs `LLM_PROVIDER_AUTHORIZED=true`, `ALLOW_LIVE_LLM=true`, a configured `claude-*` model id and key); otherwise a deterministic, no-network planner is used. Camera/shot fields are proposed creative direction, not EXIF or verified provider controls. The registry version is `SKILL_REGISTRY_VERSION` in `lib/skills.ts`.
Owner requirements: permanent knowledge modules for auto-routed *private* LLMs; all creative output belongs to Higgsfield media models, never to the reasoning LLM. Users do not choose or see reasoning model names.
Skills source of truth: `lib/skills.ts`. Safety: `lib/safety.ts`, `docs/MODERATION_POLICY.md`.
This is a reusable skill instruction library, not retrained model weights or a searchable retrieval database. The latter must be implemented separately for reference-heavy knowledge and trends.

## Mandatory foundation on every creative turn
- `prompt_engineer`: structure intent, preserve hard/soft constraints, optimize prompts for capabilities.
- `creative_director`: coherent art direction, creative consistency, audience fit.
- `persian_language`: accurate Persian reading/writing, dialect and register, RTL and bilingual text. Listening/speaking only when actual supported audio inputs and outputs exist.
- `qa`: pre-plan and post-generation checks; no claiming actual quality without inspecting rendered assets.

## Conditional routing (all selected automatically)
| Trigger | Skill IDs | Concrete contribution |
|---|---|---|
| Any new image | `photographer` | Camera/lens distance, f-stop, shutter, ISO, WB, DOF, framing, light ratios and direction, shadows, realistic textures |
| Any video | `cinematographer`, `videographer` | Camera path, shot size, lens, motion, shutter angle/FPS target, lighting continuity, physical realism and duration |
| Image edit or local replacement | `photo_editor` | Masks, localized retouch, shadow consistency, preserve original face/body/framing/color except edits requested |
| Video edit, trim, masks | `video_editor` | Preserve FPS, PTS, cut timing, original motion/audio, edges, transparency, blur and grade |
| Audio reference or sound brief | `audiographer` | Sound direction, audio sync, ambiance, capture technique. No unapproved audio generation |
| Logo, poster, banner, typography | `visual_designer` | Grids, typographic hierarchy, Persian font suitability, color harmony, text QA |
| Tagline, caption, copy | `creative_copywriter` | Advertising hook, authentic local slang, proofread Farsi, brand tone |
| Instagram, TikTok, X, Reels, trends | `social_media` | Platform formats, hooks, captions, safe areas; current trend claims require dated verified data |
| Iranian customs, everyday life, heritage | `iranian_culture` | Specific, respectful culture, modern/traditional trends and imagery |
| Named Iran places, poetry, dialects, nonpolitical celebrities | `iranian_geography` | Landmark details, real city context, local phrases, attribution, culturally plausible looks |

## Always-on photography rule
If user asks for a NEW still image, the internal planning prompt must provide a proposed:
- camera/look and lens focal length; camera distance and perspective;
- f-stop/aperture, shutter speed, ISO, white balance, focal plane, depth of field;
- framing, subject placement, aspect ratio and horizon;
- key, fill, back/rim and practical light directions, qualities, reflections/shadows;
- mood/color pipeline, subject realism and final output QA.
These are **creative directions**, not actual captured EXIF, and not guaranteed controllable knobs for Higgsfield. The agent maps controllable parameters only after checking the selected provider model's actual documented schema.

For INPUT image edit, preserving the source **overrides** invented photographic settings. Do not rewrite original lighting, camera geometry, face, hair, pose or motion without explicit consent.

## Always-on video rule
Any video task gets cinematography and videography. Establish shot scale, lens character, movement trajectory, motivated blocking, exposure, WB, target FPS/shutter, blur, duration, cuts, source references and color continuity. If editing video, use additional video-editor skill and protect source PTS/FPS, audio, camera, framing and foreground edges as requested.

## Source of truth / trend retrieval
Do not treat static training as live Instagram/TikTok/X trends. The social skill may request a licensed retrieval connector/search with timestamps; if none available, present evergreen platform conventions without saying they are current. Validate geography, idioms, translations, poem sources and celebrity/nonpolitical identity references. Respect artist rights and consent.

## Quality gates
- Before LLM: safety decision, account/media eligibility, model budget, reference ownership. Reject blocked and hold for review on ambiguous.
- Before generation: typed action and explicit supported media model, exact input IDs, source locks, whole-Neuron SKU, user quote approval.
- After generation: objective metadata checks, relevant visual QA, text verification, user acceptance.
- Retain skill registry version and selected IDs **privately** per job for QA and reproducibility. Do not expose LLM vendor/provider or internal token pricing.

## Efficient LLM use
Haiku-tier private reasoning for brief triage / simple tool classification, Sonnet-tier for everyday creative planning, Opus-tier for complex identity/temporal plans and multi-shot creative direction, with private configurable routing based on budget and capability. These are suggestions for *reasoning tier* not hard-coded public provider product names. Do not use expensive multi-agent debate per prompt. Escalate only based on uncertainty or validation failure; deterministic systems own payment, moderation hard rules and authorization.

## Test fixtures
Use `tests/skills-safety.test.ts` and expand with 100+ representative Persian prompts, including spelling variants, slang, ambiguous words, code-switching, fashion, local traditions, photography, masking, celebrity names and culturally specific references. Unit tests check instruction activation; separately evaluate live LLM planning outputs against camera/cultural/technical rubrics before launch.

## Plan language
Customer-visible plan fields (summary, constraints, camera/shot descriptions, continuity, identity lock lists, speech notes, QA checklist) are natural Persian in both the deterministic planner and the live planner instructions. `mediaPrompt` and `negative` are provider-facing, private and English.

## Attachments
Users can attach files to a chat message (`lib/attachments.ts`, `lib/attachment-files.ts`, `components/attachment-tray.tsx`). Limits: 10 files and 200 MB per message; image 20 MB (JPEG, PNG, WebP), video 100 MB (MP4, MOV, WebM), audio 25 MB (MP3, WAV, M4A, OGG, WebM), PDF 20 MB, JSON 1 MB, Markdown 1 MB.

**Verification.** The browser decides what a file is from its leading bytes (magic numbers), never from its name or declared type. A declared type or extension that disagrees with the bytes, SVG, HTML, executables and empty files are rejected with a Persian reason. JSON and Markdown must be valid UTF-8, and JSON must parse. The server re-validates the metadata with a strict schema (`AttachmentSchema` in `lib/creative-plan.ts`), but it never sees the bytes, so the byte check is a user-experience and consistency gate, not a security boundary.

**Tags and mentions.** Every attachment gets a stable tag for the conversation. Internally (wire, schema, audit, the live planner's `<attachment tag="image1" …>` blocks) it stays English: `image1…` (images), `video1…`, `audio1…`, `file1…` (PDF, JSON, Markdown); the wire pattern is `/^(image|video|audio|file)[1-9]\d?$/` (1 to 99 per prefix). Users always see and type the Persian form with a `#` prefix, an ASCII hyphen and Persian digits (`displayTag`):

| Kind | Internal tag | Shown and inserted |
|---|---|---|
| image | `image1` | `#تصویر-۱` |
| video | `video1` | `#ویدیو-۱` |
| audio | `audio1` | `#صدا-۱` |
| pdf, json, md | `file1` | `#فایل-۱` |

Numbers only count up (`allocateTag`), are never reused after a removal, and "new chat" starts again. The schema requires the prefix to match the kind and the tags of a request to be unique.

Parsing (`parseMentions`, `splitMentions`, `rewriteMentions`) is case and script tolerant: the prefix is `#` or `@`; the word is تصویر, ویدیو (or ویدئو), صدا, فایل or the legacy English `image|video|audio|file`; an optional hyphen (also U+2010, U+2011, U+2013, U+2212, or a ZWNJ or nothing at all) follows the word; the number is 1 to 99 in Persian, Arabic-Indic or ASCII digits, so `#صدا-۱`, `#صدا۱`, `#صدا1`, `@image1` and `@image-1` are the same mention. Arabic ي/ى and ك are read as ی and ک, and ZWNJ or tatweel inside the token is ignored. A mention must start the text or follow whitespace or punctuation, and must not be followed by a letter or digit, so `#تصویر-۱،`, `#صدا1` and `@image1` match, while `#نوروز`, `email@image1.com`, `#تصویر-۱۲۳` and `#تصویر-۰` do not. Every accepted spelling names the same internal tag.

In the composer, chips show the tag as `#تصویر-۱` (click it to insert it at the caret). Typing `#` (or `@`) at the start of the text or after whitespace opens a combobox of every attachment still in the conversation (this message's tray plus earlier sent ones); it filters by the Persian or English word with either digit set (`#تص`, `#صدا`, `#صدا-`, `#im`), and choosing an option writes the canonical `#تصویر-۱ `. An ordinary hashtag such as `#نوروز` is not the start of any tag word, so the list closes (`mentionTrigger`). In a sent message each mention is a Badge showing the Persian tag, and a tag that names an attachment opens its preview (image, video) or details. Per-chip errors, aria-labels, the plan «مراجع» list (formatted on the client from the public `references[].tag`) and the missing-mention question all use the Persian form. The request carries this message's new attachments plus any earlier sent attachment mentioned in the text in any accepted spelling (the same wire metadata and excerpt as when it was first sent, never bytes), within the 10 file and 200 MB limits. A mentioned tag with no attachment never blocks: the plan gets a Persian `clarifyingQuestionFa` such as «پیوست #تصویر-۳ در این گفت‌وگو پیدا نشد؛ …». In the English `mediaPrompt` each mention, however it was typed, becomes a description such as `[reference image 1 · character]` or `[motion reference video 1]`; the public Persian text keeps what the user typed, and the role lines in the plan name the attachment as `#تصویر-۱`.

**Roles are optional.** Choosing a role (نقش) for an image, video or audio is never required, and neither is using a `#` mention. Each chip's role Select starts at «انتخاب خودکار هووش» (Whoush picks automatically) and the user can switch back to it after choosing one. Nothing blocks sending: there is no role or consent check in the UI. Files have no role. The wire uses the English id (the schema makes `role` optional for media and rejects `general`); the UI uses the Persian label. A role the user chooses is recorded with `roleSource: "user"`.

**The + menu.** Inside the prompt field, at the inline-start edge (right in RTL), a `+` button («افزودن پیوست یا مرجع») opens a Notion-style insert menu (Feather `DropdownMenu`, anchored to the button, opens upwards, scrolls within about 60dvh, keyboard navigable, Escape returns focus to `+`). The inline-end edge has the icon-only send button; Ctrl/Cmd+Enter also sends (not while the `#` mention list is open). Above the field sits the chip tray; the selected-character chip (with an edit link and a clear button) is in the panel header; under the field sit two outline pills, the build mode and «سبک». The menu is the pure data in `lib/insert-menu.ts` (`INSERT_MENU`), built from the role table below, so every UI role appears exactly once in its kind group (plus the «پرکاربردترین» shortcuts), in this order:

- **پرکاربردترین** (first, so no scrolling is needed): آپلود با نقش خودکار (any file; no role is sent and inference applies)، کاراکتر، فریم اول، ادیت عکس، لباس و کفش، الگوی گفتار. These shortcuts repeat entries of the groups below with the same action (`POPULAR_IDS` in `lib/insert-menu.ts`);
- **تصویر**: کاراکتر، کاراکترهای من (opens a dialog of the saved characters with the same usability rules, disabled reasons and an empty state linking to `/characters`; choosing sets `characterRef`, the chip, `?character=` and `sessionStorage` `whoush-character`), فریم اول، فریم آخر، محیط، اشیا، لباس و کفش، پیرایش، آرایش، لوگو و گرافیک، ادیت عکس;
- **ویدیو**: الگوی حرکت، ادیت ویدیو، امتداد ویدیو;
- **صدا**: الگوی گفتار، موزیک;
- **فایل**: فایل (PDF, JSON or Markdown, as context).

**Upload cards.** Picking any upload entry (everything except «کاراکترهای من») does not open the file picker directly: it adds an empty upload card **inside the prompt field**, above the text, and moves keyboard focus to its upload button (`lib/upload-slots.ts`, `components/upload-slot.tsx`). The card is an empty state: transparent, a faint dashed border, and the entry's icon and Persian title in muted text. Its one strong element is a full-width, icon-only upload button (the upload icon, no visible text; neutral secondary fill with a solid 3:1 border; never the blue primary, which belongs to send; accessible name «آپلود کاراکتر») that opens the picker for that kind, single file. Under it, «یا فایل رو اینجا رها کن»: a file dropped anywhere on the card fills it. An accepted file becomes the normal chip in the tray with the card's role (the automatic card sends no role) and the card goes away; a file of the wrong kind is rejected with «این گزینه فقط تصویر می‌پذیرد» and the card stays for another try. The × button («حذف کارت لباس و کفش») removes an empty card and returns focus to the prompt. Cards plus attached files never exceed 10 per message; empty cards hold no file and are dropped on send, new chat and project switch. Cards use the 8px control radius (they sit inside the 8px field). Measured: upload icon 12.9:1 light and 15.7:1 dark, button border 3.2:1 and 3.3:1, title and hint at least 5.97:1; the dashed card border is deliberately faint (decorative, 1.2-1.6:1), since the button carries the affordance.

**Style (`style`).** Under the field, beside the build mode, an outline pill «سبک» shows only the current style («سبک: خودکار» by default) and opens a radio menu: خودکار («هووش سبک را از متن تشخیص می‌دهد»)، واقع‌گرایانه («مثل عکس واقعی، بافت و نور طبیعی»)، سه‌بعدی («رندر سه‌بعدی تمیز»)، کارتونی («کارتونی و رنگی») (`lib/style-setting.ts`, `components/style-control.tsx`). It is a setting, remembered in `localStorage` key `whoush-style`; خودکار sends no `style`. `CreativeTurnInputSchema` accepts `style?: "realistic"|"three_d"|"cartoon"`. It wins over `visualStyle` and over style words in the text (with neither set, the text detection of «انیمه», «کارتونی»… is unchanged): `realistic` is `photoreal` (`hyper_realism` on) with the soft preference «سبک واقع‌گرایانه: بافت، نور و رنگ طبیعی»; `three_d` and `cartoon` are `stylized` (`hyper_realism` off) with the directives «رندر سه‌بعدی تمیز با متریال فیزیکی، نور نرم و سایهٔ طبیعی؛ بدون بافت پوست عکاسی یا نویز» and «سبک کارتونی: خطوط تمیز، فرم‌های ساده و پالت رنگی هماهنگ» (English in the provider prompt: `3D render style: physically based materials, soft global illumination, clean shading`, `cartoon style: clean outlines, simplified shapes, harmonious vivid palette`). With a character reference (Character Studio or a `character` image) and `three_d` or `cartoon`, the constraint «هویت کاراکتر در سبک انتخاب‌شده قابل تشخیص می‌ماند» is added. A planner that drops these lines gets them back (audit correction `style_directives`). The public plan carries `style` and plan details show «سبک انتخاب‌شده»; the audit records it.

**Build mode.** Under the field, an outline pill «حالت ساخت» shows only the selected mode and opens a radio menu (اقتصادی · سریع · با کیفیت). Each mode is outlined in its own color, text, icon and border alike (اقتصادی green/success with coins, سریع orange/warning with a bolt, با کیفیت blue/info with a gauge), never filled, so the send button stays the only filled control. The light brand tokens darken success (#1E7D46) and warning (#C2410C) and info (#2A6CB8) so all three pass AA as text on the background and the card surface. It sends `preference` `cost`, `speed` or `quality` (default) with every `/api/agent` request (`lib/mode.ts`, `components/mode-control.tsx`). It is remembered in `localStorage` key `whoush-mode` (read with `useSyncExternalStore`, errors ignored). Changing it while a proposal is on screen does not change that proposal; a hint says the new mode applies from the next message.

Each role entry opens one hidden multi-file input restricted to that kind's accept list (`acceptFor`); every file picked that way gets the entry's role with `roleSource: "user"`, and a file whose real type (magic bytes) is another kind is rejected with a Persian reason. The count, size, sniffing and error rules are unchanged. The chip's role Select (including «انتخاب خودکار هووش») remains the only place to change a role afterwards; drag-and-drop onto the panel and paste add files with an automatic role. Voice cloning is not offered anywhere in the UI; the server still refuses it (below).

**Inference (`inferAttachmentRoles`).** Without a chosen role the orchestrator guesses one from the words of the brief, before skills resolve, and records `roleSource: "inferred"`. It uses words only: no image, video or audio is analyzed, and none can be until the media-inspection step exists. The context is the clause around the attachment's mention in any accepted spelling (clauses end at `. ، , ؛ ; ? !` and newlines; when two mentions share a clause, the words between them are split between the two, the earlier mention keeping the first half), or the whole text when the attachment is not mentioned. The text is normalized with `normalizePersian`; Persian and English keywords match as whole words (a Persian keyword may take a plural or possessive suffix such as ـی, ـها, ـام). The first matching group wins, in this order:

| Kind | Order (first match wins) | Persian keywords (English keywords alongside) |
|---|---|---|
| image | `edit_reference` | ویرایش، ادیت، حذف کن، پاک کن، جایگزین، عوض کن، تغییر بده، رتوش |
| | `end_frame` | فریم آخر، آخر ویدیو، تهش، پایان ویدیو، ختم بشه به، برسه، برسد، تمام بشه (end frame, last frame, ending) |
| | `start_frame` | شروع کن، شروع از، شروع بشه، متحرکش کن، زنده‌اش کن، جون بده، انیمیت، متحرک کن، تبدیل به ویدیو (animate, bring to life, make it move, start from) |
| | `outfit` | لباس، مانتو، کت، شلوار، پیراهن، دامن، کفش، پوشش، ست لباس، استایل لباس (outfit, dress, clothes, wardrobe) |
| | `hairstyle` | مدل مو، مو، رنگ مو، کوتاهی مو، ریش، سبیل، فرم ریش، پیرایش، اصلاح (hairstyle, haircut, hair, beard, moustache, grooming) |
| | `makeup` | آرایش، میکاپ، رژ، رژ لب، سایه چشم، خط چشم، ریمل، ابرو (makeup, lipstick, eyebrow) |
| | `character` | کاراکتر، شخصیت، چهره، صورت، پرتره، این آدم، این فرد، خودم |
| | `graphic` | لوگو، پوستر، گرافیک، تایپوگرافی، فونت، متن روی، بنر |
| | `object` | محصول، شیء، اشیا، کالا، کیف، بطری |
| | `environment` | محیط، فضا، مکان، لوکیشن، پس‌زمینه، اتاق، خیابان، منظره |
| | else `general` | |
| video | `edit_reference`, then `continue` (امتداد، ادامه بده، ادامهٔ ویدیو، طولانی‌ترش کن، ادامه‌اش; extend, continue), then `motion_reference` (حرکت، رقص، الگوی حرکت، کپی حرکت، مثل این حرکت), else `general` | edit words as for images |
| audio | `lip_sync` (لب، لیپ سینک، لیپ‌سینک، دیالوگ، گفتار، صحبت، حرف بزند), then `music` (موسیقی، موزیک، آهنگ، ریتم، بیت، ملودی), else `general` | |

A phrase such as «آرایش این عکس روی چهره‌ام» resolves to `makeup`, not `character`, because the beauty roles are checked first; with two mentions in one clause (`از #تصویر-۱ شروع کن و به #تصویر-۲ برسه`) the words between them are split, giving `start_frame` and `end_frame`. Cosmetic colors such as «آرایش نود» are allowed by the safety preflight.

`voice_clone` is never inferred and is not offered in the UI. `general` is an internal role only: it is not in the UI Select and the wire schema rejects it. For an inferred `lip_sync`, the speech language and accent default to `unknown` and `unspecified`, so the Tehrani skill never activates from inference alone. Inferred roles drive exactly the same skills, constraints, kind override and requirements as chosen ones. The public plan marks them: `references[].roleSource` is `user` or `inferred`, and «مراجع» shows inferred ones with a suffix, e.g. `#تصویر-۱ · کاراکتر (انتخاب هووش)`.

| Kind | Role id | Persian label · hint | Effect |
|---|---|---|---|
| image | `character` | کاراکتر · چهره و هویت ثابت می‌مونه | `character_creation` (+ `anti_drift`, always on); hard constraint to keep face identity, hair, skin tone and body proportions; +1 reference image |
| image | `start_frame` | فریم اول · همین عکس متحرک می‌شه | output is a video (image-to-video); hard constraint «#تصویر-N فریم اول ویدیوست؛ ترکیب‌بندی، سوژه و نور همین عکس نقطهٔ شروع است»; prompt text `[start frame image N]`; requirement `startImage`; +1 reference image |
| image | `end_frame` | فریم آخر · ویدیو به همین عکس ختم می‌شه | output is a video; hard constraint «#تصویر-N فریم آخر ویدیوست؛ ویدیو با همین ترکیب‌بندی، سوژه و نور تمام می‌شود»; `[end frame image N]`; requirement `endImage`; +1 reference image |
| image | `environment` | محیط · فضا، پس‌زمینه و نور | continuity locks for place, architecture, light direction and time of day; culture and geography skills only when the text triggers them; +1 reference image |
| image | `object` | اشیا · شیء، محصول یا اکسسوری دقیق می‌مونه | hard constraint for shape, material, color, proportions and logo placement; +1 reference image |
| image | `outfit` | لباس و کفش · لباس، کفش و استایل پوشش روی سوژه | hard constraint «لباس و کفش #تصویر-N (طرح، رنگ، جنس و برش) روی سوژه اعمال می‌شود؛ چهره و بدن مدلِ عکس مرجع کپی نمی‌شود» and soft preference «پوشش مطابق سیاست محتوای هووش، پوشیده و غیرتحریک‌آمیز» (the moderation policy bans revealing outfits; media still fails closed); `[outfit reference image N]`; +1 reference image |
| image | `hairstyle` | پیرایش · مدل مو و فرم ریش | hair style and grooming, beard and moustache shape (not eyebrows); hard constraint «مدل مو و فرم ریش و سبیل #تصویر-N (در صورت وجود) اعمال می‌شود؛ چهره، رنگ پوست و هویت سوژه تغییر نمی‌کند»; `[hairstyle and beard reference image N]`; +1 reference image |
| image | `makeup` | آرایش · آرایش صورت با همین رنگ‌ها | hard constraint «آرایش #تصویر-N (رنگ‌ها و شدت) اعمال می‌شود؛ بافت طبیعی پوست حفظ می‌شود و پوست پلاستیکی یا صاف‌شده نمی‌شود»; `[makeup reference image N]`; +1 reference image |
| image | `graphic` | لوگو و گرافیک · لوگو، متن یا طرح بدون تغییر | `visual_designer`; hard constraint to use the graphic, logo or text without distortion, recolor or retyping; +1 reference image |
| image | `edit_reference` | ادیت عکس · فقط همون بخشی که می‌گی عوض می‌شه | task becomes `edit` (`photo_editor`); only the requested region changes, pixels, identity, framing and light are preserved; +1 reference image |
| video | `motion_reference` | الگوی حرکت · حرکت و ریتم این ویدیو با ظاهر جدید | output is a video; hard constraint to follow path, speed, timing and blocking but not the reference's appearance; requirement `motionReference` |
| video | `edit_reference` | ادیت ویدیو · همین ویدیو با تغییری که می‌خوای | output is a video, task `edit` (`video_editor`); preserve FPS, frame count, cuts, audio, framing and grade except the requested change; requirement `videoReference` |
| video | `continue` | امتداد ویدیو · از آخر همین ویدیو امتداد پیدا می‌کنه | output is a video; hard constraint «امتداد #ویدیو-N از آخرین فریم؛ سوژه، نور، حرکت دوربین و رنگ پیوسته می‌مانند»; `[video to continue N]`; requirement `videoContinuation`; continuity and `anti_teleport` (already on for video) |
| audio | `lip_sync` | الگوی گفتار · لب‌ها با این صدا هم‌زمان می‌شن | output is a video; implies speech; the language and accent controls exist only for this role (language defaults to «نامشخص», so the Tehrani skill never activates silently, only for Persian speech with no accent set, as before); `persian_lip_sync_phonetics`; requirement `lipSync` |
| audio | `music` | موزیک · ریتم کات‌ها با موزیک | `audiographer`; soft preference that beat, tempo and structure guide cut rhythm and motion timing; no music is generated or altered; no lip sync |
| files (pdf, json, md) | none | فایل · PDF، JSON یا Markdown برای زمینه | context only; text excerpts pass the safety preflight |
| image | `general` (internal, inferred only) | مرجع کلی | hard constraint «#تصویر-N به‌عنوان مرجع کلی سبک و ترکیب‌بندی استفاده می‌شود؛ هویت یا جزئیات آن کپی نمی‌شود مگر خواسته شود»; +1 reference image |
| video | `general` (internal, inferred only) | مرجع کلی | output is a video (a video attachment); soft preference that it is a general visual reference, not copied; no extra skill |
| audio | `general` (internal, inferred only) | مرجع کلی | `audiographer` only: a sound-mood reference, no lip sync, no Tehrani, nothing generated or imitated |
| audio | `voice_clone` (API only, not in the UI) | کلون صدا | the schema rejects it without `consent: true`; with it the turn is `unsupported` (see below). Kept so API clients cannot sneak it through |

If the text sounds like an image request but there is a video attachment, or an audio with `lip_sync`, the media kind is video (a comment in `orchestrateCreativeTurn` says why). Role constraints are enforced by the plan invariants: a planner that drops one gets it added back (audit correction `role_directives`). The public plan has `references: [{tag, kind, role, roleSource, labelFa}]` (never ids, hashes or names), shown in plan details under «مراجع».

**What is sent** with the request: per file an id, tag, kind, mime, size, sha256, optional pixel size or duration, the role (media only, optional), `consent: true` for `voice_clone` (API clients only; the UI never sends it), the speech details (language, accent) for `lip_sync` only and, for Markdown and JSON only, a text excerpt of up to 8000 characters. **What is not sent:** file bytes and file names (the schema rejects a `name`). Files stay in browser memory for the session; nothing is stored or uploaded.

**How the server uses them.** Excerpts are run through the safety preflight like the prompt (a blocked excerpt restricts the turn before any planner runs). They reach the private planner only inside `<attachment>` blocks within `<user_brief>`, with forged tags stripped: media and PDFs as `<attachment tag="image1" kind="image" role="character"/>` (no content), Markdown and JSON with their excerpt. The blocks carry `role` and `role_source` (`user` or `inferred`). The skill instructions mark all of it as untrusted data, say that tags name the user's files and that roles are hard constraints, and that an inferred role is a best guess the planner may refine only in hard constraints and never escalate to `voice_clone`. The private audit keeps only `{tag, role, roleSource, kind, bytes, sha256}`.

**Order of outcomes.** (1) Safety on the text and excerpts. (2) Plan and plan inspection. (3) Any `voice_clone` attachment returns status `unsupported` with «کلون صدا در هووش پشتیبانی نمی‌شود؛ هووش فقط تصویر و ویدیو می‌سازد و تولید یا شبیه‌سازی صدا ممکن نیست.» (HTTP 422), audit reason `voice_clone_unsupported`, no price. (4) Else any image, video or audio attachment fails closed: the plan is returned with `no_compatible_model` (HTTP 422), no proposal and no price, audit reason `media_review_unavailable`, because no image, video or audio inspector exists yet (`docs/MODERATION_POLICY.md` steps 4 and 6). (5) Else the proposal; files-only turns stay `planned` with a price.

**Model suggestions (P5).** On outcome (4) and on `no_compatible_model`, `mediaRequirements` also names a specialised `operation` from the roles (a `lip_sync` audio is `lip_sync`; an `edit_reference` video with a `character` or `object` image is `replace`; a `motion_reference` video with an image that is not a `graphic` is `motion_transfer`). When the catalogue has a model for it, the result carries `suggestedModel: {name, active:false, blockersFa}` (raw name only: Intone or Genjutsu) and the Persian message ends with «مدل مناسب این کار: <name>؛ پس از تأیید فعال می‌شود.». It is never a proposal: no price and nothing to approve, and the UI shows it with a «به‌زودی» badge. Voice cloning, `start_frame`, `end_frame`, `continue`, `outfit`, `hairstyle` and `makeup` get none.

**Capability flags (unverified).** `motionReference`, `videoReference`, `startImage`, `endImage` and `videoContinuation` are model capabilities and requirements (`lib/catalog.ts`, `lib/router.ts`). No model has evidence for them (the agent-catalogue entries for Intone and Genjutsu do not claim them either), so every model records `false` and can never satisfy them; they are for when the media-review stop is lifted. Reference-image requirements already count every attached image.

**PDF.** PDFs are accepted and counted, but their text is not extracted (no parser dependency yet); the plan states that the PDF has no effect.
