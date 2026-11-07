import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import {
  categories,
  units,
  type Product,
  type ProductInput,
} from "../types/product";
import { ProductNameInput } from "./ProductNameInput";
import { validateProduct } from "../services/stock";
export function ProductForm({
  product,
  onSave,
  onClose,
}: {
  product?: Product;
  onSave: (p: ProductInput) => boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<ProductInput["category"]>(
    product?.category ?? "Almacén",
  );
  const [unit, setUnit] = useState<ProductInput["unit"]>(product?.unit ?? "un");
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p = {
      name: String(f.get("name")),
      category: f.get("category"),
      unit: f.get("unit"),
      quantity: Number(f.get("quantity")),
      minimumStock: Number(f.get("minimumStock")),
    } as ProductInput;
    const invalid = validateProduct(p);
    if (invalid) return setError(invalid);
    if (onSave(p)) onClose();
    else setError("No se pudo guardar. Revisá el aviso de almacenamiento.");
  }
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="form-title">
      <form onSubmit={submit}>
        <div className="dialog-header">
          <h2 id="form-title">
            {product ? "Editar producto" : "Sumá algo a casa"}
          </h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X />
          </button>
        </div>
        <ProductNameInput
          value={name}
          onChange={setName}
          onPick={(p) => {
            setName(p.name);
            setCategory(p.category);
            setUnit(p.unit);
          }}
        />
        <div className="form-grid">
          <label>
            Categoría
            <select
              name="category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ProductInput["category"])
              }
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Unidad
            <select
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as ProductInput["unit"])}
            >
              {units.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            Cantidad actual
            <input
              name="quantity"
              type="number"
              min="0"
              max="100000"
              step="any"
              required
              defaultValue={product?.quantity ?? 1}
            />
          </label>
          <label>
            Stock mínimo
            <input
              name="minimumStock"
              type="number"
              min="0"
              max="100000"
              step="any"
              required
              defaultValue={product?.minimumStock ?? 1}
            />
          </label>
        </div>
        <p className="muted">
          Te avisamos cuando la cantidad llegue al mínimo o quede por debajo.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary full">
          {product ? "Guardar cambios" : "Agregar producto"}
        </button>
      </form>
    </dialog>
  );
}
