import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeState,
  encodeState,
  emptyHousehold,
} from "../src/services/cloudState.ts";
import { invitationCode, normalizeCode } from "../src/services/invitations.ts";
test("codifica y recupera documentos compartidos sin mezclar tipos", () => {
  const state = emptyHousehold();
  state.products.push({
    id: "p",
    name: "Arroz",
    category: "Almacén",
    quantity: 0,
    unit: "un",
    minimumStock: 1,
    updatedAt: "now",
  });
  state.manualItems.push({
    id: "m",
    name: "Jabón",
    category: "Higiene",
    quantity: 1,
    unit: "un",
    checked: true,
  });
  state.selections.p = { quantity: 7, unit: "un", checked: true };
  state.completedOperations.push("op");
  const docs = [...encodeState(state)].map(([id, data]) => ({ id, data }));
  docs.push({ id: "_version", data: { kind: "version", revision: 3 } });
  assert.deepEqual(decodeState(docs), { state, revision: 3 });
});
test("rechaza snapshot incompleto", () => assert.throws(() => decodeState([])));
test("invitaciones tienen 128 bits aleatorios, formato cerrado y normalización", () => {
  const codes = Array.from({ length: 100 }, invitationCode);
  assert.equal(new Set(codes).size, 100);
  assert.ok(codes.every((c) => /^[a-f0-9]{32}$/.test(c)));
  assert.equal(normalizeCode(" ABCD "), "abcd");
});
