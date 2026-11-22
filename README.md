# Rescate — plataforma de recuperación de excedentes alimentarios

Proyecto web académico para conectar **donantes**, **receptores** y **administradores** en la redistribución trazable de alimentos aptos para consumo.

## Tecnologías

Next.js 16, React 19, TypeScript, PostgreSQL, Drizzle ORM y Better Auth. El sistema utiliza código QR o código de seis dígitos para validar entregas.

## Funcionalidades

- **Donante:** publica, edita y cancela lotes; adjunta imágenes; indica cantidad, disponibilidad, vencimiento y punto de recojo; valida entregas.
- **Receptor:** explora donaciones, filtra por categoría, busca por radio cuando activa su ubicación, reserva lotes y consulta sus reservas.
- **Administrador:** revisa cuentas y supervisa la operación según los permisos existentes.
- **Trazabilidad:** estados de lotes y reservas, notificaciones, reseñas, incidencias y métricas.

### Mejoras v0.5.0

- La publicación reutiliza las coordenadas guardadas en el perfil cuando no se han obtenido otras para el lote.
- El GPS confirma la respuesta de guardado antes de mostrar éxito y maneja los errores de permisos y conexión.
- La vista del receptor muestra todos los lotes por defecto; el filtro por cercanía es opcional y aplica el radio circular exacto.
- La vista consulta periódicamente las reservas y los indicadores cada 15 segundos mientras la pestaña está visible (actualización por *polling*, no WebSockets).
- Las reservas activas presentan la etiqueta «En curso» sin cambiar el estado interno `requested`.
- Se previenen errores de fechas antes de enviar el formulario y se evita que un fallo del registro de auditoría convierta una publicación ya guardada en una falsa respuesta de error.

## Instalación local

1. Instala Node.js (preferiblemente la versión LTS compatible con Next.js 16) y PostgreSQL.
2. Ejecuta `npm ci` en la raíz del repositorio.
3. Copia `.env.example` a `.env.local` y configura `DATABASE_URL`, `BETTER_AUTH_URL` y `BETTER_AUTH_SECRET` con valores propios.
4. Crea una base de datos de desarrollo **separada de la base real**. Revisa los scripts SQL en `db/` y el orden de migración documentado en `README-INTEGRACION.md` antes de ejecutarlos.
5. Ejecuta `npm run dev` y visita `http://localhost:3000`.

**No publiques `.env.local`, contraseñas, tokens, datos personales ni volcados de PostgreSQL en GitHub.** La base de datos y el almacenamiento de archivos no se alojan automáticamente en GitHub.

## Comprobaciones

```bash
npm test
npm run typecheck
npm run build
npm audit
```

La suite `npm test` contiene pruebas estáticas de regresión. Las pruebas de aceptación con PostgreSQL real, permisos del navegador, reservas concurrentes, subida de imágenes y despliegue público deben ejecutarse en un entorno configurado antes de afirmar que todo está verificado.

## Guía de revisión para el docente

1. Consultar `app/page.tsx` para la interfaz de roles.
2. Revisar `app/api/donations/route.ts` para publicación y búsqueda por proximidad.
3. Revisar `app/api/reservations/route.ts` y `app/api/reservations/validate/route.ts` para reserva y entrega.
4. Revisar `tests/` para pruebas existentes y `docs/` para documentación adicional.
5. Ejecutar las comprobaciones con las dependencias y una base de datos de prueba configuradas.

## Estado de verificación de esta entrega

- Pruebas estáticas existentes: **20/20 aprobadas** en el entorno de preparación.
- Análisis de sintaxis TS/TSX de los dos archivos principales modificados: **sin errores de parseo**.
- Typecheck completo y build: **no verificados** en este entorno por instalación incompleta de dependencias; ejecutar los comandos anteriores en un entorno con acceso a npm.
- Pruebas de integración con PostgreSQL y navegador: **pendientes**.

Este repositorio es una entrega académica y no una certificación de seguridad o aptitud para producción.
