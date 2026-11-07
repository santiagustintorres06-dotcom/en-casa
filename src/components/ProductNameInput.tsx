import { useId, useState } from "react";
import {
  productSuggestions,
  type ProductSuggestion,
} from "../services/productSuggestions";
export function ProductNameInput({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (p: ProductSuggestion) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = productSuggestions(value);
  const visible = open && suggestions.length > 0;
  function choose(p: ProductSuggestion) {
    onPick(p);
    setOpen(false);
    setActive(-1);
  }
  return (
    <div className="name-autocomplete">
      <label htmlFor={id}>Nombre</label>
      <input
        id={id}
        name="name"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={`${id}-options`}
        aria-activedescendant={
          visible && active >= 0 ? `${id}-${active}` : undefined
        }
        autoComplete="off"
        required
        autoFocus
        maxLength={80}
        placeholder="Escribí un producto, ej.: desodorante"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && suggestions.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp" && suggestions.length) {
            e.preventDefault();
            setActive((i) => (i + suggestions.length - 1) % suggestions.length);
          } else if (e.key === "Enter" && visible && active >= 0) {
            e.preventDefault();
            choose(suggestions[active]);
          } else if (e.key === "Escape" && visible) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {visible && (
        <ul
          id={`${id}-options`}
          role="listbox"
          aria-label="Productos sugeridos"
        >
          {suggestions.map((p, i) => (
            <li
              id={`${id}-${i}`}
              key={p.name}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
            >
              <b>{p.name}</b>
              <small>
                {p.category} · {p.unit}
              </small>
            </li>
          ))}
        </ul>
      )}
      <small className="muted">
        Elegí una sugerencia o escribí cualquier producto.
      </small>
    </div>
  );
}
