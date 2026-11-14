import type { Bundle } from "./raw.js";
import { exportSchema } from "./raw.js";
export const discoveryInterval = 10 * 60_000;
export function unknownAccountSignature(bundle: Bundle | null) {
  const known = new Set(bundle?.accounts.accounts.map((a) => a.id) || []);
  return [
    ...new Set(
      (bundle?.signals?.signals || [])
        .map((s) => s.account)
        .filter((id) => !known.has(id)),
    ),
  ]
    .sort()
    .join("|");
}
export function discoveryDue(
  bundle: Bundle | null,
  lastChecked: number | null,
  previousUnknowns: string,
  now: number,
) {
  return (
    !bundle ||
    lastChecked === null ||
    now - lastChecked >= discoveryInterval ||
    unknownAccountSignature(bundle) !== previousUnknowns
  );
}
export function mergeDiscovery(bundle: Bundle | null, input: unknown): Bundle {
  const fresh = exportSchema.parse(input);
  const accounts = new Map(
    bundle?.accounts.accounts.map((a) => [a.id, a]) || [],
  );
  for (const a of fresh.accounts) accounts.set(a.id, a);
  const files = new Map(bundle?.accounts.files.map((f) => [f.id, f]) || []);
  for (const f of fresh.files) files.set(f.id, f);
  return {
    ...bundle,
    accounts: {
      ...fresh,
      accounts: [...accounts.values()],
      files: [...files.values()],
    },
  };
}
