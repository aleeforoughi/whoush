# Drift awareness

**Status:** added 2026-11-08 at the owner's request ("Whoush shouldn't guess what it doesn't know"). Code: `lib/drift.ts`, with the check in `lib/orchestrator.ts`.

**What each photo shows:** the photo check at upload (the same vision call as the safety check and Beautify) records it for the main person:
- framing: face, head and shoulders, half body or full body;
- head angle: front, three-quarter, profile or back;
- whether the teeth show;
- whether the eyes are open.

The server keeps this with its record of the photo.

**What a request needs:** its words decide it.
- Another head angle: «نیم‌رخ», «از بغل», «سه‌رخ», «از پشت», "side view".
- The whole body: «تمام‌قد», «زوم‌اوت», «ایستاده», «راه میره», "full body", "walking".
- A smile with teeth: «بخنده», «لبخند», "smile", "teeth".
- Open eyes: when every photo has them closed and Whoush makes a new picture of the person. An edit keeps the photo's own eyes. A request that keeps them closed asks nothing.

**The check:** when nothing covers a need, Whoush asks once, before any planning.
- **What the user sees:** a friendly line saying what it can't know from these photos, the existing photo-request card with exactly the photos it needs, and «همین‌طوری بساز» for its best guess.
- **No second ask:** sending photos with «ادامه», or skipping, goes on without asking again.
- **Saved characters:** their angles count as coverage.
- **Exempt:** brush edits and «زیباسازی» are exempt, since they keep to what is visible.

**Tests:** `tests/drift.test.ts`. Not yet run live.
