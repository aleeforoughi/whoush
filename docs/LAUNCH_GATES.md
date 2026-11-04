# Production launch gates (BLOCKING)
**Do not interpret code presence as readiness to serve customers.**

1. **Provider authorization:** Higgsfield API Terms updated 2026-09-02 sections 4.1 (no direct API exposure), 4.2 (anti-resale/competing service), 8.1 (embargoed end users). Iran-focused product may be incompatible with current terms; obtain explicit written contractual authorization as applicable. Source: https://open.higgsfield.ai/terms-of-service .
2. **LLM authorization:** Verify each provider allows your business and the exact end-user jurisdictions. Do not claim that domestic hosting or routing through foreign servers cures a forbidden end-user location.
3. **Verified media model catalog:** Confirm exact API paths, input JSON schemas, output formats, available durations and current pricing from `https://open.higgsfield.ai/explore` and linked per-model API docs. Never fabricate path mappings. Verify access with authorized account and use tests.
4. **FX acquisition:** Secure reliable licensing/access to USD sell quote data; choose trustworthy sources and fail closed when stale.
5. **Payments:** Choose lawful Iran-appropriate payment method and legal entity; secure verified fulfillment, refunds, consumer disclosures, checkout snapshots, AML/fraud controls.
6. **Data privacy:** Clarify where prompts/media/user PII reside and retention; obtain appropriate consents for faces and likenesses; enforce platform content restrictions and user rights.
7. **Security:** Account auth, ownership checks, rate limits, CSRF/abuse mitigation, upload validation, private storage, managed secrets, webhook signatures, audit and incident response.
8a. **Content policy and expert skills:** Every live creative LLM request includes mandatory core skills and relevant domain experts through the private skills compiler. Production moderation requires Persian contextual classification, attachment inspection (including OCR/ASR when applicable), a repeat check of expanded action plans immediately before media submission, generated-output screening, human review for borderline requests, and measured false-positive/false-negative rates. The lexical preflight alone is NOT authorization for generation.
8. **Engineering:** Durable database queue, concurrency-safe financial ledger, retry + cancellation handling, outputs mirrored to owned storage, observability, backpressure and rate caps, tested mobile RTL.
9. **Business:** All SKU configurations with minimum margin after max bonus and internal chat overhead, reconciliation and negative-margin alerts. Verify high-tier discounts don't breach 20% target.
10. **Go-live decision:** Human sign-off on provider permissions, payment, regional availability, policy, tests, recovery plan, and terms.

Higgsfield API facts as of Nov 2026: USD prepaid API billing (separate from its consumer credits), submit/status/cancel asynchronous generation, media may expire after at least seven days. Official source: https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api and https://open.higgsfield.ai/quick-start .
