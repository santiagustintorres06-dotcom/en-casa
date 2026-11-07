# Revisión de seguridad — PWA y offline

## Controles implementados

- Solo Google Sign-In. Las reglas comprueban `firebase.sign_in_provider == 'google.com'`.
- Denegación por defecto. Cada acceso a datos requiere membresía del hogar activo; las acciones administrativas requieren rol owner.
- Bootstrap atómico de hogar, propietario, puntero del usuario, revisión de datos e invitación. No se permite crear un owner en un hogar existente ni modificar roles.
- Unión validada por reglas: código vigente del hogar, intento previo ligado a ese código y al UID, rol obligatorio member y puntero de usuario escrito en el mismo batch. No existe una escritura libre de membresías.
- Códigos CSPRNG de 128 bits (32 caracteres hexadecimales), vigencia de 48 horas. Solo el owner los rota. Al expulsar a alguien también se rota el código.
- Intentos limitados en el servidor a un código cada 10 segundos por UID. La ventana para usar ese intento es de 30 segundos; `attemptedAt` solo puede escribirse con el timestamp del servidor. El registro no se puede borrar desde el cliente. Las invitaciones no se pueden enumerar.
- Esquemas cerrados en rules: campos extra, roles arbitrarios, cantidades fuera de rango, categorías y unidades desconocidas se rechazan.
- Escrituras de inventario y compras con revisión conjunta y transacción. Una operación antigua no pisa cambios ya confirmados de otro dispositivo. Compra y recibo de operación se guardan juntos.
- Updates optimistas persistidos antes de mostrarse. La cola conserva operaciones rechazadas, informa pendientes y permite exportarlos antes de descartarlos.
- Configuración real exige clave pública de App Check; el bypass de emuladores existe solo en desarrollo sobre loopback y apunta siempre a `demo-encasa`.
- Firestore usa caché de memoria; la copia offline propia y su cola están en localStorage. Al cerrar sesión se detienen listeners, se termina Firestore, se limpia IndexedDB y todas las claves encasa, y se cierra Auth. Se bloquea logout durante un envío y se confirma el descarte de cambios sin enviar.
- React escapa los textos; no se usa `dangerouslySetInnerHTML`. No hay claves privadas ni cuentas de servicio en el repositorio. `.env` y variantes locales quedan ignoradas.
- Headers de Firebase Hosting: CSP, nosniff, Referrer-Policy, Permissions-Policy y HSTS. Firebase Hosting provee HTTPS.

## Verificación

Pruebas locales de lógica y Emulator Suite cubren: usuario sin sesión, proveedor distinto a Google, otro hogar, payloads inválidos/extra, acciones de owner por un member, autoasignación de rol, invitación ausente/vencida, intentos rápidos, unión válida, bootstrap atómico, servicios reales de creación/unión/expulsión, compra de siete unidades e intento de escritura con revisión desactualizada.

`npm audit` incluye desarrollo y producción. Hay overrides explícitos de dependencias transitivas del SDK/CLI (`grpc-js`, OpenTelemetry, glob, minimatch y uuid) para usar versiones corregidas. No eliminar los overrides sin volver a auditar y probar emuladores. El lockfile está versionado; Dependabot está configurado.

## Riesgos y límites residuales

