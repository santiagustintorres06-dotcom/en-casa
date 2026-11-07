import { useState } from "react";
import {
  House,
  Package,
  ShoppingBasket,
  Settings2,
  Plus,
  Search,
  Minus,
  Pencil,
  Trash2,
  Leaf,
  Check,
  CircleAlert,
} from "lucide-react";
import { useInventory } from "./hooks/useInventory";
import { categories, type Product } from "./types/product";
import { isLowStock } from "./services/stock";
import { ProductForm } from "./components/ProductForm";
import { ProductCatalog } from "./components/ProductCatalog";
import { ShoppingList } from "./components/ShoppingList";
import { PwaStatus } from "./components/PwaStatus";
import { HouseholdSettings } from "./components/HouseholdSettings";
import { useHousehold, type HouseholdController } from "./hooks/useHousehold";
const icons: Record<string, string> = {
  Almacén: "🥫",
  Lácteos: "🥛",
  Verdulería: "🥬",
  Carnicería: "🥩",
  Congelados: "🧊",
  Bebidas: "🧃",
  Limpieza: "🧽",
  Higiene: "🧴",
  Otros: "📦",
};
const fmt = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 3 });
export default function App() {
  const cloud = useHousehold();
  return <InventoryApp key={cloud.id || "local"} cloud={cloud} />;
}
function InventoryApp({ cloud }: { cloud: HouseholdController }) {
  const inv = useInventory(cloud.port);
  const [tab, setTab] = useState("Inventario");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const canEdit = cloud.id ? cloud.ready && !cloud.pending : !cloud.loading;
  const low = inv.products.filter(isLowStock);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es-AR");
  const shown = inv.products
    .filter(
      (p) =>
        normalize(p.name).includes(normalize(search)) &&
        (category === "Todas" || p.category === category) &&
        (!lowOnly || isLowStock(p)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  function exportBackup() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(inv.state, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "en-casa-respaldo.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">
            <House size={23} />
          </span>
          <span>
            en casa<span className="brand-dot">.</span>
          </span>
        </div>
        <span className="local-badge">
          <span />
          {cloud.id
            ? cloud.pending
              ? "Guardando en el hogar…"
              : cloud.loading
                ? "Conectando con el hogar…"
                : !cloud.ready
                  ? "Sin acceso al hogar"
                  : !cloud.online
                    ? "Sin conexión"
                    : cloud.syncing
                      ? "Sincronizando…"
                      : cloud.queuedCount
                        ? `${cloud.queuedCount} cambios pendientes`
                        : "Hogar sincronizado"
            : "Guardado en este dispositivo"}
        </span>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="house-label">MI ESPACIO</div>
          <div className="house-name">
            {cloud.home?.name ?? "Nuestro hogar"} <Leaf size={17} />
          </div>
          <nav>
            {[
              ["Inventario", Package],
              ["Lista de compras", ShoppingBasket],
              ["Ajustes del hogar", Settings2],
            ].map(([label, Icon]) => {
              const C = Icon as typeof Package;
              return (
                <button
                  key={String(label)}
                  className={tab === label ? "selected" : ""}
                  onClick={() => setTab(String(label))}
                >
                  <C size={21} />
                  <span>{String(label)}</span>
                  {label === "Inventario" && (
                    <small>{inv.products.length}</small>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-note">
            <Leaf />
            <p>
              Un hogar organizado,
              <br />
              una compra más simple.
            </p>
            <small>De a poquito, todo en su lugar.</small>
          </div>
        </aside>
        <main>
          <PwaStatus pendingChanges={cloud.queuedCount} />
          <div className="eyebrow">MENOS VUELTAS, MÁS EN CASA</div>
          <div className="page-heading">
            <div>
              <h1>
                {tab === "Inventario"
                  ? "Tu despensa, a mano."
                  : tab === "Lista de compras"
                    ? "Lo que está faltando."
                    : "Tu hogar, tu espacio."}
              </h1>
              <p className="subtitle">
                {tab === "Inventario"
                  ? "Sabé qué tenés y qué hace falta reponer."
                  : tab === "Lista de compras"
                    ? "Tu próxima compra, ordenada por pasillo."
                    : "Organizate con quienes viven con vos."}
              </p>
            </div>
            {tab === "Inventario" && (
              <div className="inventory-actions">
                <button
                  className="secondary"
                  disabled={!canEdit}
                  onClick={() => setCatalogOpen(true)}
                >
                  <Package size={18} />
                  Cargar básicos
                </button>
                <button
                  className="primary add"
                  disabled={
                    cloud.id ? !cloud.ready || cloud.pending : cloud.loading
                  }
                  onClick={() => setEditing("new")}
                >
                  <Plus size={20} /> Agregar producto
                </button>
              </div>
            )}
          </div>
          {inv.error && tab !== "Ajustes del hogar" && (
            <p role="alert" className="error">
              {inv.error}
            </p>
          )}
          <p className="sr-only" role="status">
            {cloud.id && cloud.pending
              ? "Guardando cambios en el hogar"
              : notice}
          </p>
          {cloud.id && !cloud.online && (
            <p role="status" className="stage-note">
              Sin conexión. Tus cambios quedan en este dispositivo y se envían
              cuando vuelva la conexión y abras la app.
            </p>
          )}
          {cloud.id && !cloud.ready && tab !== "Ajustes del hogar" && (
            <section className="inventory settings" role="status">
              <h2>
                {cloud.loading
                  ? "Conectando con tu hogar…"
                  : "No pudimos abrir el hogar"}
              </h2>
              <p>
                {cloud.loading
                  ? "Estamos esperando la confirmación de Firebase. Tus datos locales siguen guardados."
                  : "La conexión se interrumpió. Podés volver a cargar el hogar sin cerrar sesión ni borrar tus datos."}
              </p>
              <button
                className="secondary"
                disabled={cloud.loading || cloud.pending}
                onClick={cloud.retryConnection}
              >
                Reintentar conexión
              </button>
            </section>
          )}
          {tab === "Inventario" && (!cloud.id || cloud.ready) && (
            <>
              <section className="stats">
                <div>
                  <span className="stat-icon">
                    <Package />
                  </span>
                  <div>
                    <strong>{inv.products.length}</strong>
                    <p>Productos en casa</p>
                  </div>
                </div>
                <div>
                  <span className="stat-icon amber">
                    <CircleAlert />
                  </span>
                  <div>
                    <strong>
                      {low.length}
                      <small> para reponer</small>
                    </strong>
                    <p>En el mínimo o por debajo</p>
                  </div>
                </div>
                <div>
                  <span className="stat-icon green">
                    <Check />
                  </span>
                  <div>
                    <strong>{inv.products.length - low.length}</strong>
                    <p>Con stock suficiente</p>
                  </div>
                </div>
              </section>
              {low.length > 0 && (
                <div className="replenish">
                  <CircleAlert size={21} />
                  <p>
                    <b>
                      Hay {low.length}{" "}
                      {low.length === 1 ? "producto para" : "productos para"}{" "}
                      reponer.
                    </b>{" "}
                    Que no te falte lo de todos los días.
                  </p>
                  <button
                    onClick={() => {
                      setLowOnly(true);
                      setCategory("Todas");
                      setSearch("");
                    }}
                  >
                    Ver faltantes <span>→</span>
                  </button>
                </div>
              )}
              <section className="inventory">
                <div className="inventory-title">
                  <h2>
                    Inventario <span>{inv.products.length}</span>
                  </h2>
                  <span className="muted desktop">Todo lo que hay en casa</span>
                </div>
                <div className="toolbar">
                  <div className="search">
                    <Search size={19} />
                    <input
                      aria-label="Buscar productos"
                      placeholder="Buscá en tu despensa…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <button
                    className={"filter-low " + (lowOnly ? "active" : "")}
                    aria-pressed={lowOnly}
                    onClick={() => setLowOnly(!lowOnly)}
                  >
                    <CircleAlert size={17} />
                    Solo faltantes
                  </button>
                </div>
                <div className="chips" aria-label="Filtrar por categoría">
                  {["Todas", ...categories].map((c) => (
                    <button
                      key={c}
                      className={category === c ? "active" : ""}
                      aria-pressed={category === c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {shown.length ? (
                  <div className="product-grid">
                    {shown.map((p) => (
                      <article className="product" key={p.id}>
                        <div className="product-top">
                          <span className="product-emoji" aria-hidden="true">
                            {icons[p.category]}
                          </span>
                          <span
                            className={"status " + (isLowStock(p) ? "low" : "")}
                          >
                            {isLowStock(p)
                              ? p.quantity === 0
                                ? "Se acabó"
                                : "Stock bajo"
                              : "En stock"}
                          </span>
                        </div>
                        <h3>{p.name}</h3>
                        <p className="category">
                          {p.category}{" "}
                          <span>
                            · Mínimo {fmt(p.minimumStock)} {p.unit}
                          </span>
                        </p>
                        <div className="quantity-row">
                          <div>
                            <strong>{fmt(p.quantity)}</strong>
                            <span> {p.unit}</span>
                          </div>
                          <div className="stepper">
                            <button
                              aria-label={`Restar cantidad de ${p.name}`}
                              disabled={p.quantity === 0}
                              onClick={() => inv.adjust(p.id, -1)}
                            >
                              <Minus size={17} />
                            </button>
                            <button
                              aria-label={`Sumar cantidad de ${p.name}`}
                              disabled={p.quantity === 100000}
                              onClick={() => inv.adjust(p.id, 1)}
                            >
                              <Plus size={17} />
                            </button>
                          </div>
                        </div>
                        <div className="product-bottom">
                          <button
                            disabled={p.quantity === 0}
                            onClick={() => {
                              if (inv.empty(p.id))
                                setNotice(`${p.name}: marcado como agotado`);
                            }}
                          >
                            <CircleAlert size={15} /> Se acabó
                          </button>
                          <div>
                            <button
                              aria-label={`Editar ${p.name}`}
                              onClick={() => setEditing(p)}
                            >
                              <Pencil size={17} />
                            </button>
                            <button
                              aria-label={`Eliminar ${p.name}`}
                              onClick={() => setDeleting(p)}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <span className="empty-icon">
                      <Package size={37} />
                    </span>
                    <h3>
                      {inv.products.length
                        ? "No encontramos productos"
                        : "Hacé lugar para lo de todos los días"}
                    </h3>
                    <p>
                      {inv.products.length
                        ? "Probá otra búsqueda o cambiá los filtros."
                        : "Agregá tu primer producto. Un paquete de arroz es un buen comienzo."}
                    </p>
                    {!inv.products.length && (
                      <button
                        className="primary"
                        onClick={() => setEditing("new")}
                      >
                        <Plus size={19} />
                        Agregar mi primer producto
                      </button>
                    )}
                  </div>
                )}
                <footer className="inventory-footer">
                  <span>
                    {shown.length}{" "}
                    {shown.length === 1 ? "producto" : "productos"}
                  </span>
                  <span>
                    <span className="green-dot" />{" "}
                    {cloud.id
                      ? cloud.pending
                        ? "Guardando…"
                        : "Hogar compartido"
                      : "Guardado local"}
                  </span>
                </footer>
              </section>
              <p className="footnote">
                <Leaf size={15} /> Tenerlo a mano también ayuda a desperdiciar
                menos.
              </p>
            </>
          )}
          {tab === "Lista de compras" && (!cloud.id || cloud.ready) && (
            <ShoppingList
              rows={inv.rows}
              onChange={inv.updateShopping}
              onAdd={inv.addManual}
              onRemove={inv.removeManual}
              onFinish={inv.finish}
            />
          )}
          {tab === "Ajustes del hogar" && (
            <HouseholdSettings cloud={cloud} onExport={exportBackup} />
          )}
        </main>
      </div>
      {catalogOpen && (
        <ProductCatalog
          products={inv.products}
          busy={!canEdit}
          onClose={() => setCatalogOpen(false)}
          onAdd={(keys) => {
            const ok = inv.addFromCatalog(keys);
            if (ok) setNotice("Productos básicos agregados al inventario");
            return ok;
          }}
        />
      )}
      {editing && (
        <ProductForm
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            const ok = inv.upsert(
              p,
              editing === "new" ? undefined : editing.id,
            );
            if (ok) setNotice("Producto guardado");
            return ok;
          }}
        />
      )}{" "}
      {deleting && (
        <div className="confirm-backdrop">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="confirm"
          >
            <h2 id="delete-title">¿Borramos {deleting.name}?</h2>
            <p>Se va a eliminar del inventario.</p>
            <div>
              <button
                autoFocus
                className="secondary"
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button
                className="danger"
                onClick={() => {
                  if (inv.remove(deleting.id)) {
                    setNotice("Producto eliminado");
                    setDeleting(null);
                  }
                }}
              >
                Eliminar producto
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
