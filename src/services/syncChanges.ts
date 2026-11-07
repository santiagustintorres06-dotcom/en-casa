import {
  collection,
  getDocsFromServer,
  type Firestore,
} from "firebase/firestore";
import { decodeState } from "./cloudState.ts";
import { saveSharedState } from "./households.ts";
import { replayChange, type OfflineChange } from "./offlineChanges.ts";
export async function syncChange(
  db: Firestore,
  householdId: string,
  change: OfflineChange,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = await getDocsFromServer(
      collection(db, "households", householdId, "items"),
    );
    const remote = decodeState(
      snapshot.docs.map((d) => ({ id: d.id, data: d.data() })),
    );
    const next = replayChange(remote.state, change);
    if (next === remote.state) return remote;
    try {
      await saveSharedState(
        db,
        householdId,
        remote.state,
        next,
        remote.revision,
      );
      return { state: next, revision: remote.revision + 1 };
    } catch (e) {
      if (
        !(e instanceof Error) ||
        !e.message.startsWith("Otro integrante actualizó") ||
        attempt === 2
      )
        throw e;
    }
  }
  throw new Error(
    "No pudimos sincronizar. Los cambios siguen guardados en este dispositivo.",
  );
}
