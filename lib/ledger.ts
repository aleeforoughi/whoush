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
  balance+=e.kind==="purchase"||e.kind==="release"||e.kind==="refund"?e.neurons:-e.neurons;
  if(!Number.isSafeInteger(balance)||balance<0)throw new Error("Insufficient or invalid balance");
 }
 return balance;
}
// Production ledger must be database-backed, transactional and concurrency-safe;
// a local in-memory calculation is NOT a payment or reservation system.