1. **Verificación de producción pendiente.** El proyecto real encasa-5258f ya tiene las reglas publicadas y enforcement de App Check en Firestore. El primer ingreso y la lectura del hogar real quedaron verificados. Aún falta probar la sincronización entre cuentas y el dominio de Hosting. La API key pública quedó restringida por HTTP referrer a los dominios propios y localhost en puertos 5173/4173, y a cinco APIs: Firestore, App Check, Installations, Identity Toolkit y Token Service. Los emuladores no verifican reCAPTCHA ni el OAuth real; se debe probar Google en Safari, Chrome y Edge antes de publicar.
2. **Copia offline privada sin cifrado.** La app guarda el hogar confirmado y una cola durable en localStorage por UID. La misma cuenta del navegador puede acceder a esa copia; usar bloqueo del dispositivo y cerrar sesión en equipos compartidos. El service worker solo precachea archivos estáticos propios, nunca respuestas de Firebase. Logout borra las claves encasa y la persistencia de Firestore; no elimina archivos exportados ni promete borrado forense.
3. **Sin límite global contra múltiples cuentas.** El throttle se aplica por UID. Un atacante con muchas cuentas podría consumir cuota. App Check y códigos de alta entropía reducen ese riesgo, pero no sustituyen un control global de abuso. En Spark, mantener la facturación sin vincular; las cuotas pueden interrumpir el servicio.
4. **Código como capacidad.** Se guarda como identificador del documento de invitación y en el hogar, accesible a sus miembros. No es una contraseña de usuario; quien recibe un código vigente puede unirse. No se almacena un hash porque las reglas gratuitas no calculan hashes ni permiten consultar un índice secreto mediante Functions. No compartir códigos públicamente.
5. **Desactivación, no purga física.** La app marca el hogar `deleted` y bloquea lecturas y escrituras. Los documentos permanecen en Firebase. La purga definitiva es manual desde la consola (incluidas subcolecciones e invitaciones). Se conserva el documento raíz desactivado para impedir que alguien recree el mismo ID y acceda a documentos huérfanos.
6. **Dispositivos previamente autorizados.** Expulsar a un miembro bloquea accesos nuevos; no puede borrar capturas, exportaciones o datos ya descargados por esa persona. Al recibir un error de acceso la app vacía su vista del hogar. Un equipo desconectado puede conservar su copia persistente y exportarla antes de volver a conectarse. La revocación no borra datos ya descargados. Al recibir denegación se elimina la copia confirmada y se bloquea la edición; los pendientes se retienen para exportar.
7. **Edición concurrente.** La revisión evita sobrescrituras silenciosas entre dispositivos. Los deltas de cantidad se fusionan contra la revisión actual. Los conflictos de texto/unidad/borrado detienen la cola y conservan cambios para exportar o descartar explícitamente. No hay resolución gráfica por campo. Web Locks serializa envíos entre pestañas compatibles; revisión y recibo evitan reenvíos duplicados en servidor.
8. **Escala doméstica.** Se escucha una colección de ítems completa por hogar. Los recibos de compra y de cada operación sincronizada crecen con el uso; consumen lecturas y almacenamiento. La importación inicial permite hasta 150 productos/ítems y no marca compras como ya hechas. Compras con más de 450 documentos modificados se rechazan antes de escribir.
9. **Integridad entre integrantes.** Un miembro autorizado puede editar el stock y la lista; los recibos evitan dobles clicks accidentales, no proporcionan un historial contable inviolable frente a otro integrante autorizado.
10. **Borrado local.** Limpiar IndexedDB elimina la caché lógica de la app; no promete borrado forense del disco. Otras pestañas pueden tener datos en memoria hasta recibir el cierre de Auth. Exportar respaldos deja archivos fuera del alcance del logout.
11. **Headers pendientes de prueba real.** La CSP preparada debe verificarse con el dominio de producción, el OAuth real y App Check; la vista Vite no utiliza los headers de Hosting. Vercel necesita configurar headers equivalentes por separado.

## Verificación de esta etapa (7 de noviembre de 2026)

- Build de producción con manifest, íconos y service worker generado; solo precaché de assets propios, sin runtimeCaching de APIs. Recarga verificada con servidor de preview apagado. Falta prueba en iPhone/Chrome/Edge reales y dominio HTTPS publicado.
- 28 tests unitarios y 17 tests de emulador: autorización negativa existente y reenvío de compra de siete unidades sin duplicación; aislamiento/persistencia/limpieza de cola y conflicto de metadatos.
- Logout avisa y requiere confirmación antes de descartar pendientes. No debe usarse para solucionar un error de sincronización sin exportar antes.
- Límite: si el navegador elimina datos por presión de almacenamiento, desinstalación o limpieza manual, se puede perder lo que no llegó al servidor. No se promete sincronización con la app cerrada en iOS.
- npm audit --omit=dev: **0 vulnerabilidades** en dependencias de producción.
- **Auditoría completa no limpia:** npm audit informa 4 alertas bajas en la cadena de compilación vite-plugin-pwa → workbox-build → @rollup/plugin-node-resolve → deepmerge 4.3.1. La [alerta GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) no tiene versión corregida publicada. npm audit fix no las elimina; --force propone degradar la PWA a una versión incompatible. No se ocultaron alertas ni se degradó la seguridad para obtener cero. deepmerge no forma parte del código servido al cliente; no compilar configuraciones o dependencias no confiables. Reauditar cuando upstream publique un parche.
