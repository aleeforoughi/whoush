/**
 * Iran Gov Filter (owner, 2026-11-08: "we are going to publish it first outside Iran; create an Iran Gov Filter on/off flag in the backend, not shown to
 * users, and disable it now"). Server environment only (`WHOUSH_IRAN_GOV_FILTER=on`); unset or anything else is OFF. Never sent to a browser or a response.
 *
 * ON adds the rules that exist for Iran's regulations: general politics and Iranian political topics (protests, slogans, hijab law, security forces),
 * pre-revolution royal symbols, alcohol, drugs, smoking and gambling, and the dress rules (swimwear, lingerie, see-through clothing, modest outfits).
 * OFF also means as much freedom as possible (owner, 2026-11-08): sexy styling of clothed adults, film-style blood and violence, swearing, and real people
 * (celebrities and political figures) on trust: users accept at sign-up that they have consent for anyone they use and own what they make.
 * OFF or ON, the baseline always applies: nudity and explicit sexual content (of anyone), anything sexual about minors, extreme gore, insults to a religion,
 * hate against a group (docs/MODERATION_POLICY.md).
 */
export const iranGovFilterOn=():boolean=>typeof process!=="undefined"&&process.env.WHOUSH_IRAN_GOV_FILTER==="on";
