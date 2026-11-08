/** The direction of typed text from its first letter: Persian (or Arabic) right to left, Latin left to right; with no letter yet, `fallback`. */
export function textDir(text:string,fallback:"rtl"|"ltr"):"rtl"|"ltr"{
 const m=/[\p{Script=Arabic}\p{Script=Latin}]/u.exec(text);
 return !m?fallback:/\p{Script=Arabic}/u.test(m[0])?"rtl":"ltr";
}
