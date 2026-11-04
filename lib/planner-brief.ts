/** Pure, provider-neutral builder of the single planner user message. Shared by every private planner adapter. */
/** Removes brief and attachment tags so user or document text cannot close or forge the data blocks it sits in. */
export function stripBriefTags(text:string):string{
 let s=text,prev;
 do{prev=s;s=s.replace(/<\/?\s*(?:attachment|user_brief)\b[^>]*>?/gi,"");}while(s!==prev);
 return s;
}
export type BriefAttachment={tag?:string;kind:string;role?:string;roleSource?:string;textExcerpt?:string};
const SAFE_ID=/^[a-z0-9_]{1,32}$/;
/** The single user message: the brief, then every attachment as data inside it. Media and PDFs are tag, kind and role (with role_source) only (no content); md and json carry their excerpt. */
export function buildBriefMessage(userText:string,attachments:readonly BriefAttachment[]=[]):string{
 const docs=attachments.filter(a=>a.tag&&SAFE_ID.test(a.tag)).map(a=>{
  const attrs=" tag=\""+a.tag+"\" kind=\""+(SAFE_ID.test(a.kind)?a.kind:"file")+"\""+(a.role&&SAFE_ID.test(a.role)?" role=\""+a.role+"\""+(a.roleSource==="inferred"||a.roleSource==="user"?" role_source=\""+a.roleSource+"\"":""):"");
  return a.textExcerpt?"\n<attachment"+attrs+">\n"+stripBriefTags(a.textExcerpt)+"\n</attachment>":"\n<attachment"+attrs+"/>";
 }).join("");
 return "<user_brief>\n"+stripBriefTags(userText)+docs+"\n</user_brief>";
}
