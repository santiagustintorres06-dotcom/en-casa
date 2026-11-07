# Desarrollo y configuración

## Ejecutar y verificar

Usar Node.js 24 LTS, npm y Java 21+ (para los emuladores):

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:rules
npm audit
```

`npm run preview` sirve el build. `npm run format` aplica formato al código. No se necesitan credenciales reales para los tests: usan `demo-encasa` en localhost y nunca tu base de producción. Los errores PERMISSION_DENIED que imprimen los tests negativos son esperados.

Los tests de reglas cierran sus suscripciones; Node usa `--test-force-exit` después de completar todos los tests y hooks porque el SDK del emulador puede conservar canales gRPC residuales. No omite aserciones ni errores de tests.

En Windows, si Java devuelve `Unable to establish loopback connection`, usá una carpeta temporal local corta y válida y configurá `JAVA_TOOL_OPTIONS` con `-Djdk.net.unixdomain.tmpdir="RUTA_TEMPORAL" -Djava.io.tmpdir="RUTA_TEMPORAL"`. No cambies certificados, firewall ni protecciones de red para resolverlo. `FIREBASE_EMULATORS_PATH` permite elegir dónde guardar los emuladores descargados.

## Setup de Firebase sin facturación

1. En [Firebase Console](https://console.firebase.google.com/) creá un proyecto en **Spark**, sin vincular una cuenta de facturación ni pasar a Blaze. No hace falta activar Analytics. Si la consola ofrece opciones de pago, no las habilites: este flujo no requiere Functions, Storage ni servicios pagos.
2. Registrá una aplicación web en Configuración del proyecto. Copiá `.env.example` a `.env.local` y completá `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID` con la configuración web pública que muestra Firebase. No uses claves privadas ni JSON de cuentas de servicio.
3. Authentication → Sign-in method: habilitá **solo Google**, con tu correo de soporte. En Authorized domains dejá únicamente los dominios que usa tu aplicación en producción (incluido el authDomain) y los de desarrollo necesarios: localhost y 127.0.0.1. No agregues dominios comodín o de terceros. El navegador del iPhone debe abrir la web publicada; localhost en el iPhone apunta al propio teléfono.
4. Creá Cloud Firestore **Standard**, elegí una región adecuada y empezá en modo producción (reglas cerradas). No actives test mode. No se necesita cargar datos manualmente.
5. App Check → aplicación web → Fraud Defense (reCAPTCHA Enterprise): registrá una clave pública web de tipo score (sin challenges) para tus dominios y completá `VITE_RECAPTCHA_SITE_KEY`. reCAPTCHA Classic está retirado para nuevas configuraciones. Verificá el plan/cuota sin facturación que ofrezca el proveedor. La clave de sitio es pública; no uses claves secretas en el frontend. La app utiliza `ReCaptchaEnterpriseProvider`. Para desarrollar sin reCAPTCHA real, usá los emuladores indicados abajo.
6. Publicá las reglas del repositorio en tu proyecto, antes de usar datos reales:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project TU_PROJECT_ID
```

7. En App Check habilitá **Enforce** para Firestore. Tener el SDK inicializado no activa enforcement por sí solo. Revisá métricas si las peticiones legítimas son rechazadas; no abras las reglas como solución.
8. En Google Cloud Console → APIs & Services → Credentials, restringí la API key pública por HTTP referrer a los orígenes de producción y desarrollo que usás, y por las APIs que necesita Firebase Auth/Firestore/App Check. Probá login y sincronización después de restringirla. La protección de datos proviene de Auth + reglas + App Check; ocultar la API key no reemplaza esos controles.
9. Reiniciá Vite o recompilá el build: las variables VITE se incorporan durante la compilación. Ajustes del hogar mostrará **Ingresar con Google** cuando todos los valores necesarios estén presentes.
10. Probá el login en Safari/Chrome/Edge, fuera de navegadores embebidos que bloqueen popups. El flujo usa `signInWithPopup` desde un toque del usuario; los bloqueos se muestran como error. No se utiliza redirect automático para evitar los problemas de almacenamiento entre dominios de Safari.

