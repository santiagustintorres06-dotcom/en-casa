import type { HouseholdState } from "./shopping";
export type InventoryPort = {
  state: HouseholdState;
  error: string;
  pending: boolean;
  commit: (change: (state: HouseholdState) => HouseholdState) => boolean;
};
