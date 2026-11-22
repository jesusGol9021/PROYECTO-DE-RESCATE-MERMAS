# Rescate Plataforma V4 — Fases 1, 2 y 3

Esta versión conserva el flujo ya probado:

**Donante → Disponible → Receptor → Reservado → QR/código → Entregado**

Y agrega las mejoras de las fases 2 y 3.

## Nuevas funciones

### Fase 2
- Mapa de ubicación mediante OpenStreetMap.
- Notificaciones persistentes en PostgreSQL.
- Expiración automática de reservas después de 30 minutos.
- Historial de reservas y estados.
- Perfil operativo con teléfono, distrito y descripción.
- Reputación y calificaciones después de una entrega.
- Reporte de incidencias.

### Fase 3
- Verificación documental de organizaciones.
- Panel administrativo para revisar documentos.
- Incidencias centralizadas para administración.
- Bitácora de auditoría de acciones críticas.
- Notificaciones de aprobación, reserva, cancelación y entrega.
- Perfil verificado y reputación.
- Controles de seguridad por rol en API.

## Base de datos — IMPORTANTE

La base que ya tienes funcionando **NO debe borrarse**.

Si ya ejecutaste:

```text
000_schema.sql
001_rescate_integrity.sql
002_roles_geolocation_qr.sql
```

NO los ejecutes otra vez.

Para V4 ejecuta **una sola vez**:

```text
db/003_fase2_3.sql
```

en la base `rescate_mermas` usando pgAdmin Query Tool.

La migración es idempotente para las columnas/tablas nuevas y conserva tus usuarios, donaciones y reservas existentes.

## Puesta en marcha

1. Conserva una copia de la carpeta V3 que ya funciona.
2. Descomprime V4.
3. Copia tu `.env.local` de V3 a V4.
4. No pongas la contraseña en GitHub.
5. Ejecuta la migración `003_fase2_3.sql`.
6. Desde la carpeta V4:

```bash
npm install
npm run typecheck
npm run dev
```

7. Abre:

```text
http://localhost:3000
```

## Pruebas recomendadas

1. Iniciar sesión como administrador.
2. Revisar una organización pendiente.
3. Subir un documento desde Donante/Receptor.
4. Aprobar el documento desde administración.
5. Crear una donación.
6. Reservarla desde otro usuario.
7. Verificar que aparezca la notificación.
8. Confirmar entrega por QR/código.
9. Calificar la experiencia.
10. Crear una incidencia y resolverla desde administración.
11. Revisar la bitácora de auditoría.
12. Probar que una reserva sin recojo se libere después de 30 minutos.

## Nota sobre almacenamiento de documentos

La V4 usa almacenamiento en PostgreSQL mediante Data URL para mantener el prototipo autosuficiente. Para producción conviene mover las imágenes/documentos a un almacenamiento de objetos (por ejemplo S3/Supabase Storage/Cloudinary) y guardar solamente la URL en PostgreSQL.

## Seguridad

- Administrador no aparece en el registro público.
- Las rutas administrativas verifican el rol en servidor.
- Las acciones críticas generan auditoría.
- Las reservas siguen protegidas por transacción y restricción única.
- QR y códigos siguen siendo únicos.
- Cámara/GPS requieren contexto seguro en producción (HTTPS).

## Reputación visible en donaciones

Las calificaciones realizadas después de una entrega ahora se reflejan en las tarjetas de donaciones futuras del mismo donante. El receptor puede ver la puntuación promedio y cantidad de reseñas, y abrir el detalle para leer comentarios. La puntuación se calcula sobre las reseñas recibidas por el donante, mientras que cada reserva completada conserva también su resumen de calificaciones.

No requiere una migración nueva: reutiliza la tabla `reviews` creada por `003_fase2_3.sql`.


## Correcciones de calidad v0.4.1

- El perfil acepta los nombres `lat`/`lng` enviados por la captura del GPS y valida sus rangos.
- Los códigos manuales se validan directamente en el servidor; la API no expone QR ni código al donante.
- El código de recojo usa `crypto.randomInt`, y los intentos fallidos se registran en PostgreSQL con bloqueo temporal.
- La creación de cuenta requiere consentimiento informado y lo registra con fecha; la página `/privacidad` contiene el aviso base pendiente de completar con los datos reales del responsable y revisión legal.
- Se validan formatos y firmas de archivos de imagen/documento y se evita devolver el correo del receptor en "Mis donaciones".
- Se agregan encabezados de seguridad HTTP y se corrige el radio por defecto para entradas no numéricas.

