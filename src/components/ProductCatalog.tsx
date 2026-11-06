import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { categories, type Product } from "../types/product";
import {
  alreadyInInventory,
  normalizeProductName,
  productCatalog,
  starterKeys,
} from "../services/productCatalog";

export function ProductCatalog({
  products,
  busy,
  onAdd,
  onClose,
}: {
  products: Product[];
  busy: boolean;
  onAdd: (keys: string[]) => boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set(starterKeys));
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const visible = productCatalog.filter((p) =>
    normalizeProductName(p.name).includes(normalizeProductName(query)),
  );
  const pendingKeys = productCatalog
    .filter((p) => selected.has(p.key) && !alreadyInInventory(p, products))
    .map((p) => p.key);
  function toggle(key: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  return (
    <dialog
      className="catalog-dialog"
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="catalog-title"
    >
      <div className="dialog-header">
        <h2 id="catalog-title">Elegí tus básicos</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar catálogo"
        >
          <X />
        </button>
      </div>
      <p className="muted catalog-intro">
        Elegí los productos que querés seguir en casa. Ya vienen con categoría,
        unidad y stock mínimo; después podés editarlos.
      </p>
      <div className="search">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Buscar productos del catálogo"
          placeholder="Jabón, arroz, shampoo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="catalog-selection">
        <button
          disabled={busy}
          onClick={() =>
            setSelected(
              (previous) =>
                new Set([
                  ...previous,
                  ...visible
                    .filter((p) => !alreadyInInventory(p, products))
                    .map((p) => p.key),
                ]),
            )
          }
        >
          Seleccionar visibles
        </button>
        <button
          disabled={busy || !pendingKeys.length}
          onClick={() => setSelected(new Set())}
        >
          Limpiar selección
        </button>
      </div>
      <div className="catalog-scroll">
        {categories.map((category) => {
          const group = visible.filter((p) => p.category === category);
          return (
            group.length > 0 && (
              <section key={category} className="catalog-group">
                <h3>{category}</h3>
                {group.map((p) => {
                  const exists = alreadyInInventory(p, products);
                  return (
                    <label
                      className={
                        "catalog-item " + (exists ? "catalog-existing" : "")
                      }
                      key={p.key}
                    >
                      <input
                        type="checkbox"
                        disabled={exists || busy}
                        checked={exists || selected.has(p.key)}
                        onChange={() => toggle(p.key)}
                      />
                      <span>
                        <b>{p.name}</b>
                        <small>
                          {exists
                            ? "Ya está en tu inventario"
                            : `${p.unit} · Mínimo ${p.minimumStock.toLocaleString("es-AR")} ${p.unit}`}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </section>
            )
          );
        })}
        {!visible.length && (
          <p className="catalog-no-results">
            No encontramos ese producto. Podés cargarlo con “Agregar producto”.
          </p>
        )}
      </div>
      <div className="catalog-footer">
        <p className="muted">
          Se agregan con cantidad <b>0</b> y aparecen como faltantes. Ajustá el
          stock si ya los tenés.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="primary full"
          disabled={busy || !pendingKeys.length}
          onClick={() => {
            if (onAdd(pendingKeys)) onClose();
            else
              setError(
                "No pudimos cargar los básicos. Revisá el aviso de conexión o almacenamiento.",
              );
          }}
        >
          Agregar {pendingKeys.length}{" "}
          {pendingKeys.length === 1 ? "producto" : "productos"}
        </button>
      </div>
    </dialog>
  );
}
