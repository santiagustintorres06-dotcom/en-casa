import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  disableNetwork,
  enableNetwork,
  getDocsFromServer,
} from "firebase/firestore";
import {
  createHousehold,
  joinHousehold,
  rotateInvitation,
  saveSharedState,
  watchUserHousehold,
  watchState,
} from "../src/services/households.ts";
import { decodeState } from "../src/services/cloudState.ts";
import { finishShopping } from "../src/services/shopping.ts";
import { syncChange } from "../src/services/syncChanges.ts";

let env;
const auth = (uid) =>
  env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "google.com" } })
    .firestore();
const code = "a".repeat(32);
const homeData = (ownerUid = "owner") => ({
  name: "Casa",
  ownerUid,
  inviteCode: code,
  inviteExpiresAt: Timestamp.fromMillis(Date.now() + 172790000),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  status: "active",
});
const rice = {
  kind: "product",
  id: "rice",
  name: "Arroz",
  category: "Almacén",
  quantity: 0,
  unit: "un",
  minimumStock: 1,
  updatedAt: "now",
};
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-encasa",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "households/home"), homeData());
    await setDoc(doc(db, "households/home/members/owner"), {
      role: "owner",
      displayName: "Owner",
      joinedAt: Timestamp.now(),
    });
    await setDoc(doc(db, "households/home/members/member"), {
      role: "member",
      displayName: "Member",
      joinedAt: Timestamp.now(),
    });
    await setDoc(doc(db, "households/other"), homeData("outsider"));
    await setDoc(doc(db, "households/other/members/outsider"), {
      role: "owner",
      displayName: "Other",
      joinedAt: Timestamp.now(),
    });
    await setDoc(doc(db, "households/home/items/_version"), {
      kind: "version",
      revision: 0,
    });
    await setDoc(doc(db, "households/home/items/p_rice"), rice);
    await setDoc(doc(db, `invites/${code}`), {
      householdId: "home",
      expiresAt: Timestamp.fromMillis(Date.now() + 172790000),
    });
  });
});
test("sin sesión, otro hogar y proveedor no Google no pueden leer", async () => {
  await assertFails(
    getDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        "households/home/items/p_rice",
      ),
    ),
  );
  await assertFails(
    getDoc(doc(auth("outsider"), "households/home/items/p_rice")),
  );
  await assertFails(
    getDoc(
      doc(
        env
          .authenticatedContext("owner", {
            firebase: { sign_in_provider: "password" },
          })
          .firestore(),
        "households/home",
      ),
    ),
  );
  await assertSucceeds(
    getDocs(collection(auth("member"), "households/home/items")),
  );
});
test("crea hogar, propietario, puntero e invitación en un único batch", async () => {
  const db = auth("newowner"),
    home = homeData("newowner");
  // Use a fresh capability, never overwrite an existing invite.
  const fresh = "b".repeat(32);
  const b = writeBatch(db);
  b.set(doc(db, "households/new"), { ...home, inviteCode: fresh });
  b.set(doc(db, "households/new/members/newowner"), {
    role: "owner",
    displayName: "Nuevo",
    joinedAt: serverTimestamp(),
  });
  b.set(doc(db, "users/newowner"), { householdId: "new" });
  b.set(doc(db, "households/new/items/_version"), {
    kind: "version",
    revision: 0,
  });
  b.set(doc(db, `invites/${fresh}`), {
    householdId: "new",
    expiresAt: home.inviteExpiresAt,
  });
  await assertSucceeds(b.commit());
});
test("member no puede cambiar rol, expulsar, rotar ni borrar hogar", async () => {
  const db = auth("member");
  await assertFails(
    updateDoc(doc(db, "households/home/members/member"), { role: "owner" }),
  );
  await assertFails(deleteDoc(doc(db, "households/home/members/owner")));
  await assertFails(
    updateDoc(doc(db, "households/home"), {
      inviteCode: "b".repeat(32),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(db, "households/home"), {
      status: "deleted",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(db, "households/home")));
});
test("autoasignación sin invitación y enumeración de invitaciones quedan denegadas", async () => {
  const db = auth("intruder");
  await assertFails(
    setDoc(doc(db, "households/home/members/intruder"), {
      role: "owner",
      displayName: "Intruso",
      joinedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(db, "households/home/members/intruder"), {
      role: "member",
      displayName: "Intruso",
      joinedAt: serverTimestamp(),
    }),
  );
  await assertFails(getDoc(doc(db, `invites/${code}`)));
  await assertFails(getDocs(collection(db, "invites")));
});
test("unión valida código, intento y rol member de forma atómica", async () => {
  const db = auth("guest");
  await assertSucceeds(
    setDoc(doc(db, "joinAttempts/guest"), {
      code,
      attemptedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(getDoc(doc(db, `invites/${code}`)));
  const batch = writeBatch(db);
  batch.set(doc(db, "users/guest"), { householdId: "home" });
  batch.set(doc(db, "households/home/members/guest"), {
    role: "member",
    displayName: "Invitado",
    joinedAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(db, "households/home/items/p_rice")));
});
test("intentos tienen límite temporal y código ligado; no se borran para reiniciar", async () => {
  const db = auth("guest");
  await assertSucceeds(
    setDoc(doc(db, "joinAttempts/guest"), {
      code: "b".repeat(32),
      attemptedAt: serverTimestamp(),
    }),
  );
  await assertFails(getDoc(doc(db, `invites/${code}`)));
  await assertFails(
    setDoc(doc(db, "joinAttempts/guest"), {
      code,
      attemptedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(db, "joinAttempts/guest")));
});
test("código vencido o intento viejo no permiten unirse", async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), `invites/${code}`), {
      expiresAt: Timestamp.fromMillis(Date.now() - 1000),
    });
  });
  const db = auth("guest");
  await setDoc(doc(db, "joinAttempts/guest"), {
    code,
    attemptedAt: serverTimestamp(),
  });
  await assertFails(getDoc(doc(db, `invites/${code}`)));
  const b = writeBatch(db);
  b.set(doc(db, "users/guest"), { householdId: "home" });
  b.set(doc(db, "households/home/members/guest"), {
    role: "member",
    displayName: "Invitado",
    joinedAt: serverTimestamp(),
  });
  await assertFails(b.commit());
});
test("stock válido exige versión conjunta; payloads inválidos y extra se rechazan", async () => {
  const db = auth("member");
  await assertFails(setDoc(doc(db, "households/home/items/p_rice"), rice));
  for (const patch of [
    { quantity: -1 },
    { quantity: 100001 },
    { name: "a".repeat(81) },
    { extra: true },
    { category: "invalida" },
    { quantity: "7" },
  ]) {
    const b = writeBatch(db);
    b.set(doc(db, "households/home/items/p_rice"), { ...rice, ...patch });
    b.update(doc(db, "households/home/items/_version"), { revision: 1 });
    await assertFails(b.commit());
  }
  const b = writeBatch(db);
  b.update(doc(db, "households/home/items/p_rice"), { quantity: 7 });
  b.update(doc(db, "households/home/items/_version"), { revision: 1 });
  await assertSucceeds(b.commit());
});
test("owner puede expulsar y desactivar hogar; expulsado pierde acceso", async () => {
  const db = auth("owner");
  await assertSucceeds(deleteDoc(doc(db, "households/home/members/member")));
  await assertFails(
    getDoc(doc(auth("member"), "households/home/items/p_rice")),
  );
  await assertSucceeds(
    updateDoc(doc(db, "households/home"), {
      status: "deleted",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(getDoc(doc(db, "households/home/items/p_rice")));
});
test("servicios reales crean hogar, unen miembro y rotan invitación al expulsar", async () => {
  const ownerDb = auth("creator");
  await createHousehold(ownerDb, "creator", "Creador", "Casa nueva");
  const profile = await getDoc(doc(ownerDb, "users/creator"));
  const id = profile.data().householdId;
  const snapshot = await getDoc(doc(ownerDb, "households", id));
  const home = { ...snapshot.data(), id };
  await joinHousehold(auth("guest"), "guest", "Invitado", home.inviteCode);
  await assertSucceeds(
    getDocs(collection(auth("guest"), "households", id, "items")),
  );
  await rotateInvitation(ownerDb, home, "guest");
  await assertFails(
    getDocs(collection(auth("guest"), "households", id, "items")),
  );
  const next = await getDoc(doc(ownerDb, "households", id));
  if (next.data().inviteCode === home.inviteCode)
    throw new Error("No rotó el código");
});
test("compra compartida repone siete unidades una sola vez y detecta revisión vieja", async () => {
  const db = auth("member");
  const docs = await getDocs(collection(db, "households/home/items"));
  const { state, revision } = decodeState(
    docs.docs.map((d) => ({ id: d.id, data: d.data() })),
  );
  const selected = {
    ...state,
    selections: { rice: { checked: true, quantity: 7, unit: "un" } },
  };
  await saveSharedState(db, "home", state, selected, revision);
  const bought = finishShopping(selected, "purchase", "now");
  await saveSharedState(db, "home", selected, bought, revision + 1);
  const final = await getDoc(doc(db, "households/home/items/p_rice"));
  if (final.data().quantity !== 7) throw new Error("Stock incorrecto");
  if (finishShopping(bought, "purchase", "later") !== bought)
    throw new Error("Se duplicó la compra");
  let conflict = false;
  try {
    await saveSharedState(db, "home", state, selected, revision);
  } catch {
    conflict = true;
  }
  if (!conflict) throw new Error("No detectó conflicto");
});
test("un código válido no permite autoproclamarse owner ni falsificar timestamp del intento", async () => {
  const db = auth("guest");
  await assertFails(
    setDoc(doc(db, "joinAttempts/guest"), {
      code,
      attemptedAt: Timestamp.fromMillis(Date.now() + 60000),
    }),
  );
  await setDoc(doc(db, "joinAttempts/guest"), {
    code,
    attemptedAt: serverTimestamp(),
  });
  const b = writeBatch(db);
  b.set(doc(db, "users/guest"), { householdId: "home" });
  b.set(doc(db, "households/home/members/guest"), {
    role: "owner",
    displayName: "Invitado",
    joinedAt: serverTimestamp(),
  });
  await assertFails(b.commit());
});
test("intento de más de 30 segundos no habilita acceso a la invitación", async () => {
  await env.withSecurityRulesDisabled(async (c) =>
    setDoc(doc(c.firestore(), "joinAttempts/guest"), {
      code,
      attemptedAt: Timestamp.fromMillis(Date.now() - 60000),
    }),
  );
  await assertFails(getDoc(doc(auth("guest"), `invites/${code}`)));
});
test("otro hogar y usuario anónimo tampoco pueden escribir stock ni perfil ajeno", async () => {
  for (const db of [
    auth("outsider"),
    env.unauthenticatedContext().firestore(),
  ]) {
    const b = writeBatch(db);
    b.update(doc(db, "households/home/items/p_rice"), { quantity: 7 });
    b.update(doc(db, "households/home/items/_version"), { revision: 1 });
    await assertFails(b.commit());
  }
  await assertFails(
    setDoc(doc(auth("member"), "users/owner"), { householdId: "" }),
  );
});

test(
  "no abre un hogar anunciado localmente hasta confirmar el batch en el servidor",
  { timeout: 15000 },
  async () => {
    const db = auth("fresh-owner");
    const seen = [];
    let firstProfile, confirmedProfile, localWrite;
    const first = new Promise((resolve) => {
      firstProfile = resolve;
    });
    const confirmed = new Promise((resolve) => {
      confirmedProfile = resolve;
    });
    const localPending = new Promise((resolve) => {
      localWrite = resolve;
    });
    const stop = watchUserHousehold(
      db,
      "fresh-owner",
      (id) => {
        seen.push(id);
        if (id) confirmedProfile(id);
        else firstProfile();
      },
      (error) => {
        throw error;
      },
    );
    const stopPending = onSnapshot(
      doc(db, "users/fresh-owner"),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites && snap.data()?.householdId)
          localWrite();
      },
    );
    try {
      await first;
      await disableNetwork(db);
      const creation = createHousehold(
        db,
        "fresh-owner",
        "Owner",
        "Hogar nuevo",
      );
      await localPending;
      assert.deepEqual(seen, [""]);
      await enableNetwork(db);
      await creation;
      const id = await confirmed;
      const docs = await getDocsFromServer(
        collection(db, "households", id, "items"),
      );
      assert.equal(docs.docs[0].data().revision, 0);
      assert.deepEqual(seen, ["", id]);
    } finally {
      await enableNetwork(db);
      stop();
      stopPending();
      await db.terminate();
    }
  },
);

test(
  "primer snapshot del inventario compartido espera datos confirmados, sin falso error de versión",
  { timeout: 10000 },
  async () => {
    const db = auth("member");
    let stop;
    try {
      const result = await new Promise((resolve, reject) => {
        stop = watchState(
          db,
          "home",
          (state, revision) => resolve({ state, revision }),
          reject,
        );
      });
      assert.equal(result.revision, 0);
      assert.equal(result.state.products[0].name, "Arroz");
    } finally {
      stop?.();
      await db.terminate();
    }
  },
);

test("reenvío offline después de confirmar en servidor no duplica stock", async () => {
  const db = auth("member");
  const docs = await getDocs(collection(db, "households/home/items"));
  const { state } = decodeState(
    docs.docs.map((d) => ({ id: d.id, data: d.data() })),
  );
  const selected = {
    ...state,
    selections: { rice: { checked: true, quantity: 7, unit: "un" } },
  };
  const change = {
    id: "sync-offline",
    createdAt: 1,
    before: selected,
    after: finishShopping(selected, "offline-purchase", "now"),
  };
  // Enviar primero el check, como ocurre en la cola real.
  await syncChange(db, "home", {
    id: "sync-check",
    createdAt: 0,
    before: state,
    after: selected,
  });
  await syncChange(db, "home", change);
  await syncChange(db, "home", change);
  const product = await getDoc(doc(db, "households/home/items/p_rice"));
  assert.equal(product.data().quantity, 7);
  await assertFails(syncChange(auth("outsider"), "home", change));
});