### Migraciones

Para una base nueva, aplicar en este orden con `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <archivo>`: `db/000_schema.sql`, `db/002_roles_geolocation_qr.sql`, `db/003_fase2_3.sql`, `db/004_donations_columns.sql`, `db/005_privacy_consent_and_validation_lockout.sql`, `db/006_profiles_and_food_windows.sql`, `db/007_persistent_auth_rate_limit.sql` y `db/008_declared_weight_kg.sql`. La migración `001_rescate_integrity.sql` es solo para bases antiguas y debe evaluarse antes de ejecutarla para evitar duplicar restricciones. Realiza una copia de seguridad antes de migrar una base con información.

**No ejecutar migraciones en una base con información sin realizar primero un respaldo.** Estas migraciones no eliminan datos, pero deben probarse contra una copia antes de aplicarlas en un entorno real.

### Pendiente antes de producción

Configurar `PRIVACY_CONTROLLER_NAME` y `PRIVACY_CONTACT_EMAIL` con datos reales y revisar los datos del responsable en `/privacidad`, revisar jurídicamente el aviso/consentimiento, configurar `DATABASE_URL`, `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL`, desplegar bajo HTTPS y ejecutar las pruebas de integración, abuso de códigos, carga, accesibilidad y dispositivos reales. No se declara producción ni cumplimiento normativo hasta contar con esas evidencias.


### v0.4.1: ventana de disponibilidad, vencimiento, control administrativo y reportes

- `availableFrom` diferencia el inicio de la disponibilidad; `foodExpiresAt` registra el vencimiento del alimento; `expiresAt` sigue siendo el límite de recojo.
- Los lotes sin reserva pueden editarse y cancelarse mientras estén disponibles/programados.
- El administrador puede suspender y reactivar una organización para revisión; aprobar un documento no aprueba por sí solo la cuenta.
- `/api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` exporta un CSV con filtros de periodo y controles contra fórmula CSV.
- `/api/cron/expire` actualiza lotes programados/vencidos y libera reservas caducadas. Está protegido por `CRON_SECRET`; en Vercel Hobby se programa una vez al día para respetar su límite de frecuencia. Las API vuelven a evaluar vencimientos al consultarse. Si necesitas liberación de reservas próxima a los 30 minutos aun sin lecturas, usa un plan que admita el cron de cada cinco minutos o un scheduler externo protegido con `CRON_SECRET`.
- Se añade `taxId` opcional de 11 dígitos y coordenadas manuales en el perfil/mapa.
- Las constancias incluyen cantidad declarada, peso opcional declarado en kg, vencimiento del alimento y límite de recojo, escapando valores antes de imprimir. El impacto en kg suma solo los pesos explícitamente registrados; no interpreta unidades arbitrarias como kilogramos.

### Ejecución segura de migraciones

Copia la base antes de migrar. En bases ya existentes, aplica solo migraciones faltantes tras verificar el esquema actual. No borres ni recrees la base productiva para resolver conflictos.


### Limitación operativa del cron

La configuración `vercel.json` usa una ejecución diaria (09:00 UTC) por compatibilidad con Vercel Hobby. La liberación/actualización de estados también se intenta en las consultas de las API que llaman `refreshLifecycle()`. Para una actualización programada cada 5 minutos (más adecuada para reservas de 30 minutos), se necesita un plan de Vercel que admita ese intervalo o un servicio externo de cron autorizado con `CRON_SECRET`. La precisión horaria del plan debe comprobarse en el proveedor.


### Peso cuantificado v0.4.1

`quantityKg` es un campo numérico opcional para registrar peso conocido. La migración `008_declared_weight_kg.sql` intenta recuperar valores solo cuando la descripción heredada indica explícitamente kg/kilogramo(s); el resto queda sin peso declarado y no se infiere. Aplica la migración después de la 007.
