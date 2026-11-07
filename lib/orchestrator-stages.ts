/** The real stages of a turn, in order: reading (preflight), planning (the planner), checking (plan inspection), researching (open-licensed references, only when the plan asks for research), pricing (model and price), reviewing (the pre-generation risk check, when it can run). Shared with the browser. */
export const TURN_STAGES=["reading","planning","checking","researching","pricing","reviewing"] as const;
export type TurnStage=(typeof TURN_STAGES)[number];
/** Detail lines for a stage: `story` while it runs (what Whoush is working out for this brief), `facts` from the turn (what it chose or found). */
export type TurnNote={stage:TurnStage;kind:"story"|"facts";lines:string[]};
