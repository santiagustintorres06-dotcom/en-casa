import { test } from "node:test";
import assert from "node:assert/strict";
import { productSuggestions } from "../src/services/productSuggestions.ts";
import { productCatalog } from "../src/services/productCatalog.ts";
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
test("sugiere conservas con tildes, plurales y nombres alternativos", () => {
  for (const [query, name] of [
    ["arv", "Arvejas"],
    ["atun", "Atún"],
    ["choclos", "Choclo en lata"],
    ["maiz", "Choclo en lata"],
    ["muzzarella", "Queso mozzarella"],
  ]) {
    assert.ok(
      productSuggestions(query).some((p) => p.name === name),
      `${query} debe sugerir ${name}`,
    );
  }
});
test("todos los productos del catálogo se pueden encontrar por su nombre", () => {
  for (const item of productCatalog) {
    assert.ok(
      productSuggestions(item.name).some((p) => p.name === item.name),
      item.name,
    );
  }
  assert.ok(productSuggestions("a").length <= 6);
});
test("tolera tildes, espacios y el alias dentrifico sin inventar productos", () => {
  assert.equal(productSuggestions(" JABON ")[0].name, "Jabón");
  assert.equal(productSuggestions("dentrifico")[0].category, "Higiene");
  assert.deepEqual(productSuggestions(""), []);
  assert.deepEqual(productSuggestions("producto inventado"), []);
});
