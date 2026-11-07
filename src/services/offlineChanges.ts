import type { HouseholdState } from "../types/shopping.ts";
import { parseState } from "./storage.ts";

export type OfflineChange = {
  id: string;
  createdAt: number;
  before: HouseholdState;
  after: HouseholdState;
};
export class OfflineConflict extends Error {
  constructor(name: string) {
    super(
      `Hay cambios de otro integrante en ${name}. Tus cambios pendientes siguen guardados. Exportalos antes de descartarlos o revisá el conflicto.`,
    );
    this.name = "OfflineConflict";
  }
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
type Item = { id: string; [key: string]: unknown };
function mergeItems(
  before: Item[],
  after: Item[],
  remote: Item[],
  stock: boolean,
): Item[] {
  const base = new Map(before.map((p) => [p.id, p])),
    wanted = new Map(after.map((p) => [p.id, p])),
    result = new Map(remote.map((p) => [p.id, { ...p }]));
  for (const id of new Set([...base.keys(), ...wanted.keys()])) {
    const old = base.get(id),
      local = wanted.get(id),
      live = result.get(id);
    if (same(old, local)) continue;
    const name = String(local?.name ?? old?.name ?? "un producto");
    if (!old) {
      if (live && !same(live, local)) throw new OfflineConflict(name);
      if (local) result.set(id, { ...local });
      continue;
    }
    if (!local) {
      if (live && !same(live, old)) throw new OfflineConflict(name);
      result.delete(id);
      continue;
    }
    if (!live) throw new OfflineConflict(name);
    const merged = { ...live };
    if (
      stock &&
      local.unit !== old.unit &&
      (live.unit !== old.unit || live.quantity !== old.quantity)
    )
      throw new OfflineConflict(name);
    for (const field of Object.keys(local)) {
      if (field === "updatedAt" || same(old[field], local[field])) continue;
      if (stock && field === "quantity" && local.unit === old.unit) {
        if (live.unit !== old.unit) throw new OfflineConflict(name);
        const quantity =
          Math.round(
            (Number(live.quantity) +
              Number(local.quantity) -
              Number(old.quantity)) *
              1e9,
          ) / 1e9;
        if (quantity < 0 || quantity > 100000) throw new OfflineConflict(name);
        merged.quantity = quantity;
      } else {
        if (!same(live[field], old[field]) && !same(live[field], local[field]))
          throw new OfflineConflict(name);
        merged[field] = local[field];
      }
    }
    if (stock) merged.updatedAt = local.updatedAt;
    result.set(id, merged);
  }
  return [...result.values()];
}
export function replayChange(
  remote: HouseholdState,
  change: OfflineChange,
): HouseholdState {
  if (remote.completedOperations.includes(change.id)) return remote;
  const selections = (s: HouseholdState) =>
    Object.entries(s.selections).map(([id, p]) => ({ id, ...p }));
  const mergedSelections = mergeItems(
    selections(change.before),
    selections(change.after),
    selections(remote),
    false,
  );
  const state: HouseholdState = {
    ...remote,
    products: mergeItems(
      change.before.products as unknown as Item[],
      change.after.products as unknown as Item[],
      remote.products as unknown as Item[],
      true,
    ) as never,
    manualItems: mergeItems(
      change.before.manualItems as unknown as Item[],
      change.after.manualItems as unknown as Item[],
      remote.manualItems as unknown as Item[],
      false,
    ) as never,
    selections: Object.fromEntries(
      mergedSelections.map(({ id, ...p }) => [id, p]),
    ) as never,
    completedOperations: [
      ...new Set([
        ...remote.completedOperations,
        ...change.after.completedOperations,
        change.id,
      ]),
    ],
  };
  return parseState(JSON.stringify(state));
}
export const replayChanges = (
  remote: HouseholdState,
  changes: OfflineChange[],
) => changes.reduce(replayChange, remote);
