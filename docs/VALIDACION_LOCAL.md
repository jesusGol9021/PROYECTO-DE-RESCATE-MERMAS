# Validación local y despliegue preliminar — Rescate v0.4.2

## Estado comprobado en el entorno de preparación

- `npm test`: 20 pruebas estáticas de regresión aprobadas (20/20).
- Transpilación de sintaxis TypeScript/TSX: 40 archivos inspeccionados, sin errores de sintaxis.
- JSON: `package.json`, `package-lock.json` y `vercel.json` se validan sintácticamente.
- `npm run typecheck`: NO validado; falló porque esta preparación no pudo completar la instalación de dependencias y faltan tipos/módulos en `node_modules`.
- `npm run build`: NO validado; Next.js no estaba disponible debido a la instalación incompleta.
- Migraciones/PostgreSQL, pruebas de API con base real, k6, OWASP ZAP, Lighthouse, pruebas con usuarios/dispositivos y hosting HTTPS: PENDIENTES de ejecución en un entorno con las herramientas y servicios requeridos.

No presentar estos resultados como una compilación/build exitoso ni como certificación de que el producto funciona al 100 %. Las pruebas estáticas verifican regresiones sobre patrones de código, no sustituyen pruebas de integración y aceptación.

## Antes de comenzar

1. Trabaja primero en una copia del proyecto.
2. Haz un respaldo de PostgreSQL antes de aplicar migraciones a una base existente.
3. No incluyas credenciales reales, `.env`, `.env.local` ni backups con datos personales en Git o en el ZIP entregable.
4. No uses información personal real para pruebas de clase. Revisa el aviso de privacidad y completa los datos del responsable antes de invitar usuarios reales.

## Instalación local (Windows CMD / PowerShell)

Requisitos: Node.js compatible con el proyecto, npm y PostgreSQL. Abre la terminal en la carpeta que contiene este `package.json` (no en `C:\Users\<usuario>`).

En CMD puedes crear el archivo de entorno así:

```bat
if exist .env.example (copy .env.example .env.local) else (copy env.example .env.local)
```

Edita `.env.local` antes de compilar. Genera un secreto de autenticación propio (no copies una clave del informe ni la compartas):

```bat
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia la salida en `BETTER_AUTH_SECRET=` dentro de `.env.local`. Genera otro valor distinto para `CRON_SECRET=`. Configura `DATABASE_URL` con la base PostgreSQL de pruebas y `BETTER_AUTH_URL=http://localhost:3000` para desarrollo local. No uses credenciales de producción en pruebas.

Luego ejecuta uno por uno:

```bat
npm ci
npm test
npm run typecheck
npm run build
npm audit --audit-level=high
```

El script de pruebas enumera el archivo de prueba explícitamente porque CMD de Windows no expande de la misma manera el patrón `tests/*.test.mjs`. Si `npm audit` informa vulnerabilidades, revisa cada aviso y el impacto de la actualización antes de cambiar versiones; no utilices `npm audit fix --force` sin comprobar compatibilidad.

Edita `.env.local` con los valores reales del entorno. No reutilices las claves de CI ni subas el archivo al repositorio:

- `DATABASE_URL`: conexión al PostgreSQL de desarrollo/pruebas.
- `BETTER_AUTH_URL`: URL base exacta de la aplicación. En local puede ser `http://localhost:3000`.
- `BETTER_AUTH_SECRET`: genera un secreto aleatorio de al menos 32 caracteres; por ejemplo, `openssl rand -base64 32`.
- `CRON_SECRET`: secreto distinto, aleatorio, de al menos 24 caracteres.
- `PRIVACY_CONTROLLER_NAME` y `PRIVACY_CONTACT_EMAIL`: datos verdaderos del responsable y contacto de privacidad.

No uses valores de ejemplo en producción.

## Migraciones PostgreSQL

### Base existente que muestra el aviso de Better Auth

Si el build termina pero Better Auth avisa que faltan la tabla `rateLimit` y las columnas `user.taxId`, `user.privacyConsent` y `user.privacyConsentAt`, las migraciones incrementales no se han aplicado a esa base. Primero realiza un respaldo y verifica `DATABASE_URL`. En PowerShell, desde la raíz del proyecto, ejecuta `./scripts/apply-v041-upgrades.ps1` para vista previa; después de respaldar, ejecuta `./scripts/apply-v041-upgrades.ps1 -Apply` y escribe `APLICAR` únicamente si verificaste la conexión. El script aplica 005–008 y no ejecuta el esquema inicial. No uses `db/000_schema.sql` contra una base existente con datos.

La app puede compilar mostrando esos avisos, pero no consideres el esquema validado hasta que el aviso desaparezca al iniciar la aplicación y la prueba de esquema pase.


### Base de datos NUEVA y vacía