Referencia oficial: [planes de Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [precios y cuotas](https://firebase.google.com/pricing), [Google Sign-In](https://firebase.google.com/docs/auth/web/google-signin), [App Check web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [enforcement](https://firebase.google.com/docs/app-check/enable-enforcement).

### Costos y presupuesto

Spark tiene cuotas gratuitas; este proyecto debe permanecer sin cuenta de facturación vinculada. Si se alcanza una cuota puede dejar de sincronizar hasta que se renueve. La app muestra errores de cuota. No cambiar a Blaze para resolver un error sin revisar antes las cuotas.

Las alertas de presupuesto de Google Cloud se configuran sobre una cuenta de facturación y **no limitan el gasto**. En este proyecto sin facturación no hace falta crear una para poner alertas. Si en el futuro elegís habilitarla: Billing → Budgets & alerts → Create budget → seleccionar proyecto, importe y avisos al 50/90/100 %, con destinatarios propios. [Documentación de presupuestos](https://cloud.google.com/billing/docs/how-to/budgets).

## Probar sin cuenta de Firebase

En una terminal:

```sh
npm run emulators
```

En `.env.local`, usar solamente:

```dotenv
VITE_USE_FIREBASE_EMULATORS=true
```

Después ejecutar `npm run dev`. Abrir localhost o 127.0.0.1. El modo emulador está deshabilitado en builds de producción y siempre apunta al proyecto ficticio `demo-encasa`. El emulador de Auth ofrece un proveedor Google de prueba: no ingreses credenciales reales allí. UI de los emuladores: http://127.0.0.1:4000/.

Para probar roles distintos, usar dos perfiles de navegador y dos cuentas ficticias del emulador. El modo emulador se indica en Ajustes. Quitar la variable al terminar y reiniciar Vite. No exponer los puertos del emulador a Internet. Los datos emulados son temporales si no exportás su estado.

## Cómo probar cada etapa

### Inventario

Agregar Arroz con cantidad 2 kg y mínimo 1. Restar uno: aparece como faltante. “Se acabó” lo deja en 0. Probar búsqueda, categorías, filtro de faltantes, edición, decimales y borrado con confirmación. Recargar conserva los datos locales. Probar ancho de 390 px y tema oscuro automático.

### Lista de compras

1. Con Arroz en 0, abrir Lista, cambiar cantidad a comprar a 7 y salir del campo.
2. Tildarlo: **todavía no cambia el inventario**. Tocar “Terminé la compra” y confirmar: pasa a 7.
3. Agregar Jabón como manual en Higiene; dejarlo sin tildar y terminar otra compra. Debe seguir pendiente, incluso después de recargar.
4. Comprar Jabón: entra al inventario con mínimo 0. No se fusionan productos del mismo nombre para no confundir marcas o presentaciones.
5. Compra parcial (stock 0, mínimo 2, compra 0,5): queda en 0,5 y continúa como faltante, destildado.
6. Cancelar confirmación conserva los checks; sin checks no se puede terminar. Cantidades inválidas o stock mayor de 100.000 no se guardan.

### Hogar compartido

1. Ingresar con Google y crear un hogar. La creación comienza vacía y no sube datos locales sin indicarlo.
2. En Ajustes, importar el inventario local si el hogar está vacío (hasta 150 productos/ítems). Los checks se reinician; no se importan recibos de compras anteriores.
3. Copiar el código de invitación y unirse desde otra cuenta y otro perfil/dispositivo.
4. Modificar un producto desde un dispositivo: el otro debe recibirlo en tiempo real. Comprar siete unidades debe reflejarse una sola vez.
5. Provocar ediciones simultáneas: una revisión antigua no debe sobrescribir el cambio de otro integrante. Los movimientos de cantidad se suman; los conflictos de nombre/unidad/borrado se conservan como pendientes para exportar o descartar desde Ajustes.
6. Como member, comprobar que no aparecen controles de owner; los tests verifican que tampoco se pueden invocar por fuera de la UI.
7. Como owner, renovar código, probar que el anterior no sirve, expulsar un member y comprobar que pierde acceso. La expulsión también rota el código.
8. Exportar un respaldo antes de cerrar sesión. Logout borra los datos de esta app en ese navegador, incluido su inventario local; el hogar permanece en Firebase.
9. Desactivar hogar bloquea a todos. **No realiza purga física**: conserva registros. Para purgar, usar la consola de Firestore y borrar subcolecciones de `items` y `members`, invitaciones y punteros correspondientes. Conservar el documento raíz `status: deleted` para impedir la reutilización del ID.

## Modelo de Firestore

| Ruta                                    | Campos y función                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `users/{uid}`                           | `householdId`: hogar seleccionado de esa cuenta, o vacío. Solo el propio UID; apuntar a un hogar requiere membresía posterior al batch. |
| `households/{id}`                       | `name`, `ownerUid`, `inviteCode`, `inviteExpiresAt`, `createdAt`, `updatedAt`, `status: active/deleted`.                                |
| `households/{id}/members/{uid}`         | `role: owner/member`, `displayName`, `joinedAt`. Roles inmutables desde el cliente.                                                     |
| `households/{id}/items/_version`        | `kind: version`, `revision`: contador para evitar sobrescrituras concurrentes.                                                          |
| `households/{id}/items/p_{productId}`   | `kind: product`, `id`, `name` (1–80), `category`, `quantity` (0–100000), `unit`, `minimumStock` (0–100000), `updatedAt` (ISO).          |
| `households/{id}/items/m_{manualId}`    | `kind: manual`, `id`, `name`, `category`, `quantity` (>0), `unit`, `checked`.                                                           |
| `households/{id}/items/s_{productId}`   | `kind: selection`, `productId`, `quantity` (>0), `unit`, `checked`. La unidad debe coincidir con el producto.                           |
| `households/{id}/items/o_{operationId}` | `kind: operation`, `operationId`: recibo de compra aplicado.                                                                            |
| `invites/{code}`                        | `householdId`, `expiresAt`. Código de 32 caracteres hexadecimales (128 bits) generado por CSPRNG. No permite listados.                  |
| `joinAttempts/{uid}`                    | `code`, `attemptedAt`: un intento por UID cada 10 s; ligado al código, utilizable durante 30 s. No se puede borrar desde el cliente.    |

Los ítems se guardan en una colección común con discriminador `kind` para recibir un snapshot consistente de inventario y lista. Todas las mutaciones actualizan `_version` en la misma transacción. Los faltantes se derivan con `quantity <= minimumStock`; no se guardan duplicados. La compra suma solo lo tildado, limpia sus selecciones, conserva pendientes y registra su ID. Repetir ese ID no repone otra vez.

Las membresías solo se crean mediante bootstrap atómico o el flujo de invitación validado por reglas; no existe alta libre de miembros. Los códigos se guardan como capacidades de acceso, no como contraseñas. El throttle es por cuenta, no global. Ver [revisión de seguridad y límites](../SECURITY.md).

## Datos locales y estructura

`localStorage`: clave `encasa.household.v2`, con versión, productos, ítems manuales, selecciones y recibos. Migra el inventario anterior de `encasa.inventory.v1`, conservándolo como copia histórica. No usar una versión vieja de la app para editar datos nuevos. El respaldo JSON incluye la lista. Aún no hay restauración desde la interfaz.

- `components/`: formularios, inventario, lista y ajustes.
- `hooks/`: operaciones y coordinación de sesión/sincronización.
- `services/`: lógica pura, almacenamiento y Firebase.
- `types/`: esquemas y puerto intercambiable de inventario.
- `tests/`: lógica, almacenamiento, invitaciones y reglas con casos negativos.

## Deploy gratuito en Firebase Hosting

Las reglas ya se publicaron en encasa-5258f. Todavía no se publicó la web en Hosting. Después de configurar tu proyecto Spark:

```sh
npm ci
npm run build
npx firebase login
npx firebase deploy --only hosting,firestore:rules --project TU_PROJECT_ID
```

`firebase.json` sirve `dist/`, aplica HTTPS/headers y la ruta SPA. El build debe incorporar la configuración de producción y `VITE_USE_FIREBASE_EMULATORS=false`. Verificar login, App Check y CSP en el dominio final. No publicar `.env`, credenciales de servicio ni el directorio de emuladores.

Vercel puede servir el build Vite (`npm run build`, salida `dist`), pero requiere configurar allí variables, rewrite SPA y headers equivalentes a `firebase.json`. No se configuró Vercel en esta etapa.

## Instalar y probar la PWA

La instalación requiere la web publicada con HTTPS (localhost solo sirve para pruebas en esa misma PC). Publicada en https://encasa-5258f.web.app.

- **iPhone:** abrir la URL publicada en Safari → Compartir → Agregar a pantalla de inicio → Agregar. Abrir el ícono e ingresar con Google si Safari no comparte la sesión con la app instalada.
- **Windows:** abrir la URL en Chrome/Edge → ícono de instalación en la barra o menú → Instalar En casa. También aparece un botón en la app cuando el navegador ofrece instalación.
- Abrir el hogar con Internet y esperar la sincronización antes de salir. El service worker descarga solo archivos estáticos propios; no guarda respuestas de Auth, Firestore ni App Check.
- Activar modo avión en el teléfono, cerrar y reabrir la app. Modificar stock, agregar un manual y terminar una compra de prueba. Recargar: los cambios deben seguir ahí. Desactivar modo avión y abrir la app: esperar que no haya pendientes y verificar desde otro dispositivo que el stock se sumó una vez.
- Probar dos dispositivos desconectados: una reposición remota más un consumo local deben conservar ambos movimientos. Si cambia la unidad o hay conflictos de texto/borrado, exportar pendientes en Ajustes antes de descartarlos.
- Logout pide confirmar el borrado de la copia local y avisa si hay pendientes. No cerrar sesión ni limpiar el almacenamiento del navegador antes de sincronizar/exportar.
- Nueva versión: la app ofrece Actualizar app y bloquea el botón si hay cambios pendientes. Cerrar formularios antes de actualizar.

No se promete sincronización con la app cerrada: Safari/iOS puede suspenderla. La cola se procesa en primer plano al abrir o recuperar conexión. El navegador puede desalojar almacenamiento por falta de espacio; usar respaldos.

### Implementación offline

Firestore mantiene caché en memoria. La copia confirmada del hogar se guarda por UID en localStorage, junto con un registro independiente por operación pendiente. Cada registro conserva el estado anterior/posterior y un UUID. Al reconectar, se aplica contra la última revisión del servidor y se guarda un recibo o_sync-{uuid} en la misma transacción que stock/lista. Reintentar después de un cierre no suma de nuevo. Web Locks serializa el envío entre pestañas cuando está disponible; las revisiones y recibos en Firestore protegen entre dispositivos.

Cantidad se reconcilia como diferencia, con límites 0–100000; nombre/unidad/borrado incompatibles detienen el envío sin eliminar los pendientes. Desde Ajustes se pueden exportar o descartar (con confirmación). Los datos offline no están cifrados y un integrante expulsado puede conservar su copia hasta conectarse; el servidor siempre vuelve a validar membresía.

Verificado localmente: build y manifest, 28 tests unitarios, 17 tests con reglas/emulador (incluye reenvío sin duplicar una compra de 7), sugerencias al escribir d y autocompletado de categoría/unidad. En el navegador se cerró el servidor de preview y la app siguió abriendo al recargar gracias al service worker. No equivale a una prueba en Safari/iPhone real.
