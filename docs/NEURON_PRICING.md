# نورون / Neuron economics contract
## Nonnegotiable invariant
Only whole Neurons exist, including package awards, gifts, balances, reservations, and per-generation costs. The customer never sees fractional Neurons, USD unit values, provider costs or LLM internal charges.

## Cash package catalog and gifts
| Toman package | Bonus |
|---|---|
| 2,000,000 | 0% |
| 5,000,000 | 2% |
| 10,000,000 | 4% |
| 20,000,000 | 6% |
| 50,000,000 | 8% |
| 100,000,000 | 10% |

Variable Neurons awarded at checkout, fixed cash prices. Use approved **USD sell toman rate** at checkout; not bank middle rate, not official central-bank IRR rate. All values integer, big integer math.
- Base = floor(price_toman * 1,000,000 / (fx_toman_per_usd * neuron_usd_micros)).
- Total = floor(price_toman * 1,000,000 * (100 + bonus_percent) / (fx_toman_per_usd * neuron_usd_micros * 100)).
- Gift = Total - Base.
Gifts **are included** in Total, not added again. Version the quote and lock until expiry.
Do not round display values up to attractive Neuron numbers.

## Development-only example
Retail value per Neuron (hidden): USD $0.176, rate: 250,000 toman per USD.
Example: 2m => 45; 5m => 115 (2 gift); 10m => 236 (9 gift); 20m => 481 (27 gift); 50m => 1227 (91 gift); 100m => 2500 (228 gift).
These examples are not a live market quote and are NOT a production margin certification.

## Fixed media prices
Every allowed media model + resolution + duration + audio parameter combination is a distinct SKU, each has an integer Neuron rate. Currency FX moves package Neuron awards only. For USD provider price changes, review & publish a new SKU revision deliberately; do not silently alter approved jobs.

## 20% margin target
Target 20% gross profit after provider model AND invisible chat/LLM overhead (plus defined applicable fulfilment expenses). On the largest 10% bonus package, effective retail revenue per Neuron is lowest.
For max bonus b, provider+LLM variable USD cost per Neuron c, base retail USD/Neuron V must satisfy:
  V >= c * (1+b) / (1-0.20)
Ex: if c <= $0.128 and b=10%, V=$0.176 preserves 20% gross margin before other expenses.
If costs exceed safe ceiling, flag margin warning and pause SKU sale or revise future SKU prices; do not misrepresent discount as guaranteed profit.
Watch payment fees, FX spread, storage, retries and abuse, separately from model API costs.

## FX feed production contract
Multiple eligible reliable sources; source timestamp, receive time and rate unit; convert IRR / 10 to toman only when input is documented as IRR. Validate outliers, stale rates, source agreement; alert/freeze new checkout on uncertainty. Live customers must NEVER silently receive values derived from the illustrative `DEMO_FX_TOMAN_PER_USD`.
Customer UI: package price, total Neurons, positive integer gift Neurons and optional bonus percent, note gifts included. No FX formulas/costs.

## Settlement and security
Payment must be verified server-side or bank-transfer receipt manually verified by authorized staff. Webhook retries grant credits only once. For generations, reserve exact immutable integer charge before submitting; settle on verified completed request and release on eligible failures/cancellations. Provider billing records reconcile with internal pricing in privileged admin dashboard.
