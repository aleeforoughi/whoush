/**
 * The suite's existing safety tests describe the Iran Gov Filter's rules (lib/region-policy.ts), so they run with it ON; the default for the product is
 * OFF, and tests/region-policy.test.ts checks that mode by switching it per test.
 */
process.env.WHOUSH_IRAN_GOV_FILTER??="on";
