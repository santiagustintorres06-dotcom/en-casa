import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Plus, ShoppingBasket, Trash2, X } from "lucide-react";
import { categories, units } from "../types/product";
import type { ManualItem, ShoppingRow } from "../types/shopping";
import { validateProduct } from "../services/stock";
import { ProductNameInput } from "./ProductNameInput";
import type { ProductInput } from "../types/product";

type Props = {
  rows: ShoppingRow[];
  onChange: (
    row: ShoppingRow,
    change: { checked?: boolean; quantity?: number },
  ) => boolean;
  onAdd: (item: Omit<ManualItem, "id" | "checked">) => boolean;
  onRemove: (id: string) => boolean;
  onFinish: (operationId: string) => boolean;
};
const format = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 3 });

function Quantity({
  row,
  onChange,
}: Pick<Props, "onChange"> & { row: ShoppingRow }) {
  const [value, setValue] = useState(String(row.quantity));
  const [error, setError] = useState("");
  useEffect(() => {
    setValue(String(row.quantity));
  }, [row.quantity]);
  function save() {
    const quantity = Number(value);
    if (
      !value ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 100000
    ) {
      setError("Usá una cantidad mayor a 0 y hasta 100.000.");
      setValue(String(row.quantity));
      return;
    }
    setError("");
    if (quantity !== row.quantity && !onChange(row, { quantity }))
      setValue(String(row.quantity));
  }
  return (
    <div className="buy-quantity">
      <label>
        <span className="sr-only">Cantidad a comprar de {row.name}</span>
        <input
          type="number"
          inputMode="decimal"
          min="0.001"
          max="100000"
          step="any"
          required
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <span>{row.unit}</span>
      </label>
      {error && (
        <small role="alert" className="quantity-error">
          {error}
        </small>
      )}
    </div>
  );
}

function ManualForm({
  onSave,
  onClose,
}: {
  onSave: Props["onAdd"];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductInput["category"]>("Almacén");
  const [unit, setUnit] = useState<ProductInput["unit"]>("un");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const item = {
      name: String(data.get("name")).trim(),
      category: data.get("category"),
      unit: data.get("unit"),
      quantity: Number(data.get("quantity")),
    } as Omit<ManualItem, "id" | "checked">;
    const invalid = validateProduct({ ...item, minimumStock: 0 });
    if (invalid || item.quantity <= 0)
      return setError(invalid ?? "La cantidad debe ser mayor a cero.");
    if (onSave(item)) onClose();
    else setError("No se pudo guardar. Revisá el aviso de almacenamiento.");
  }
  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="manual-title">
      <form onSubmit={submit}>
        <div className="dialog-header">
          <h2 id="manual-title">Sumá algo a la lista</h2>
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
        <div className="form-grid">
          <label>
            Cantidad a comprar
            <input
              name="quantity"
              type="number"
              inputMode="decimal"
              min="0.001"
              max="100000"
              step="any"
              defaultValue={1}
              required
            />
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
        </div>
        <p className="muted">
          Cuando lo compres, lo sumamos al inventario con stock mínimo 0.
          Después podés editarlo.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary full">Agregar a la lista</button>
      </form>
    </dialog>
  );
}

