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
