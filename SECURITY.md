# Revisión de seguridad — etapa 3

## Controles implementados

- Solo Google Sign-In. Las reglas comprueban `firebase.sign_in_provider == 'google.com'`.
- Denegación por defecto. Cada acceso a datos requiere membresía del hogar activo; las acciones administrativas requieren rol owner.
- Bootstrap atómico de hogar, propietario, puntero del usuario, revisión de datos e invitación. No se permite crear un owner en un hogar existente ni modificar roles.
- Unión validada por reglas: código vigente del hogar, intento previo ligado a ese código y al UID, rol obligatorio member y puntero de usuario escrito en el mismo batch. No existe una escritura libre de membresías.
- Códigos CSPRNG de 128 bits (32 caracteres hexadecimales), vigencia de 48 horas. Solo el owner los rota. Al expulsar a alguien también se rota el código.
- Intentos limitados en el servidor a un código cada 10 segundos por UID. La ventana para usar ese intento es de 30 segundos; `attemptedAt` solo puede escribirse con el timestamp del servidor. El registro no se puede borrar desde el cliente. Las invitaciones no se pueden enumerar.
- Esquemas cerrados en rules: campos extra, roles arbitrarios, cantidades fuera de rango, categorías y unidades desconocidas se rechazan.
- Escrituras de inventario y compras con revisión conjunta y transacción. Una operación antigua no pisa cambios ya confirmados de otro dispositivo. Compra y recibo de operación se guardan juntos.
- Updates optimistas con indicador de guardado y reversión si el servidor rechaza la operación. Se bloquea una segunda escritura mientras se confirma la primera.
- Configuración real exige clave pública de App Check; el bypass de emuladores existe solo en desarrollo sobre loopback y apunta siempre a `demo-encasa`.
- Firebase usa caché de memoria en esta etapa. Al cerrar sesión se detienen listeners, se termina Firestore, se limpia su persistencia IndexedDB y las dos claves de datos locales de la app, y se cierra Auth. Se bloquea logout mientras hay una escritura de inventario pendiente.
- React escapa los textos; no se usa `dangerouslySetInnerHTML`. No hay claves privadas ni cuentas de servicio en el repositorio. `.env` y variantes locales quedan ignoradas.
- Headers de Firebase Hosting: CSP, nosniff, Referrer-Policy, Permissions-Policy y HSTS. Firebase Hosting provee HTTPS.

## Verificación

Pruebas locales de lógica y Emulator Suite cubren: usuario sin sesión, proveedor distinto a Google, otro hogar, payloads inválidos/extra, acciones de owner por un member, autoasignación de rol, invitación ausente/vencida, intentos rápidos, unión válida, bootstrap atómico, servicios reales de creación/unión/expulsión, compra de siete unidades e intento de escritura con revisión desactualizada.

`npm audit` incluye desarrollo y producción. Hay overrides explícitos de dependencias transitivas del SDK/CLI (`grpc-js`, OpenTelemetry, glob, minimatch y uuid) para usar versiones corregidas. No eliminar los overrides sin volver a auditar y probar emuladores. El lockfile está versionado; Dependabot está configurado.

## Riesgos y límites residuales

1. **Configuración externa pendiente.** No se creó ni desplegó un proyecto real. Hay que publicar las reglas y activar enforcement de App Check en la consola. La API key pública debe restringirse por HTTP referrer y por APIs utilizadas. Los emuladores no verifican reCAPTCHA ni el OAuth real; se debe probar Google en Safari, Chrome y Edge antes de publicar.
2. **No es todavía la etapa PWA/offline.** En modo compartido se requiere conexión para escribir y las transacciones no se encolan offline. El modo local sigue usando localStorage. No existe aún service worker, manifest ni caché persistente de datos compartidos.
3. **Sin límite global contra múltiples cuentas.** El throttle se aplica por UID. Un atacante con muchas cuentas podría consumir cuota. App Check y códigos de alta entropía reducen ese riesgo, pero no sustituyen un control global de abuso. En Spark, mantener la facturación sin vincular; las cuotas pueden interrumpir el servicio.
4. **Código como capacidad.** Se guarda como identificador del documento de invitación y en el hogar, accesible a sus miembros. No es una contraseña de usuario; quien recibe un código vigente puede unirse. No se almacena un hash porque las reglas gratuitas no calculan hashes ni permiten consultar un índice secreto mediante Functions. No compartir códigos públicamente.
5. **Desactivación, no purga física.** La app marca el hogar `deleted` y bloquea lecturas y escrituras. Los documentos permanecen en Firebase. La purga definitiva es manual desde la consola (incluidas subcolecciones e invitaciones). Se conserva el documento raíz desactivado para impedir que alguien recree el mismo ID y acceda a documentos huérfanos.
6. **Dispositivos previamente autorizados.** Expulsar a un miembro bloquea accesos nuevos; no puede borrar capturas, exportaciones o datos ya descargados por esa persona. Al recibir un error de acceso la app vacía su vista del hogar. Un equipo desconectado puede conservar temporalmente lo que ya tenía en memoria.
7. **Edición concurrente.** La revisión evita sobrescrituras silenciosas entre dispositivos. Ante conflicto, se recupera la vista del servidor y se pide repetir el cambio; aún no hay fusión por campo. La protección local entre pestañas sigue siendo best effort.
8. **Escala doméstica.** Se escucha una colección de ítems completa por hogar. Los recibos de compra crecen con el uso; consumen lecturas y almacenamiento. La importación inicial permite hasta 150 productos/ítems y no marca compras como ya hechas. Compras con más de 450 documentos modificados se rechazan antes de escribir.
9. **Integridad entre integrantes.** Un miembro autorizado puede editar el stock y la lista; los recibos evitan dobles clicks accidentales, no proporcionan un historial contable inviolable frente a otro integrante autorizado.
10. **Borrado local.** Limpiar IndexedDB elimina la caché lógica de la app; no promete borrado forense del disco. Otras pestañas pueden tener datos en memoria hasta recibir el cierre de Auth. Exportar respaldos deja archivos fuera del alcance del logout.
11. **Headers pendientes de prueba real.** La CSP preparada debe verificarse con el dominio de producción, el OAuth real y App Check; la vista Vite no utiliza los headers de Hosting. Vercel necesita configurar headers equivalentes por separado.
