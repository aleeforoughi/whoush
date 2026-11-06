import type {MediaProviderId} from "./types";
/**
 * The server-only environment variables that hold each provider's credentials (set in the git-ignored .env.local; never in code, logs or responses).
 * Kling's current API takes one API key ("API Key (for all models)", docs/evidence/KLING.md); its older access-key/secret-key JWT is not used.
 */
export const PROVIDER_CREDENTIAL_ENV:Readonly<Record<MediaProviderId,readonly string[]>>={
 higgsfield:["HIGGSFIELD_API_KEY"],
 google:["GEMINI_API_KEY"],
 byteplus:["BYTEPLUS_API_KEY"],
 kling:["KLING_API_KEY"]
};
/** Whether every credential a provider needs is set. Says nothing about the values. */
export const hasProviderCredentials=(p:MediaProviderId)=>PROVIDER_CREDENTIAL_ENV[p].every(k=>Boolean(process.env[k]));
