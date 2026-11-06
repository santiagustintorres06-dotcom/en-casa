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
  saveSharedState,
  watchState,
  type Household,
  type HouseholdMember,
} from "../services/households";
import { emptyHousehold } from "../services/cloudState";
import { loadHousehold } from "../services/storage";
import type { InventoryPort } from "../types/inventoryPort";
import type { HouseholdState } from "../types/shopping";

export function useHousehold() {
  const runtime = firebase;
  const [user, setUser] = useState<User | null>(null);
  const [id, setId] = useState("");
  const [home, setHome] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [state, setState] = useState(emptyHousehold);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const current = useRef({ state: emptyHousehold(), revision: -1 });
  const confirmed = useRef(current.current);
  const saving = useRef(false);
  const subscriptions = useRef<(() => void)[]>([]);
  const generation = useRef(0);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
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
      setId("");
      setHome(null);
      setReady(false);
      setLoading(!!next);
    });
    return stopAuth;
  }, []);
  useEffect(() => {
    if (!runtime || !user) return;
    const stop = onSnapshot(
      doc(runtime.db, "users", user.uid),
      (snapshot) => {
        setId(snapshot.data()?.householdId ?? "");
        setLoading(false);
      },
      (e) => {
        setError(cloudError(e));
        setLoading(false);
      },
    );
    subscriptions.current.push(stop);
    return stop;
  }, [user]);
  useEffect(() => {
    if (!runtime || !id || !user) {
      setHome(null);
      setMembers([]);
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
    let denied = false;
    const fail = (e: unknown) => {
      if (generation.current !== token) return;
      denied = true;
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
        (snap) => {
          if (denied) return;
          if (!snap.exists() || snap.data().status !== "active") {
            fail(
              new Error(
                "Este hogar fue desactivado. Podés volver al modo local.",
              ),
            );
            return;
          }
          setHome({ ...snap.data(), id } as Household);
        },
        fail,
      ),
      onSnapshot(
        collection(db, "households", id, "members"),
        (snap) => {
          if (!denied)
            setMembers(
              snap.docs.map(
                (d) => ({ ...d.data(), uid: d.id }) as HouseholdMember,
              ),
            );
        },
        fail,
      ),
      watchState(
        db,
        id,
        (next, revision) => {
          if (generation.current !== token || denied) return;
          confirmed.current = { state: next, revision };
          if (!saving.current || revision >= current.current.revision) {
            current.current = confirmed.current;
            setState(next);
          }
          setReady(true);
          setLoading(false);
        },
        fail,
      ),
    ];
    subscriptions.current.push(...stops);
    return () => {
      generation.current += 1;
      stops.forEach((stop) => stop());
      saving.current = false;
      setPending(false);
    };
  }, [id, user]);

  function commit(change: (s: HouseholdState) => HouseholdState) {
    if (!runtime || !home || !ready || saving.current) {
      setError("Esperá a que termine la sincronización antes de seguir.");
      return false;
    }
    if (!navigator.onLine) {
      setError(
        "En esta etapa el hogar compartido necesita conexión para guardar. El modo offline llega con la PWA.",
      );
      return false;
    }
    const before = current.current;
    let next;
    try {
      next = change(before.state);
    } catch (e) {
      setError(cloudError(e));
      return false;
    }
    if (next === before.state) return true;
    const token = generation.current;
    saving.current = true;
    setPending(true);
    setError("");
    current.current = { state: next, revision: before.revision + 1 };
    setState(next);
    saveSharedState(runtime.db, home.id, before.state, next, before.revision)
      .then(() => {
        if (generation.current === token) {
          confirmed.current = current.current;
        }
      })
      .catch((e) => {
        if (generation.current === token) {
          current.current = confirmed.current;
          setState(confirmed.current.state);
          setError(cloudError(e));
        }
      })
      .finally(() => {
        if (generation.current === token) {
          saving.current = false;
          setPending(false);
        }
      });
    return true;
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
  async function logout() {
    if (!runtime) return false;
    if (saving.current) {
      setError("Esperá a que se guarden los cambios antes de cerrar sesión.");
      return false;
    }
    return action(async () => {
      subscriptions.current.forEach((stop) => stop());
      subscriptions.current = [];
      generation.current += 1;
      setReady(false);
      setState(emptyHousehold());
      setHome(null);
      setMembers([]);
      // Stop listeners before terminating and clearing any Firestore cache left by earlier versions.
      await terminate(runtime.db);
      await clearIndexedDbPersistence(runtime.db);
      localStorage.removeItem("encasa.household.v2");
      localStorage.removeItem("encasa.inventory.v1");
      await signOut(runtime.auth);
      location.reload();
    });
  }
  const port: InventoryPort | undefined = id
    ? {
        state: ready ? state : emptyHousehold(),
        error,
        pending: pending || !ready,
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
    error,
    online,
    port,
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
