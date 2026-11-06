import {
  collection,
  doc,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { HouseholdState } from "../types/shopping";
import { decodeState, encodeState } from "./cloudState.ts";
import { invitationCode, normalizeCode } from "./invitations.ts";

export type Household = {
  id: string;
  name: string;
  ownerUid: string;
  inviteCode: string;
  inviteExpiresAt: Timestamp;
  status: "active" | "deleted";
};
export type HouseholdMember = {
  uid: string;
  displayName: string;
  role: "owner" | "member";
};
const invitationExpiry = () =>
  Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000 - 30000);
const displayName = (value: string | null) =>
  (value?.trim() || "Integrante").slice(0, 80);

export async function createHousehold(
  db: Firestore,
  uid: string,
  person: string | null,
  name: string,
) {
  if (!name.trim() || name.trim().length > 80)
    throw new Error("Escribí un nombre de hogar de hasta 80 caracteres.");
  const ref = doc(collection(db, "households"));
  const code = invitationCode(),
    expiresAt = invitationExpiry();
  const batch = writeBatch(db);
  batch.set(ref, {
    name: name.trim(),
    ownerUid: uid,
    inviteCode: code,
    inviteExpiresAt: expiresAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: "active",
  });
  batch.set(doc(ref, "members", uid), {
    role: "owner",
    displayName: displayName(person),
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(ref, "items", "_version"), { kind: "version", revision: 0 });
  batch.set(doc(db, "users", uid), { householdId: ref.id });
  batch.set(doc(db, "invites", code), { householdId: ref.id, expiresAt });
  await batch.commit();
}

export async function joinHousehold(
  db: Firestore,
  uid: string,
  person: string | null,
  input: string,
) {
  const code = normalizeCode(input);
  if (!/^[a-f0-9]{32}$/.test(code))
    throw new Error(
      "El código debe tener 32 letras y números. Copialo tal como te lo compartieron.",
    );
  const attemptRef = doc(db, "joinAttempts", uid);
  const last = await getDocFromServer(attemptRef);
  if (last.exists() && Date.now() - last.data().attemptedAt.toMillis() < 10000)
    throw new Error("Esperá 10 segundos entre intentos de unión.");
  await setDoc(attemptRef, { code, attemptedAt: serverTimestamp() });
  let invite;
  try {
    invite = await getDocFromServer(doc(db, "invites", code));
  } catch (cause) {
    throw new Error(
      "El código no es válido o venció. Pedile uno nuevo al propietario.",
      { cause },
    );
  }
  if (!invite.exists()) throw new Error("El código no es válido o venció.");
  const batch = writeBatch(db),
    id = String(invite.data().householdId);
  const memberRef = doc(db, "households", id, "members", uid);
  const existingMember = await getDocFromServer(memberRef).catch(() => null);
  if (!existingMember?.exists())
    batch.set(memberRef, {
      role: "member",
      displayName: displayName(person),
      joinedAt: serverTimestamp(),
    });
  batch.set(doc(db, "users", uid), { householdId: id });
  await batch.commit();
}

export async function rotateInvitation(
  db: Firestore,
  home: Household,
  expelUid?: string,
) {
  const code = invitationCode(),
    expiresAt = invitationExpiry();
  const batch = writeBatch(db);
  batch.update(doc(db, "households", home.id), {
    inviteCode: code,
    inviteExpiresAt: expiresAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, "invites", code), { householdId: home.id, expiresAt });
  batch.delete(doc(db, "invites", home.inviteCode));
  if (expelUid)
    batch.delete(doc(db, "households", home.id, "members", expelUid));
  await batch.commit();
}

export async function deactivateHousehold(db: Firestore, home: Household) {
  const batch = writeBatch(db);
  batch.update(doc(db, "households", home.id), {
    status: "deleted",
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, "invites", home.inviteCode));
  await batch.commit();
}

// Local latency-compensated pointers can announce a household before its membership exists
// on the server. Wait for acknowledgement (including metadata-only acknowledgements).
export function watchUserHousehold(
  db: Firestore,
  uid: string,
  next: (householdId: string) => void,
  error: (e: Error) => void,
) {
  return onSnapshot(
    doc(db, "users", uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache)
        return;
      next(snapshot.data()?.householdId ?? "");
    },
    error,
  );
}

export function watchState(
  db: Firestore,
  id: string,
  next: (state: HouseholdState, revision: number) => void,
  error: (e: Error) => void,
) {
  return onSnapshot(
    collection(db, "households", id, "items"),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache)
        return;
      try {
        const decoded = decodeState(
          snapshot.docs.map((d) => ({ id: d.id, data: d.data() })),
        );
        next(decoded.state, decoded.revision);
      } catch (e) {
        error(
          e instanceof Error
            ? e
            : new Error("No pudimos leer el inventario compartido."),
        );
      }
    },
    error,
  );
}

export async function saveSharedState(
  db: Firestore,
  id: string,
  before: HouseholdState,
  after: HouseholdState,
  revision: number,
) {
  const oldDocs = encodeState(before),
    newDocs = encodeState(after);
  const changed = [...newDocs].filter(
    ([key, value]) =>
      JSON.stringify(oldDocs.get(key)) !== JSON.stringify(value),
  );
  const removed = [...oldDocs.keys()].filter((key) => !newDocs.has(key));
  if (changed.length + removed.length > 450)
    throw new Error(
      "Esta operación modifica demasiados productos. Importá un inventario de hasta 150 productos o dividí la compra.",
    );
  await runTransaction(db, async (transaction) => {
    const versionRef = doc(db, "households", id, "items", "_version");
    const current = await transaction.get(versionRef);
    if (current.data()?.revision !== revision)
      throw new Error(
        "Otro integrante actualizó el hogar. Se actualizó la vista; repetí tu cambio.",
      );
    changed.forEach(([key, value]) =>
      transaction.set(doc(db, "households", id, "items", key), value),
    );
    removed.forEach((key) =>
      transaction.delete(doc(db, "households", id, "items", key)),
    );
    transaction.update(versionRef, { revision: revision + 1 });
  });
}

export function cloudError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("popup-blocked"))
    return "El navegador bloqueó la ventana de Google. Permití la ventana y volvé a tocar Ingresar.";
  if (code.includes("popup-closed"))
    return "Se cerró la ventana de Google. Podés intentar de nuevo.";
  if (code.includes("unauthorized-domain"))
    return "Falta autorizar este dominio en Firebase Auth. Revisá el setup del README.";
  if (code.includes("permission-denied"))
    return "Firebase rechazó el acceso al hogar. Tocá Reintentar conexión. Si persiste, hay que revisar la membresía o App Check.";
  if (code.includes("resource-exhausted"))
    return "Se alcanzó la cuota gratuita de Firebase. Esperá a que se renueve; no hace falta activar facturación.";
  if (code.includes("unavailable") || code.includes("network-request-failed"))
    return "No pudimos conectar. Revisá Internet y volvé a intentar.";
  return error instanceof Error
    ? error.message
    : "No pudimos completar la operación.";
}
