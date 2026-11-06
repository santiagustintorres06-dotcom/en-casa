# En casa — Etapa 1: inventario

Inventario local sin cuentas, tarjetas ni servicios pagos. React + Vite + TypeScript + Tailwind CSS. Interfaz en español rioplatense y tema según el sistema.

## Ejecutar

Con Node.js 22.12+ y npm instalados:

```sh
npm ci
npm run dev
```

Abrí la URL que muestra Vite. `npm test` valida la lógica de stock; `npm run build` comprueba TypeScript y genera `dist/`. `npm run preview` sirve el build.

## Probar esta etapa

1. Agregá Arroz, categoría Almacén, cantidad 2 kg y mínimo 1 kg.
2. Restá uno: aparece “Stock bajo” y cuenta como faltante. El umbral es inclusivo.
3. Tocá “Se acabó”: queda en cero. Sumá o editá la cantidad para reponerlo.
4. Buscá “arroz”, filtrá categoría y activá “Solo faltantes”.
5. Editá nombre, unidad y cantidades. Recargá: los datos deben seguir.
6. Eliminá un producto con confirmación. Cancelar lo conserva.
7. En Ajustes, exportá el JSON de respaldo.
8. Probá un ancho de 390 px y el tema oscuro del sistema.

## Alcance y almacenamiento

`localStorage`, clave `encasa.inventory.v1`. Cada producto tiene `id` (UUID), `name` (1–80 caracteres), `category`, `quantity` (0–100000), `unit`, `minimumStock` (0–100000), `updatedAt` (ISO). Se admiten decimales. Las alertas se derivan del inventario; no hay una segunda copia de productos faltantes.

Carpetas: `components/` interfaz; `hooks/` operaciones; `services/` persistencia y lógica; `types/` esquema. El adaptador de almacenamiento podrá reemplazarse por uno sincronizado.

La pestaña de compras es una vista previa de faltantes. Compras completas, login, hogar compartido, reglas de Firestore, invitaciones, manifest y service worker son etapas posteriores. No se necesita configurar Firebase ni variables de entorno ahora. No es todavía una PWA instalable ni garantiza abrir sin conexión: conserva datos locales, pero aún necesita cargar la app.

## Seguridad de esta etapa y riesgos residuales

React escapa el contenido; no se usa HTML inyectado ni se incluyen secretos. Se validan nombres, categorías, unidades y rangos numéricos. Un error al escribir almacenamiento se informa y no se confirma como guardado. Si los datos guardados son inválidos se bloquea la escritura para no pisarlos.

Los datos no están cifrados: cualquier persona con acceso al perfil del navegador puede verlos. No usar para información sensible. Limpiar el navegador o usar modo privado puede perder los datos. Exportar respaldo conserva una copia; todavía no existe restauración desde la interfaz. Usar una sola pestaña para editar: todavía no hay resolución de conflictos entre pestañas. No hay autenticación, permisos ni sincronización entre dispositivos en esta etapa. La versión final requerirá HTTPS y headers del hosting. No se habilitó facturación ni se creó infraestructura externa.
