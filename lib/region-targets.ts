/** Shared by the studio and the server (no client or server directive). */
/**
 * What a region is, when the editor knows (owner, 2026-11-08: semantic region referencing): a face part found by the wand or matched to Whoush's own
 * marks. The edit prompt names the region by it («Region 01 (red): the lips»), so the model edits that whole element, not a coloured patch.
 */
export const REGION_TARGETS=["face skin","lips","inside of the mouth","eye","eyes","iris","irises","eyebrow","eyebrows","nose","ear","hair","neck and skin","all visible skin"] as const;
export type RegionTarget=typeof REGION_TARGETS[number];
/** A face part (lib/face-parts.ts) as a region target. */
export const TARGET_OF_PART:Record<string,RegionTarget>={skin:"face skin",lips:"lips",mouth:"inside of the mouth",left_eye:"eye",right_eye:"eye",eyes:"eyes",left_iris:"iris",right_iris:"iris",irises:"irises",
 left_brow:"eyebrow",right_brow:"eyebrow",brows:"eyebrows",nose:"nose",ear:"ear",hair:"hair",neck:"neck and skin",all_skin:"all visible skin"};
/** The face or body part a marked area is, named by the vision step (lib/reference-inspect.ts), so the editor takes that exact part. */
export const EDIT_PARTS=["lips","eyes","irises","eyebrows","nose","face skin","all skin","hair","neck"] as const;
export type EditPart=typeof EDIT_PARTS[number];
