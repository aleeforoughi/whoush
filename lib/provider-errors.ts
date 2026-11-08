export {NotCancelableError} from "./higgsfield";
/**
 * A submission whose outcome is unknown: the request may have reached the provider (a timeout, a dropped connection, a 5xx, an unreadable 2xx).
 * It is never treated as "not sent": the job keeps its reservation and is reconciled by resending the same request with the same idempotency key.
 */
export class SubmissionUnknownError extends Error{constructor(readonly reason:string){super("Submission outcome unknown: "+reason);this.name="SubmissionUnknownError";}}

/**
 * A media provider's own content moderation refused the request, from the codes each provider documents (docs/evidence/CONTENT_POLICIES.md, read
 * 2026-11-08): Google's error codes (safety, prohibited_content, blocklist, jailbreak, spii, recitation, image_safety, image_prohibited_content,
 * image_recitation, image_other, content_blocked); BytePlus `*SensitiveContentDetected*`; Kling 1300 and 1301 (policy or safety). Higgsfield reports a
 * refusal as its `nsfw` status instead. Read from the error's message, which every provider error carries ("<Provider> request failed: <status> <code>").
 */
export const CONTENT_REFUSAL=/\b(?:safety|prohibited_content|blocklist|jailbreak|spii|recitation|image_safety|image_prohibited_content|image_recitation|image_other|content_blocked)\b|SensitiveContentDetected|Kling request failed: \d+ 130[01]\b|blocked due to|content polic/i;
export const isContentRefusal=(e:unknown)=>e instanceof Error&&CONTENT_REFUSAL.test(e.message);
