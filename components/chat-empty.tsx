/**
 * The empty chat (owner, 2026-11-07): the welcome line and its subtitle with a flat, outline-only illustration, neutral, centred in the chat area. It is
 * the empty view only: it goes away when the first message is sent, and nothing of it stays fixed on top.
 */
export const EMPTY_TITLE_FA="هر چی دل تنگت می‌خواهد بساز.";
export const EMPTY_SUBTITLE_FA="چت کن، وویس بده، ایدتو بگو، هیچ مهارتی لازم نیست. عکس یا ویدیویی نیست که من نتونم بسازم. برو که بریم!";

/**
 * A photo frame, a video frame and a chat bubble, outline only (one stroke width, round joins), in the current text colour. A gentle loop (owner,
 * 2026-11-08: "an animated vector loop for more engagement"): the frames float slowly out of step, the chat's lines write themselves, the sun glows and the
 * sparkles twinkle (app/globals.css, `whoush-empty-*`). Still with reduced motion.
 */
function EmptyIllustration({className}:{className?:string}){
 return <svg viewBox="0 0 200 110" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={"whoush-empty "+(className??"")}>
  {/* the photo: a frame with hills and a sun */}
  <g className="whoush-empty-float">
   <rect x="58" y="22" width="84" height="64" rx="8"/>
   <circle cx="120" cy="40" r="6" className="whoush-empty-glow"/>
   <path d="M64 78 88 54l16 16 10-10 22 18"/>
  </g>
  {/* the video: a smaller frame beside it, with a play mark */}
  <g className="whoush-empty-float whoush-empty-late">
   <rect x="8" y="54" width="42" height="32" rx="6"/>
   <path d="M25 64v12l10-6z" className="whoush-empty-pulse"/>
  </g>
  {/* the chat bubble: the conversation that makes them, its lines writing themselves */}
  <g className="whoush-empty-float whoush-empty-later">
   <path d="M156 66h32a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6h-16l-9 8v-8h-7a6 6 0 0 1-6-6V72a6 6 0 0 1 6-6z"/>
   <path d="M160 77h24" pathLength={1} className="whoush-empty-write"/>
   <path d="M160 85h14" pathLength={1} className="whoush-empty-write whoush-empty-write-2"/>
  </g>
  {/* two sparkles */}
  <path d="M30 24v10M25 29h10" className="whoush-empty-twinkle"/>
  <path d="M172 30v8M168 34h8" className="whoush-empty-twinkle whoush-empty-late"/>
 </svg>;
}

export function ChatEmpty(){
 return <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
  <EmptyIllustration className="h-auto w-40 text-fg-tertiary"/>
  <div className="flex max-w-md flex-col gap-1.5">
   <h2 className="type-title text-fg-primary">{EMPTY_TITLE_FA}</h2>
   <p className="type-body-sm text-fg-secondary">{EMPTY_SUBTITLE_FA}</p>
  </div>
 </div>;
}
