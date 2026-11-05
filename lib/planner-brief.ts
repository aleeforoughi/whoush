/** Pure, provider-neutral builder of the single planner user message. Shared by every private planner adapter. */
/** Removes brief, attachment and generation tags so user or document text cannot close or forge the data blocks it sits in. */
export function stripBriefTags(text:string):string{
 let s=text,prev;
 do{prev=s;s=s.replace(/<\/?\s*(?:attachment|generation|history|turn|reply_in|user_brief)\b[^>]*>?/gi,"");}while(s!==prev);
 return s;
}
export type BriefAttachment={tag?:string;kind:string;role?:string;roleSource?:string;textExcerpt?:string};
const SAFE_ID=/^[a-z0-9_]{1,32}$/;
export type BriefGeneration={tag:string;mediaKind:string;summaryFa:string};
/**
 * The single user message: the brief, then every attachment as data inside it (media and PDFs are tag, kind and role with role_source only, no content; md and json
 * carry their excerpt), then every earlier generation of the chat the brief refers to, as a `<generation>` block with the Persian summary of its plan.
 */
export type BriefTurn={role:"user"|"agent";text:string;gif?:true};
export function buildBriefMessage(userText:string,attachments:readonly BriefAttachment[]=[],generations:readonly BriefGeneration[]=[],history:readonly BriefTurn[]=[],replyScript?:"fa"|"finglish"):string{
 const docs=attachments.filter(a=>a.tag&&SAFE_ID.test(a.tag)).map(a=>{
  const attrs=" tag=\""+a.tag+"\" kind=\""+(SAFE_ID.test(a.kind)?a.kind:"file")+"\""+(a.role&&SAFE_ID.test(a.role)?" role=\""+a.role+"\""+(a.roleSource==="inferred"||a.roleSource==="user"?" role_source=\""+a.roleSource+"\"":""):"");
  return a.textExcerpt?"\n<attachment"+attrs+">\n"+stripBriefTags(a.textExcerpt)+"\n</attachment>":"\n<attachment"+attrs+"/>";
 }).join("");
 const gens=generations.filter(g=>/^generation[1-9]\d?$/.test(g.tag)).map(g=>"\n<generation tag=\""+g.tag+"\" kind=\""+(g.mediaKind==="video"?"video":"image")+"\">\n"+stripBriefTags(g.summaryFa)+"\n</generation>").join("");
 // Recent turns first (oldest to newest), so the current brief reads as the latest message.
 const hist=history.length?"<history>\n"+history.map(t=>"<turn role=\""+(t.role==="agent"?"whoush":"user")+"\""+(t.gif?" gif=\"true\"":"")+">"+stripBriefTags(t.text)+"</turn>").join("\n")+"\n</history>\n":"";
 // The script Whoush's reply must use, decided on the server from the brief (Finglish gets Latin letters only).
 const script=replyScript==="finglish"?"\n<reply_in>finglish: reply.text and clarifyingQuestionFa in Finglish, Latin letters only</reply_in>":"";
 return "<user_brief>\n"+hist+stripBriefTags(userText)+docs+gens+"\n</user_brief>"+script;
}
