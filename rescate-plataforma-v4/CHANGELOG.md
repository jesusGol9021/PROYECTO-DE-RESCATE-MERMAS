# Changelog Rescate

## [0.4.1] - 2026-10-31 (cambios locales pendientes de validación end-to-end)

### Seguridad y privacidad
- Registro exige consentimiento informado y la fecha queda almacenada; usuarios antiguos sin consentimiento quedan ante una pantalla de reconsentimiento.
- El secreto `BETTER_AUTH_SECRET` es obligatorio en producción y se ignoran variables `.env` reales.
- El listado del donante deja de devolver QR y código de recojo.
- Se agregan intentos de validación persistentes con bloqueo temporal.
- La calificación queda limitada a participantes de la entrega completada.
- La respuesta de “Mis donaciones” deja de incluir correo del receptor.
- Se validan contenido y firmas de las imágenes/documentos en el servidor.
- Se agregan encabezados HTTP de seguridad.

### Funcionalidad y mantenimiento
- El código manual se valida directamente mediante la API con seis dígitos; el QR sigue validándose por token.
- La generación de códigos usa `crypto.randomInt`.
- El perfil acepta `lat`/`lng` del navegador y valida límites geográficos.
- El radio no numérico vuelve al valor por defecto de 15 km.
- Se agregan migraciones 004–008, pruebas estáticas y un workflow de control de calidad.

### Pendiente de ejecutar
- `npm ci`, `npm run test:static`, `npm run typecheck`, `npm run build`, migraciones y recorrido de API contra PostgreSQL deben ejecutarse en CI o en el entorno local antes de marcar esta versión como validada.
- Pruebas k6, OWASP ZAP, Lighthouse, aceptación con usuarios y despliegue con HTTPS requieren su entorno correspondiente.
- Corregida una comilla faltante en la definición de `verificationStatus` en el esquema inicial para que la migración nueva no falle al crear la tabla `user`.
- Añadido rate limiting persistente de Better Auth, con reglas más estrictas para inicio de sesión y registro, respaldado por la tabla `rateLimit` y la migración 007.
- Validación estricta de fechas reales en los filtros de reportes y límite explícito de 10 000 filas CSV por descarga.
- La cancelación de una reserva ya no reactiva un lote cuya fecha de recojo o vencimiento del alimento ya pasó; los lotes futuros vuelven a `scheduled`.
- Las reservas nuevas no superan el límite del lote/alimento; la validación rechaza lotes vencidos. Cron de Vercel configurado a ejecución diaria compatible con Hobby; documentada la limitación para la expiración oportuna de reservas sin tráfico y la alternativa de un plan/scheduler con frecuencia de cinco minutos.
- Añadido `quantityKg` opcional, migración 008, constancias con peso declarado y métricas que solo suman kilos explícitos.
- Corregido el cálculo de la tasa de rescate para comparar entregas de la red con todos los lotes publicados.

## [0.4.2] - 2026-11-01

- Se añadió `env.example` visible como respaldo de `.env.example` para casos en que el extractor de archivos omita dotfiles.
- Las pruebas estáticas ahora leen el archivo de entorno de respaldo si el archivo oculto no está presente.
- Se añadió un script PowerShell con confirmación explícita para ejecutar las migraciones incrementales 005–008 tras realizar una copia de seguridad.
- No se declara resuelto el resultado de `npm audit`; se requiere actualizar dependencias de forma controlada y repetir pruebas.
