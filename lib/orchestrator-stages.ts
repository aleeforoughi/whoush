/** The real stages of a turn, in order: reading (preflight), planning (the planner), checking (plan inspection), pricing (model and price). Shared with the browser. */
export const TURN_STAGES=["reading","planning","checking","pricing"] as const;
export type TurnStage=(typeof TURN_STAGES)[number];
