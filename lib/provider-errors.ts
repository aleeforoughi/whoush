export {NotCancelableError} from "./higgsfield";
/**
 * A submission whose outcome is unknown: the request may have reached the provider (a timeout, a dropped connection, a 5xx, an unreadable 2xx).
 * It is never treated as "not sent": the job keeps its reservation and is reconciled by resending the same request with the same idempotency key.
 */
export class SubmissionUnknownError extends Error{constructor(readonly reason:string){super("Submission outcome unknown: "+reason);this.name="SubmissionUnknownError";}}
