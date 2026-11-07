import { useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  clearIndexedDbPersistence,
  collection,
  doc,
  onSnapshot,
  setDoc,
  terminate,
  Timestamp,
} from "firebase/firestore";
import {
  firebase,
  firebaseConfigured,
  emulatorMode,
} from "../services/firebase";
import {
  cloudError,
  createHousehold,
  deactivateHousehold,
  joinHousehold,
  rotateInvitation,
  watchState,
  watchUserHousehold,
  type Household,
  type HouseholdMember,
} from "../services/households";
import { emptyHousehold } from "../services/cloudState";
import { loadHousehold } from "../services/storage";
import type { InventoryPort } from "../types/inventoryPort";
import type { HouseholdState } from "../types/shopping";
import { replayChanges } from "../services/offlineChanges";
import {
  readOfflineCache,
  writeOfflineCache,
  removeOfflineCache,
  queuedChanges,
  queueChange,
  acknowledgeChange,
  discardChanges,
  clearAppData,
} from "../services/offlineStorage";
import { syncChange } from "../services/syncChanges";

export function useHousehold() {
  const runtime = firebase;
  const [user, setUser] = useState<User | null>(null);
  const [id, setId] = useState("");
  const [home, setHome] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [state, setState] = useState(emptyHousehold);
  const [ready, setReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const current = useRef({ state: emptyHousehold(), revision: -1 });
  const confirmed = useRef(current.current);
  const saving = useRef(false);
  const subscriptions = useRef<(() => void)[]>([]);
  const generation = useRef(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [queueTick, setQueueTick] = useState(0);
  const conflict = useRef(false);
  function paintQueue() {
    if (!user || !id) return;
    const changes = queuedChanges(user.uid, id);
    setQueuedCount(changes.length);
    let visible = confirmed.current.state;
    try {
      visible = replayChanges(visible, changes);
      conflict.current = false;
    } catch (e) {
      conflict.current = true;
      setError(cloudError(e));
      if (changes.length) visible = changes[changes.length - 1].after;
    }
    current.current = { state: visible, revision: confirmed.current.revision };
    setState(visible);
  }

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) setConnectionAttempt((v) => v + 1);
    };
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!runtime) return;
    const stopAuth = onAuthStateChanged(runtime.auth, (next) => {
      setUser(next);
      let cached = null;
      try {
        if (next) cached = readOfflineCache(next.uid);
      } catch (e) {
        setError(cloudError(e));
      }
      setId(cached?.householdId ?? "");
      setHome(null);
      setReady(false);
      setProfileReady(false);
      setError("");
      setLoading(!!next && navigator.onLine);
    });
    return stopAuth;
  }, []);
  useEffect(() => {
    if (!runtime || !user) return;
    setProfileReady(false);
    setLoading(navigator.onLine);
    const stop = watchUserHousehold(
      runtime.db,
      user.uid,
      (householdId) => {
        setId(householdId);
        setProfileReady(true);
        setLoading(false);
      },
      (e) => {
        setError(cloudError(e));
        setLoading(false);
      },
    );
    subscriptions.current.push(stop);
    return stop;
  }, [user, connectionAttempt]);
  useEffect(() => {
    if (!runtime || !id || !user) {
      setHome(null);
      setMembers([]);
      setQueuedCount(0);
      setSyncing(false);
      conflict.current = false;
      setReady(false);
      current.current = { state: emptyHousehold(), revision: -1 };
      confirmed.current = current.current;
      setState(emptyHousehold());
      return;
    }
    const db = runtime.db;
    generation.current += 1;
    const token = generation.current;
    setReady(false);
    setLoading(true);
    setHome(null);
    setMembers([]);
    current.current = { state: emptyHousehold(), revision: -1 };
    confirmed.current = current.current;
    let liveHome: Household | null = null;
    let liveMembers: HouseholdMember[] = [];
    try {
      const cached = readOfflineCache(user.uid);
      if (cached?.householdId === id) {
        const { inviteExpiresAtMillis, ...fields } = cached.home;
        liveHome = {
          ...fields,
          inviteExpiresAt: Timestamp.fromMillis(inviteExpiresAtMillis),
        };
        liveMembers = cached.members;
        confirmed.current = { state: cached.state, revision: cached.revision };
        setHome(liveHome);
        setMembers(liveMembers);
        paintQueue();
        setReady(true);
        setLoading(false);
      } else if (!navigator.onLine) {
        setLoading(false);
        setError(
          "Conectate una vez para descargar el hogar antes de usarlo sin señal.",
        );
      }
    } catch (e) {
      setError(cloudError(e));
      setLoading(false);
    }
    let denied = false;
    let homeLoaded = false,
      membersLoaded = false,
      itemsLoaded = false,
      connected = false;
    const updateReady = () => {
      if (denied || generation.current !== token) return;
      if (homeLoaded && membersLoaded && itemsLoaded) {
        setReady(true);
        setLoading(false);
        if (!connected) {
          setError("");
          connected = true;
        }
        if (liveHome) {
          try {
            const { inviteExpiresAt, ...fields } = liveHome;
            writeOfflineCache(user.uid, {
              householdId: id,
              home: {
                ...fields,
                inviteExpiresAtMillis: inviteExpiresAt.toMillis(),
              },
              members: liveMembers,
              state: confirmed.current.state,
              revision: confirmed.current.revision,
            });
          } catch {
            setError(
              "No pudimos actualizar la copia offline. Revisá el espacio del navegador antes de salir.",
            );
          }
        }
      }
    };
    const fail = (e: unknown) => {
      if (generation.current !== token) return;
      denied = true;
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        String(e.code).includes("permission-denied")
      )
        removeOfflineCache(user.uid);
      setError(cloudError(e));
      setReady(false);
      setLoading(false);
      setHome(null);
      setMembers([]);
      current.current = { state: emptyHousehold(), revision: -1 };
      confirmed.current = current.current;
      setState(emptyHousehold());
    };
    const stops = [
      onSnapshot(
        doc(db, "households", id),
        { includeMetadataChanges: true },
        (snap) => {
          if (
            denied ||
            snap.metadata.hasPendingWrites ||
            snap.metadata.fromCache
          )
            return;
          if (!snap.exists() || snap.data().status !== "active") {
            fail(
              new Error(
                "Este hogar fue desactivado. Podés volver al modo local.",
              ),
            );
            return;
          }
          setHome({ ...snap.data(), id } as Household);
          liveHome = { ...snap.data(), id } as Household;
          homeLoaded = true;
          updateReady();
        },
        fail,
      ),
      onSnapshot(
        collection(db, "households", id, "members"),
        { includeMetadataChanges: true },
        (snap) => {
          if (
            denied ||
            snap.metadata.hasPendingWrites ||
            snap.metadata.fromCache
          )
            return;
          liveMembers = snap.docs.map(
            (d) => ({ ...d.data(), uid: d.id }) as HouseholdMember,
          );
          setMembers(liveMembers);
          membersLoaded = true;
          updateReady();
        },
        fail,
      ),
      watchState(
        db,
        id,
        (next, revision) => {
          if (generation.current !== token || denied) return;
          if (revision >= confirmed.current.revision)
            confirmed.current = { state: next, revision };
          paintQueue();
          itemsLoaded = true;
          updateReady();
        },
        fail,
      ),
    ];
    subscriptions.current.push(...stops);
    return () => {
      generation.current += 1;
      stops.forEach((stop) => stop());
      saving.current = false;
      setSyncing(false);
      setPending(false);
    };
  }, [id, user, connectionAttempt]);

  useEffect(() => {
    if (!id || !user) return;
    const update = (e: StorageEvent) => {
      if (e.key?.startsWith("encasa.")) {
        try {
          const cached = readOfflineCache(user.uid);
          if (
            cached?.householdId === id &&
            cached.revision > confirmed.current.revision
          )
            confirmed.current = {
              state: cached.state,
              revision: cached.revision,
            };
          paintQueue();
          setQueueTick((v) => v + 1);
        } catch (e) {
          setError(cloudError(e));
        }
      }
    };
    addEventListener("storage", update);
    return () => removeEventListener("storage", update);
  }, [id, user]);

  useEffect(() => {
    if (!runtime || !user || !id || !ready || !online || saving.current) return;
    const token = generation.current;
    const run = async () => {
      if (generation.current !== token || saving.current) return;
      saving.current = true;
      setSyncing(true);
      try {
        while (navigator.onLine && generation.current === token) {
          const change = queuedChanges(user.uid, id)[0];
          if (!change) break;
          const result = await syncChange(runtime.db, id, change);
          if (generation.current !== token) return;
          acknowledgeChange(user.uid, id, change.id);
          if (result.revision >= confirmed.current.revision)
            confirmed.current = result;
          const cached = readOfflineCache(user.uid);
          if (cached?.householdId === id)
            writeOfflineCache(user.uid, { ...cached, ...confirmed.current });
          paintQueue();
          setError("");
        }
      } catch (e) {
        if (generation.current === token) {
          setError(
            `${cloudError(e)} Tus cambios pendientes siguen en este dispositivo.`,
          );
          if (
            e &&
            typeof e === "object" &&
            "code" in e &&
            String(e.code).includes("permission-denied")
          ) {
            removeOfflineCache(user.uid);
            setReady(false);
          }
        }
      } finally {
        if (generation.current === token) {
          saving.current = false;
          setSyncing(false);
        }
      }
    };
    if (navigator.locks)
      void navigator.locks.request(`encasa-sync-${user.uid}-${id}`, run);
    else void run();
  }, [id, user, ready, online, queueTick, connectionAttempt]);

  function commit(change: (s: HouseholdState) => HouseholdState) {
    if (!user || !id || !home || !ready) {
      setError(
        (previous) =>
          previous || "Primero conectá el hogar para guardar cambios.",
      );
      return false;
    }
    if (conflict.current) {
      setError(
        "Revisá los cambios pendientes antes de seguir. Podés exportarlos o descartarlos desde Ajustes.",
      );
      return false;
    }
    try {
      const before = current.current.state;
      const after = change(before);
      if (after === before) return true;
      const changes = queuedChanges(user.uid, id);
      const operationId = "sync-" + crypto.randomUUID();
      queueChange(user.uid, id, {
        id: operationId,
        createdAt: Math.max(Date.now(), (changes.at(-1)?.createdAt ?? 0) + 1),
        before,
        after: {
          ...after,
          completedOperations: [...after.completedOperations, operationId],
        },
      });
      paintQueue();
      setQueueTick((v) => v + 1);
      setError("");
      return true;
    } catch (e) {
      setError(
        e instanceof Error && e.name === "QuotaExceededError"
          ? "No hay espacio para guardar el cambio offline. Liberá espacio antes de seguir."
          : cloudError(e),
      );
      return false;
    }
  }
  async function action(task: () => Promise<unknown>) {
    if (!navigator.onLine) {
      setError("Necesitás conexión para esta acción del hogar.");
      return false;
    }
    setPending(true);
    setError("");
    try {
      await task();
      return true;
    } catch (e) {
      setError(cloudError(e));
      return false;
    } finally {
      setPending(false);
    }
  }
  async function logout(discardPending = false) {
    if (!runtime) return false;
    if (saving.current) {
      setError("Esperá a que termine el envío antes de cerrar sesión.");
      return false;
    }
    if (user && id && queuedChanges(user.uid, id).length && !discardPending) {
      setError(
        "Hay cambios pendientes. Sincronizalos o confirmá que querés descartarlos al salir.",
      );
      return false;
    }
    setPending(true);
    try {
      subscriptions.current.forEach((stop) => stop());
      subscriptions.current = [];
      generation.current += 1;
      setReady(false);
      setState(emptyHousehold());
      setHome(null);
      setMembers([]);
      await terminate(runtime.db);
      await clearIndexedDbPersistence(runtime.db);
      clearAppData();
      await signOut(runtime.auth);
      location.reload();
      return true;
    } catch (e) {
      setError(cloudError(e));
      return false;
    } finally {
      setPending(false);
    }
  }
  const port: InventoryPort | undefined = id
    ? {
        state: ready ? state : emptyHousehold(),
        error,
        pending: pending || loading,
        commit,
      }
    : undefined;
  return {
    configured: firebaseConfigured,
    emulatorMode,
    user,
    id,
    home,
    members,
    loading,
    pending,
    ready,
    profileReady,
    error,
    online,
    queuedCount,
    syncing,
    exportPending: () => {
      if (!user || !id) return;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(queuedChanges(user.uid, id), null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "en-casa-cambios-pendientes.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    discardPending: async () => {
      if (!user || !id || saving.current) return false;
      discardChanges(user.uid, id);
      conflict.current = false;
      paintQueue();
      setError("");
      return true;
    },
    port,
    retryConnection: () => {
      if (!pending && !saving.current) {
        setReady(false);
        setError("");
        setLoading(true);
        setConnectionAttempt((value) => value + 1);
      }
    },
    login: () =>
      runtime
        ? action(() => signInWithPopup(runtime.auth, new GoogleAuthProvider()))
        : Promise.resolve(false),
    create: (name: string) =>
      runtime && user
        ? action(() =>
            createHousehold(runtime.db, user.uid, user.displayName, name),
          )
        : Promise.resolve(false),
    join: (code: string) =>
      runtime && user
        ? action(() =>
            joinHousehold(runtime.db, user.uid, user.displayName, code),
          )
        : Promise.resolve(false),
    rotate: () =>
      runtime && home
        ? action(() => rotateInvitation(runtime.db, home))
        : Promise.resolve(false),
    expel: (uid: string) =>
      runtime && home
        ? action(() => rotateInvitation(runtime.db, home, uid))
        : Promise.resolve(false),
    deactivate: () =>
      runtime && home
        ? action(() => deactivateHousehold(runtime.db, home))
        : Promise.resolve(false),
    localMode: () =>
      runtime && user
        ? action(() =>
            setDoc(doc(runtime.db, "users", user.uid), { householdId: "" }),
          )
        : Promise.resolve(false),
    importLocal: () => {
      try {
        if (state.products.length || state.manualItems.length)
          throw new Error(
            "La importación requiere un hogar vacío para no mezclar ni duplicar datos.",
          );
        const local = loadHousehold().state;
        if (local.products.length + local.manualItems.length > 150)
          throw new Error(
            "Por ahora podés importar hasta 150 productos e ítems de una vez.",
          );
        return commit(() => ({
          ...local,
          selections: {},
          completedOperations: [],
          manualItems: local.manualItems.map((p) => ({ ...p, checked: false })),
        }));
      } catch (e) {
        setError(cloudError(e));
        return false;
      }
    },
    logout,
  };
}
export type HouseholdController = ReturnType<typeof useHousehold>;
