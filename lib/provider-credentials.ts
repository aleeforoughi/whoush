import type {MediaProviderId} from "./types";
/**
 * The server-only environment variables that hold each provider's credentials (set in the git-ignored .env.local; never in code, logs or responses).
 * Kling signs a short-lived token from an access key and a secret key, so both must be present.
 */
export const PROVIDER_CREDENTIAL_ENV:Readonly<Record<MediaProviderId,readonly string[]>>={
 higgsfield:["HIGGSFIELD_API_KEY"],
 google:["GEMINI_API_KEY"],
 byteplus:["BYTEPLUS_API_KEY"],
 kling:["KLING_ACCESS_KEY","KLING_SECRET_KEY"]
};
/** Whether every credential a provider needs is set. Says nothing about the values. */
export const hasProviderCredentials=(p:MediaProviderId)=>PROVIDER_CREDENTIAL_ENV[p].every(k=>Boolean(process.env[k]));
