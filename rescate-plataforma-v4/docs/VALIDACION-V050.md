# Plan de validación v0.5.0

| Caso | Resultado esperado | Estado |
|---|---|---|
| Crear lote con ubicación guardada | Se publica sin requerir GPS nuevo | Pendiente de prueba con PostgreSQL |
| Publicar lote con fechas inválidas | El formulario bloquea y explica el error | Validación implementada; prueba de navegador pendiente |
| Adjuntar imagen > 1.8 MB | Se rechaza y muestra mensaje | Validación existente; prueba de navegador pendiente |
| Receptor sin GPS | Puede ver lotes sin filtro de proximidad | Implementado; prueba de integración pendiente |
| Receptor con GPS | Solo lotes dentro del radio circular | Implementado; prueba SQL pendiente |
| Dos receptores reservan el mismo lote | Solo una reserva exitosa | Bloqueo transaccional existente; prueba de concurrencia pendiente |
| Reserva activa | Muestra «En curso» y código de recojo | Implementado; prueba de navegador pendiente |
| Actualización de reservas | Se refresca cada 15 s con pestaña visible | Implementado; prueba de navegador pendiente |
| QR de entrega | Entrega validada una sola vez | Función existente; prueba E2E pendiente |
| Auditoría después de publicar | Fallo secundario no invalida la publicación | Implementado; prueba de integración pendiente |

**No ejecutar migraciones destructivas en bases con información real.** Realizar copia de seguridad y ensayar en una base de desarrollo.
