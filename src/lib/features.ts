/**
 * Feature flags for capabilities that are built but not yet ready to ship.
 *
 * Prefer flipping a flag here over deleting code — the feature stays covered by
 * typecheck and the bundle, so it does not rot while it waits.
 */

/**
 * Barcode scanning.
 *
 * The scanning engine needs a Scandit licence key
 * (`EXPO_PUBLIC_SCANDIT_LICENSE_KEY` in the repo-root `.env`). Rather than ship a
 * camera that silently degrades, the Scan tab shows a "Coming soon" card while
 * this is false.
 *
 * Manual logging and history are unaffected — those never needed a key.
 *
 * To turn it on: get the licence key, put it in `.env`, set this to `true`, and
 * restart the bundler with `npm run start:clear` (EXPO_PUBLIC_* is inlined at
 * bundle time, so a running Metro keeps serving the old value).
 *
 * Note that the barcode *lookup* — Open Food Facts and UPCItemDB — needs no key
 * and already works. It is only the on-device scanner that is gated.
 */
export const BARCODE_SCANNING_ENABLED = false;

/**
 * Blue, the AI coach.
 *
 * Needs an AI provider configured on the server (`AI_BASE_URL`, `AI_API_KEY`,
 * `AI_MODEL` in `server/.env`). While this is false the Coach tab shows a
 * "Coming soon" card and never calls the API, so a missing or misbehaving
 * provider cannot surface as an error to users.
 *
 * To turn it on: get the server answering, confirm its startup log reads
 * `AI coach: configured`, then set this to `true`.
 */
export const AI_COACH_ENABLED = false;

/**
 * Whether there is anything to sell.
 *
 * Premium's entire value is unlimited scans plus the coach. With both gated
 * there is nothing behind the paywall, so it must not be shown — charging for
 * two "coming soon" features would be indefensible, and on iOS it would also
 * put an unusable purchase in front of App Review.
 */
export const PREMIUM_HAS_ANYTHING_TO_SELL =
  BARCODE_SCANNING_ENABLED || AI_COACH_ENABLED;
