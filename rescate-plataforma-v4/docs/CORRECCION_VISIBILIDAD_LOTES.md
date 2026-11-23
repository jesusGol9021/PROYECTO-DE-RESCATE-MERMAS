# Corrección de visibilidad de lotes — v0.5.1

## Problema
La API de donaciones solo devolvía lotes `available`, ocultando publicaciones `scheduled` hasta la fecha de inicio. La interfaz mostraba el mismo estado vacío cuando la consulta fallaba.

## Cambio
- GET `/api/donations` devuelve lotes `available` y `scheduled` no vencidos.
- El receptor identifica `scheduled` como «Próximamente» y no puede reservarlos antes del inicio.
- Se mantiene el filtro opcional de GPS y la validación de disponibilidad en POST `/api/reservations`.
- Se muestran los errores de la API en lugar de interpretarlos como una lista vacía.

## Verificación manual obligatoria
1. Inicia PostgreSQL y el servidor; abre sesión con un donante aprobado.
2. Publica un lote con `Disponible desde` en el futuro y vencimiento posterior. Comprueba que aparece como «Programado» en Mis donaciones.
3. Abre sesión como receptor: el lote debe aparecer como «Próximamente» sin botón de reserva habilitado.
4. Publica otro lote con disponibilidad inmediata y vencimiento futuro; debe aparecer como «Disponible» y poder reservarse.
5. Activa y desactiva «Filtrar por cercanía»; verifica coordenadas y radio si no aparece.
6. Verifica que lotes vencidos, cancelados, entregados o reservados no estén disponibles para nuevas reservas.
7. Ejecuta `npm install`, `npm run typecheck`, `npm test`, `npm run build` con PostgreSQL configurado.

**Nota:** las pruebas dinámicas con la base de datos del usuario deben realizarse localmente; no se ha accedido a ella desde este entorno.
