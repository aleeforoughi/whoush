export type LedgerKind="purchase"|"reserve"|"settle"|"release"|"refund";
export type LedgerEvent={id:string;walletId:string;transactionId:string;kind:LedgerKind;neurons:number};
export function assertNeuron(n:number):void{if(!Number.isSafeInteger(n)||n<0)throw new Error("Neuron values must be nonnegative safe integers");}
export function availableBalance(events:readonly LedgerEvent[]):number{
 let balance=0;
 const keys=new Set<string>();
 for(const e of events){
  assertNeuron(e.neurons);
  if(keys.has(e.id)) throw new Error("Duplicate ledger event ID");
  keys.add(e.id);
  // reserve debits available balance; settle finalizes an existing reservation (no second debit); release/refund credit back.
  if(e.kind!=="settle")balance+=e.kind==="purchase"||e.kind==="release"||e.kind==="refund"?e.neurons:-e.neurons;
  if(!Number.isSafeInteger(balance)||balance<0)throw new Error("Insufficient or invalid balance");
 }
 return balance;
}
export type Reservation={id:string;walletId:string;neurons:number;state:"reserved"|"settled"|"released"};
/** Reservation state machine: reserved -> settled | released, each exactly once. In-memory only. */
export class ReservationLedger{
 private readonly m=new Map<string,Reservation>();
 constructor(private readonly available?:(walletId:string)=>number){}
 reserve(id:string,walletId:string,neurons:number):Reservation{
  assertNeuron(neurons);if(neurons<=0)throw new Error("Reservation must be positive");
  const ex=this.m.get(id);
  if(ex){if(ex.walletId!==walletId||ex.neurons!==neurons)throw new Error("Reservation ID reused with different values");return {...ex};}
  if(this.available&&this.available(walletId)-this.heldBy(walletId)<neurons)throw new Error("Insufficient balance");
  const r:Reservation={id,walletId,neurons,state:"reserved"};this.m.set(id,r);return {...r};
 }
 /** Returns true only on the transition; repeated calls are no-ops. Settling a released reservation (or vice versa) throws. */
 settle(id:string):boolean{return this.finish(id,"settled");}
 release(id:string):boolean{return this.finish(id,"released");}
 get(id:string):Reservation|undefined{const r=this.m.get(id);return r&&{...r};}
 count():number{return this.m.size;}
 private heldBy(w:string){let n=0;for(const r of this.m.values())if(r.walletId===w&&r.state==="reserved")n+=r.neurons;return n;}
 private finish(id:string,to:"settled"|"released"):boolean{
  const r=this.m.get(id);if(!r)throw new Error("Unknown reservation");
  if(r.state===to)return false;
  if(r.state!=="reserved")throw new Error("Reservation already "+r.state);
  r.state=to;return true;
 }
}
// Production ledger must be database-backed, transactional and concurrency-safe;
// a local in-memory calculation is NOT a payment or reservation system.
