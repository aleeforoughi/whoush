export const PACKAGE_TIERS = [
  { id:"starter", priceToman:2_000_000, bonusPercent:0 },
  { id:"plus", priceToman:5_000_000, bonusPercent:2 },
  { id:"creator", priceToman:10_000_000, bonusPercent:4 },
  { id:"pro", priceToman:20_000_000, bonusPercent:6 },
  { id:"studio", priceToman:50_000_000, bonusPercent:8 },
  { id:"agency", priceToman:100_000_000, bonusPercent:10 }
] as const;
export interface QuotedPackage { id:string; priceToman:number; bonusPercent:number; baseNeurons:number; giftNeurons:number; totalNeurons:number; }
const USD_MICROS=1_000_000n;
function asSafe(n:bigint): number { if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<0n) throw new RangeError("Integer overflow"); return Number(n); }
export function allocatePackage(priceToman:number,bonusPercent:number,fxTomanPerUSD:number,retailNeuronUsdMicros:number):QuotedPackage {
  for(const n of [priceToman,bonusPercent,fxTomanPerUSD,retailNeuronUsdMicros]) if(!Number.isSafeInteger(n)) throw new TypeError("Integer pricing inputs required");
  if(priceToman<=0||bonusPercent<0||bonusPercent>100||fxTomanPerUSD<=0||retailNeuronUsdMicros<=0) throw new RangeError("Invalid amount");
  const numerator=BigInt(priceToman)*USD_MICROS;
  const denominator=BigInt(fxTomanPerUSD)*BigInt(retailNeuronUsdMicros);
  const base=asSafe(numerator/denominator);
  const total=asSafe(numerator*BigInt(100+bonusPercent)/(denominator*100n));
  return {id:"",priceToman,bonusPercent,baseNeurons:base,giftNeurons:total-base,totalNeurons:total};
}
export function packageQuotes(fx:number,retailMicros:number):QuotedPackage[]{
  return PACKAGE_TIERS.map(t=>({...allocatePackage(t.priceToman,t.bonusPercent,fx,retailMicros),id:t.id}));
}
export function getDemoPackageResponse(now=new Date()){
 const fx=Number(process.env.DEMO_FX_TOMAN_PER_USD??"250000");
 const neuron=Number(process.env.NEURON_RETAIL_USD_MICROS??"176000");
 const quotes=packageQuotes(fx,neuron);
 return {mode:"demo" as const,currency:"IRT_TOMAN" as const,quotedAt:now.toISOString(),expiresAt:new Date(now.getTime()+300000).toISOString(),packages:quotes};
}
