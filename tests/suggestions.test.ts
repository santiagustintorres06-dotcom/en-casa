import { test } from "node:test";
import assert from "node:assert/strict";
import { productSuggestions } from "../src/services/productSuggestions.ts";
test("d sugiere dentífrico y desodorante con categoría y unidad", () => {
  const list = productSuggestions("d");
  assert.ok(
    list.some(
      (p) =>
        p.name === "Dentífrico" && p.category === "Higiene" && p.unit === "un",
    ),
  );
  assert.ok(list.some((p) => p.name === "Desodorante"));
});
test("tolera tildes, espacios y el alias dentrifico sin inventar productos", () => {
  assert.equal(productSuggestions(" JABON ")[0].name, "Jabón");
  assert.equal(productSuggestions("dentrifico")[0].category, "Higiene");
  assert.deepEqual(productSuggestions(""), []);
  assert.deepEqual(productSuggestions("producto inventado"), []);
});