function FinishDialog({
  count,
  onFinish,
  onClose,
}: {
  count: number;
  onFinish: Props["onFinish"];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [operationId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="finish-title">
      <div className="dialog-header">
        <h2 id="finish-title">¿Guardamos la compra?</h2>
        <button className="icon-button" onClick={onClose} aria-label="Cerrar">
          <X />
        </button>
      </div>
      <p className="checkout-description">
        Vamos a sumar al inventario las cantidades de {count}{" "}
        {count === 1 ? "producto tildado" : "productos tildados"}. Lo que no
        compraste queda en la lista.
      </p>
      <p className="muted checkout-description">
        Si compraste menos de lo necesario, el producto seguirá apareciendo como
        faltante.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="checkout-actions">
        <button autoFocus className="secondary" onClick={onClose}>
          Seguir comprando
        </button>
        <button
          className="primary"
          disabled={busy || !count}
          onClick={() => {
            setBusy(true);
            if (onFinish(operationId)) onClose();
            else {
              setError(
                "No se guardó la compra. Revisá el aviso de error e intentá de nuevo.",
              );
              setBusy(false);
            }
          }}
        >
          Confirmar compra
        </button>
      </div>
    </dialog>
  );
}

export function ShoppingList({
  rows,
  onChange,
  onAdd,
  onRemove,
  onFinish,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [notice, setNotice] = useState("");
  const checked = rows.filter((row) => row.checked).length;
  return (
    <>
      <section className="inventory shopping">
        <div className="inventory-title">
          <h2>
            Lista de compras <span>{rows.length}</span>
          </h2>
          <button className="secondary" onClick={() => setAdding(true)}>
            <Plus size={18} />
            Agregar ítem
          </button>
        </div>
        <p className="muted shopping-help">
          Los faltantes se agregan solos. Ajustá cuánto vas a comprar y tildá lo
          que ya tenés en el changuito.
        </p>
        <p role="status" className={notice ? "shopping-success" : "sr-only"}>
          {notice}
        </p>
        {rows.length ? (
          <>
            <div className="shopping-progress">
              <span>
                {checked} de {rows.length} en el changuito
              </span>
              <progress
                aria-label="Progreso de compra"
                max={rows.length}
                value={checked}
              />
            </div>
            {categories.map((category) => {
              const group = rows
                .filter((row) => row.category === category)
                .sort((a, b) => a.name.localeCompare(b.name, "es"));
              return (
                group.length > 0 && (
                  <section className="shopping-group" key={category}>
                    <h3>
                      {category}
                      <small>{group.length}</small>
                    </h3>
                    {group.map((row) => (
                      <div
                        className={
                          "shopping-row " + (row.checked ? "bought" : "")
                        }
                        key={`${row.source}-${row.id}`}
                      >
                        <label className="shopping-check">
                          <input
                            type="checkbox"
                            checked={row.checked}
                            onChange={(e) =>
                              onChange(row, { checked: e.target.checked })
                            }
                          />
                          <span>
                            <b>{row.name}</b>
                            <small>
                              {row.source === "manual"
                                ? "Agregado a mano"
                                : `${format(row.currentStock ?? 0)} ${row.unit} en casa`}
                            </small>
                          </span>
                        </label>
                        <Quantity row={row} onChange={onChange} />
                        {row.source === "manual" && (
                          <button
                            className="icon-button remove-manual"
                            aria-label={`Quitar ${row.name} de la lista`}
                            onClick={() => onRemove(row.id)}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </section>
                )
              );
            })}
            <div className="shopping-finish">
              <p>
                <Check size={18} />
                {checked
                  ? `${checked} ${checked === 1 ? "producto listo" : "productos listos"} para guardar`
                  : "Tildá lo que vayas comprando"}
              </p>
              <button
                className="primary"
                disabled={!checked}
                onClick={() => setFinishing(true)}
              >
                Terminé la compra
              </button>
            </div>
          </>
        ) : (
          <div className="empty">
            <ShoppingBasket size={40} />
            <h3>Por acá no falta nada</h3>
            <p>
              Los productos en el mínimo o por debajo van a aparecer acá.
              También podés agregar algo a mano.
            </p>
            <button className="primary" onClick={() => setAdding(true)}>
              <Plus size={18} />
              Agregar a la lista
            </button>
          </div>
        )}
      </section>
      {adding && (
        <ManualForm onClose={() => setAdding(false)} onSave={onAdd} />
      )}{" "}
      {finishing && (
        <FinishDialog
          count={checked}
          onClose={() => setFinishing(false)}
          onFinish={(id) => {
            const ok = onFinish(id);
            if (ok)
              setNotice("¡Compra guardada! Ya actualizamos el stock de casa.");
            return ok;
          }}
        />
      )}
    </>
  );
}