Primero crea una base de datos vacía. Después aplica, en este orden, desde la raíz del proyecto:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/000_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/002_roles_geolocation_qr.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/003_fase2_3.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/004_donations_columns.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/005_privacy_consent_and_validation_lockout.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/006_profiles_and_food_windows.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/007_persistent_auth_rate_limit.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/008_declared_weight_kg.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database-smoke.sql
```

`db/001_rescate_integrity.sql` está pensado para la línea anterior del esquema; NO lo ejecutes sobre una base nueva a menos que hayas comprobado que sus condiciones aplican. No ejecutes `000_schema.sql` a ciegas en una base con datos reales. Para bases existentes hay que identificar primero la versión del esquema, respaldar y comprobar cada migración contra esa versión.

## Comprobación funcional de humo

Después de `npm run dev`, usa únicamente cuentas y alimentos de prueba:

1. Registrar cuentas de donante y receptor; comprobar el consentimiento requerido.
2. Verificar que cada rol accede solo a sus funciones.
3. Completar los datos del perfil y probar GPS o coordenadas manuales válidas/ inválidas.
4. Publicar un lote con imagen permitida y datos completos; probar imagen no válida y fechas incoherentes.
5. Editar y cancelar lote disponible; confirmar que un lote reservado no se modifica de forma incompatible.
6. Buscar por categoría/radio; comprobar el radio no numérico y límites de coordenadas.
7. Ejecutar intentos simultáneos de reserva del mismo lote y confirmar que no hay dos reservas activas incompatibles.
8. Confirmar que el QR/código se muestra solo al receptor correspondiente.
9. Probar código correcto, incorrecto, de otra reserva, vencido y sexto intento tras cinco fallidos.
10. Confirmar que solo el donante responsable puede validar y que la entrega no se confirma dos veces.
11. Probar revisión, rechazo y suspensión de organizaciones con una cuenta administrativa de prueba.
12. Descargar reporte CSV con intervalo correcto/incorrecto y verificar que no exponga correos o fórmulas inyectables.
13. Comprobar constancia, auditoría, calificaciones después de entrega e indicadores de kilos solo cuando exista `quantityKg` registrado explícitamente.

Registra para cada caso: fecha, versión/commit, ambiente, resultado real, evidencia y defecto asociado. No marques aprobado un caso no ejecutado.

## Despliegue preliminar

1. Publica una rama/etiqueta revisada después de tener instaladas las dependencias y completar `npm test`, `npm run typecheck` y `npm run build`.
2. Usa una base PostgreSQL de prueba gestionada; respalda antes de migrar.
3. Configura las variables de entorno del proveedor sin copiarlas al repositorio.
4. Despliega una versión cerrada de prueba con HTTPS y con datos ficticios.
5. Ejecuta las pruebas de humo y verifica `BETTER_AUTH_URL`, las cookies de sesión y la ruta `/api/cron/expire`.
6. Conserva registro de versión, URL, evidencias, incidentes y plan de reversión. Si una migración no puede revertirse, la reversión puede exigir restaurar el respaldo previo.

### Importante sobre el vencimiento programado

`vercel.json` programa la tarea de vencimientos una vez al día a las 09:00 UTC. En el plan Hobby de Vercel, esa programación no equivale a una ejecución exacta cada 30 minutos. Para garantizar vencimiento oportuno sin tráfico de usuarios, configura un programador con frecuencia adecuada en un plan/proveedor compatible, o un cron externo seguro. La ruta programada requiere `CRON_SECRET`.

## Pendientes antes de afirmar que está al 100 %

- Conseguir una instalación reproducible desde `package-lock.json` y aprobar typecheck/build.
- Ejecutar las migraciones y `tests/database-smoke.sql` en PostgreSQL limpio y en una copia de la versión de datos existente.
- Ejecutar integración real, concurrencia y recorrido completo de reservas/entregas.
- Ejecutar k6, OWASP ZAP y Lighthouse y guardar sus reportes.
- Probar en móvil y realizar aceptación con usuarios representativos.
- Desplegar por HTTPS y registrar evidencia del entorno.
- Completar los datos reales del aviso de privacidad; realizar revisión legal/técnica antes de un piloto público.
- Completar en el informe las fechas obtenidas del historial real de Git, responsables y firmas. El ZIP original no contenía `.git`, por lo que no se inventan commits ni etiquetas antiguas.


## Resultados reportados en Windows (01/11/2026)

- `npm test`: en una extracción faltó `.env.example`; los tres fallos reportados fueron errores ENOENT del mismo archivo, no tres fallos funcionales distintos. v0.4.2 incluye `env.example` y fallback de lectura; se debe repetir `npm test`.
- `npm run typecheck`: el registro compartido no muestra errores y la siguiente orden empezó, por lo que el resultado aparenta ser correcto; vuelve a ejecutarlo y confirma que finaliza con código 0.
- `npm run build`: termina con código 0, pero Better Auth reportó tabla `rateLimit` y columnas de usuario faltantes. Aplicar migraciones 005–008 a la base correcta tras respaldo y repetir el build.
- `npm audit`: informó 20 vulnerabilidades (incluidas 2 críticas). No ejecutar `npm audit fix --force` sin revisión, porque puede provocar cambios incompatibles. No desplegar públicamente hasta actualizar dependencias afectadas, especialmente Next.js, y repetir las comprobaciones.
