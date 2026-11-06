# En casa — Inventario y lista de compras

Inventario local sin cuentas, tarjetas ni servicios pagos. React + Vite + TypeScript + Tailwind CSS. Interfaz en español rioplatense y tema según el sistema.

## Ejecutar

Con Node.js 22.12+ y npm instalados:

```sh
npm ci
npm run dev
```

Abrí la URL que muestra Vite. `npm test` valida la lógica de stock; `npm run build` comprueba TypeScript y genera `dist/`. `npm run preview` sirve el build.

## Probar el inventario

1. Agregá Arroz, categoría Almacén, cantidad 2 kg y mínimo 1 kg.
2. Restá uno: aparece “Stock bajo” y cuenta como faltante. El umbral es inclusivo.
3. Tocá “Se acabó”: queda en cero. Sumá o editá la cantidad para reponerlo.
4. Buscá “arroz”, filtrá categoría y activá “Solo faltantes”.
5. Editá nombre, unidad y cantidades. Recargá: los datos deben seguir.
6. Eliminá un producto con confirmación. Cancelar lo conserva.
7. En Ajustes, exportá el JSON de respaldo.
8. Probá un ancho de 390 px y el tema oscuro del sistema.

## Alcance y almacenamiento

`localStorage`, clave `encasa.household.v2`. Migra automáticamente el inventario de `encasa.inventory.v1`, conservando esa clave anterior como copia. Cada producto tiene `id` (UUID), `name` (1–80 caracteres), `category`, `quantity` (0–100000), `unit`, `minimumStock` (0–100000), `updatedAt` (ISO). Se admiten decimales. Las alertas se derivan del inventario; no hay una segunda copia de productos faltantes.

Carpetas: `components/` interfaz; `hooks/` operaciones; `services/` persistencia y lógica; `types/` esquema. El adaptador de almacenamiento podrá reemplazarse por uno sincronizado.

La lista de compras permite tildar productos, editar cantidades, agregar ítems manuales y terminar una compra. Login, hogar compartido, reglas de Firestore, invitaciones, manifest y service worker son etapas posteriores. No se necesita configurar Firebase ni variables de entorno ahora. No es todavía una PWA instalable ni garantiza abrir sin conexión: conserva datos locales, pero aún necesita cargar la app.

## Seguridad de esta etapa y riesgos residuales

React escapa el contenido; no se usa HTML inyectado ni se incluyen secretos. Se validan nombres, categorías, unidades y rangos numéricos. Un error al escribir almacenamiento se informa y no se confirma como guardado. Si los datos guardados son inválidos se bloquea la escritura para no pisarlos.

Los datos no están cifrados: cualquier persona con acceso al perfil del navegador puede verlos. No usar para información sensible. Limpiar el navegador o usar modo privado puede perder los datos. Exportar respaldo conserva una copia; todavía no existe restauración desde la interfaz. Usar una sola pestaña para editar: se detectan cambios ya guardados desde otra pestaña y se pide recargar. No hay bloqueo transaccional entre pestañas: dos escrituras exactamente simultáneas todavía podrían entrar en conflicto. No hay autenticación, permisos ni sincronización entre dispositivos en esta etapa. La versión final requerirá HTTPS y headers del hosting. No se habilitó facturación ni se creó infraestructura externa.


## Probar la lista de compras (etapa 2)

1. Agregá Arroz con cantidad 1 kg y mínimo 1 kg. Aparece automáticamente en la lista.
2. Cambiá la cantidad a comprar a 2,5 (o 2.5, según el navegador), salí del campo y tildalo.
3. Agregá Jabón como ítem manual, categoría Higiene, cantidad 2 un. Debe aparecer en su categoría.
4. Recargá y volvé a Lista: cantidades y checks se conservan.
5. Tocá “Terminé la compra”, revisá el aviso y confirmá. Arroz queda en 3,5 kg en inventario; Jabón sigue pendiente en la lista.
6. Comprá Jabón: se crea en inventario con cantidad 2 y mínimo 0. No se fusionan automáticamente productos del mismo nombre: un nombre igual puede representar otra marca o presentación.
7. Probá una compra parcial: stock 0, mínimo 2, compra 0,5. Queda en 0,5 y sigue como faltante, destildado.
8. Cancelar el diálogo no modifica el stock. Sin checks, el botón de terminar está deshabilitado.
9. Las cantidades deben ser positivas; no se permite que una compra lleve el stock por encima de 100.000. Si ocurre, no se aplica nada de esa compra y se explica el error.

La cantidad sugerida repone hasta el mínimo más una unidad, limitada por el máximo de stock. Se puede editar. Al editar un producto o ajustar su stock se limpia su selección de compra anterior para evitar aplicar una cantidad o unidad desactualizada.

## Persistencia de compras

El documento local v2 contiene `version`, `products`, `manualItems`, `selections` (por ID de producto: cantidad, unidad y check) y `completedOperations` (IDs de compras procesadas). Faltantes se calculan; no se duplican en almacenamiento. Al finalizar se escribe un único documento con stock, lista y recibo de operación juntos. Repetir el mismo ID de operación no repone dos veces. Esto es idempotencia local, todavía no sincronización distribuida.

Si falla la escritura, se conserva el estado anterior; no se anuncia éxito. El respaldo exportado incluye inventario, lista y operaciones. Si el almacenamiento es inválido, se bloquea su sobrescritura. La copia v1 es histórica y no se sigue actualizando: no usar una versión antigua de la app para editar datos nuevos.

Tests: umbral inclusivo, decimales, compra parcial, manuales, pendientes, idempotencia, cambio de unidad, límites, migración, persistencia de checks, error de escritura y conflicto entre pestañas. Se verificó también el flujo real en navegador: faltante automático → cantidad decimal → compra → recarga → manual pendiente → incorporación al inventario.
