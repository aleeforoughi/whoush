/** What Enter does in the chat composer (kept pure so it is testable without a browser). */
export type EnterKey={key:string;shiftKey:boolean;ctrlKey:boolean;metaKey:boolean;altKey:boolean;isComposing:boolean};

/**
 * `send` or `newline` for an Enter press in the composer, or null for any other key. Enter sends; Shift+Enter (or Alt+Enter) starts a new line;
 * Ctrl/Cmd+Enter always sends. While an input method is composing (Persian or other IME), Enter belongs to the IME. On a touch-only device, whose
 * keyboard has no Shift, Enter starts a new line and the send button sends.
 */
export function enterAction(e:EnterKey,touchOnly:boolean):"send"|"newline"|null{
 if(e.key!=="Enter"||e.isComposing)return null;
 if(e.ctrlKey||e.metaKey)return "send";
 if(e.shiftKey||e.altKey||touchOnly)return "newline";
 return "send";
}
/** A device whose only pointer is a finger (a phone or tablet keyboard): there Enter adds a line. */
export const isTouchOnly=()=>typeof window!=="undefined"&&window.matchMedia("(hover: none) and (pointer: coarse)").matches;
