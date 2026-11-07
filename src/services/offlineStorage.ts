import type { HouseholdState } from "../types/shopping.ts";
import type { Household, HouseholdMember } from "./households.ts";
import type { OfflineChange } from "./offlineChanges.ts";
import { parseState } from "./storage.ts";
export type OfflineCache = {
  householdId: string;
  home: Omit<Household, "inviteExpiresAt"> & { inviteExpiresAtMillis: number };
  members: HouseholdMember[];
  state: HouseholdState;
  revision: number;
};
type Store = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;
const cacheKey = (uid: string) => `encasa.cloud.${uid}`;
const prefix = (uid: string, id: string) => `encasa.outbox.${uid}.${id}.`;
export function readOfflineCache(
  uid: string,
  storage: Store = localStorage,
): OfflineCache | null {
  const raw = storage.getItem(cacheKey(uid));
  if (!raw) return null;
  const cache = JSON.parse(raw) as OfflineCache;
  if (
    !cache.home ||
    cache.home.id !== cache.householdId ||
    !Number.isInteger(cache.revision) ||
    !Array.isArray(cache.members)
  )
    throw new Error(
      "No pudimos leer la copia offline. Conservamos los datos para recuperarlos.",
    );
  cache.state = parseState(JSON.stringify(cache.state));
  return cache;
}
export const writeOfflineCache = (
  uid: string,
  cache: OfflineCache,
  storage: Store = localStorage,
) => storage.setItem(cacheKey(uid), JSON.stringify(cache));
export const removeOfflineCache = (
  uid: string,
  storage: Store = localStorage,
) => storage.removeItem(cacheKey(uid));
export function queuedChanges(
  uid: string,
  id: string,
  storage: Store = localStorage,
): OfflineChange[] {
  const list: OfflineChange[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix(uid, id))) continue;
    const change = JSON.parse(storage.getItem(key)!);
    if (typeof change.id !== "string" || !Number.isFinite(change.createdAt))
      throw new Error("Hay un cambio pendiente dañado. No lo borramos.");
    change.before = parseState(JSON.stringify(change.before));
    change.after = parseState(JSON.stringify(change.after));
    list.push(change);
  }
  return list.sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}
export function queueChange(
  uid: string,
  id: string,
  change: OfflineChange,
  storage: Store = localStorage,
) {
  storage.setItem(prefix(uid, id) + change.id, JSON.stringify(change));
}
export const acknowledgeChange = (
  uid: string,
  id: string,
  operationId: string,
  storage: Store = localStorage,
) => storage.removeItem(prefix(uid, id) + operationId);
export function discardChanges(
  uid: string,
  id: string,
  storage: Store = localStorage,
) {
  for (const change of queuedChanges(uid, id, storage))
    acknowledgeChange(uid, id, change.id, storage);
}
export function clearAppData(storage: Store = localStorage) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith("encasa.")) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}
