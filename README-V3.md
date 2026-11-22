# Rescate Plataforma V3

Esta versión parte del MVP que ya fue probado con el flujo:

**Donante → Disponible → Receptor → Reservado → QR/código → Entregado**

## Mejoras incluidas

### Roles
- Donante: publicación, ubicación, foto, control de lotes, cancelación de publicaciones disponibles y validación de entregas por QR/código.
- Receptor: búsqueda por proximidad, filtros, radio 5/15/30/50 km, reserva, QR, código de recojo y cancelación.
- Administrador: validación de organizaciones, filtros de usuarios, métricas operativas y tasa de rescate.

### Experiencia dinámica
- Indicadores reales conectados a PostgreSQL.
- Tasa de rescate y kg rescatados.
- Estado de ubicación/GPS.
- Cuenta regresiva de lotes próximos a vencer.
- Centro de avisos dentro del panel.
- Vista de impacto por donante/receptor.
- Vista previa de fotografías.
- Estados visuales del ciclo de vida.
- Filtros y búsqueda administrativa.
- Diseño responsive para escritorio y celular.

### Reglas de negocio reforzadas
- Los lotes disponibles se marcan como `expired` cuando superan su hora límite.
- Publicar exige ubicación válida para mantener la búsqueda por proximidad consistente.
- Un lote reservado no puede ser cancelado por el donante.
- Un receptor no puede reservar su propio lote.
- La reserva se protege con transacción y bloqueo de fila.
- Un solo rescate activo puede existir por lote.

## Base de datos
No se agregó una migración nueva para V3: los cambios utilizan las tablas y columnas existentes de `000_schema.sql`, `001_rescate_integrity.sql` y `002_roles_geolocation_qr.sql`.

## Puesta en marcha local

1. Mantén PostgreSQL 18 y la base `rescate_mermas` que ya configuraste.
2. Mantén tu `.env.local`:

```env
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/rescate_mermas
BETTER_AUTH_URL=http://localhost:3000
```

3. Desde esta carpeta:

```bash
npm install
npm run dev
```

4. Abre `http://localhost:3000`.

## Importante
- No ejecutes nuevamente `000_schema.sql`, `001_rescate_integrity.sql` ni `002_roles_geolocation_qr.sql` si ya tienes la base funcionando.
- Conserva una copia de la versión que ya probaste antes de reemplazarla.
- El administrador se crea/promueve internamente; no aparece como opción pública de registro.
- Para cámara y GPS en producción se recomienda HTTPS.
