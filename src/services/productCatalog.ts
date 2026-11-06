import type { Product, ProductInput } from "../types/product.ts";
import type { HouseholdState } from "../types/shopping.ts";

export type CatalogProduct = Omit<ProductInput, "quantity"> & { key: string };
export const productCatalog: CatalogProduct[] = [
  {
    key: "arroz",
    name: "Arroz",
    category: "Almacén",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "fideos",
    name: "Fideos",
    category: "Almacén",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "harina",
    name: "Harina",
    category: "Almacén",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "azucar",
    name: "Azúcar",
    category: "Almacén",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "sal",
    name: "Sal",
    category: "Almacén",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "aceite",
    name: "Aceite",
    category: "Almacén",
    unit: "l",
    minimumStock: 1,
  },
  {
    key: "yerba",
    name: "Yerba",
    category: "Almacén",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "cafe",
    name: "Café",
    category: "Almacén",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "tomate-pure",
    name: "Puré de tomate",
    category: "Almacén",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "lentejas",
    name: "Lentejas",
    category: "Almacén",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "galletitas",
    name: "Galletitas",
    category: "Almacén",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "leche",
    name: "Leche",
    category: "Lácteos",
    unit: "l",
    minimumStock: 1,
  },
  {
    key: "yogur",
    name: "Yogur",
    category: "Lácteos",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "queso",
    name: "Queso",
    category: "Lácteos",
    unit: "kg",
    minimumStock: 0.2,
  },
  {
    key: "manteca",
    name: "Manteca",
    category: "Lácteos",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "papa",
    name: "Papa",
    category: "Verdulería",
    unit: "kg",
    minimumStock: 1,
  },
  {
    key: "cebolla",
    name: "Cebolla",
    category: "Verdulería",
    unit: "kg",
    minimumStock: 0.5,
  },
  {
    key: "tomate",
    name: "Tomate",
    category: "Verdulería",
    unit: "kg",
    minimumStock: 0.5,
  },
  {
    key: "banana",
    name: "Banana",
    category: "Verdulería",
    unit: "kg",
    minimumStock: 0.5,
  },
  {
    key: "huevos",
    name: "Huevos",
    category: "Otros",
    unit: "un",
    minimumStock: 6,
  },
  {
    key: "detergente",
    name: "Detergente",
    category: "Limpieza",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "lavandina",
    name: "Lavandina",
    category: "Limpieza",
    unit: "l",
    minimumStock: 1,
  },
  {
    key: "jabon-ropa",
    name: "Jabón para la ropa",
    category: "Limpieza",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "bolsas",
    name: "Bolsas de residuos",
    category: "Limpieza",
    unit: "paquete",
    minimumStock: 1,
  },
  {
    key: "jabon",
    name: "Jabón",
    category: "Higiene",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "desodorante",
    name: "Desodorante",
    category: "Higiene",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "shampoo",
    name: "Shampoo",
    category: "Higiene",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "acondicionador",
    name: "Acondicionador",
    category: "Higiene",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "pasta-dental",
    name: "Pasta dental",
    category: "Higiene",
    unit: "un",
    minimumStock: 1,
  },
  {
    key: "papel-higienico",
    name: "Papel higiénico",
    category: "Higiene",
    unit: "paquete",
    minimumStock: 1,
  },
];
export const starterKeys = ["jabon", "desodorante", "fideos", "arroz"];
export const normalizeProductName = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-AR");
export function alreadyInInventory(
  item: CatalogProduct,
  products: Product[],
): boolean {
  return products.some(
    (p) =>
      p.id === `catalog-${item.key}` ||
      (p.category === item.category &&
        normalizeProductName(p.name) === normalizeProductName(item.name)),
  );
}
export function addCatalogProducts(
  state: HouseholdState,
  keys: string[],
  now: string,
): HouseholdState {
  const wanted = new Set(keys);
  if ([...wanted].some((key) => !productCatalog.some((p) => p.key === key)))
    throw new Error(
      "Hay un producto que ya no está disponible en el catálogo. Volvé a abrirlo.",
    );
  const additions = productCatalog.filter(
    (p) => wanted.has(p.key) && !alreadyInInventory(p, state.products),
  );
  if (!additions.length) return state;
  return {
    ...state,
    products: [
      ...state.products,
      ...additions.map(({ key, ...p }) => ({
        ...p,
        id: `catalog-${key}`,
        quantity: 0,
        updatedAt: now,
      })),
    ],
  };
}
