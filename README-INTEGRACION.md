# Rescate Plataforma — V3

La versión actual es V3 y contiene las mejoras documentadas en `README-V3.md`.

# Rescate — plataforma integrada

Esta versión toma como base la idea y requerimientos del documento **PRACTICASCAMPO.pdf** y los conecta con la aplicación web existente.

## Qué se incorporó

- **Roles:** Donante, Receptor y Administrador.
- **Validación de organizaciones:** las cuentas nuevas quedan pendientes hasta que un administrador las apruebe.
- **Donante:** publica lotes, adjunta foto, registra ubicación, ve estados y valida el recojo.
- **Receptor:** busca lotes cercanos, usa GPS, filtra por radio/categoría, reserva y recibe QR + código de 6 dígitos.
- **Administrador:** aprueba/rechaza organizaciones y consulta indicadores.
- **Geolocalización:** Haversine en PostgreSQL + bounding box previo para reducir registros antes del cálculo exacto.
- **Concurrencia:** la reserva bloquea el lote dentro de una transacción y existe un índice único para impedir reservas activas duplicadas.
- **Trazabilidad:** `Disponible → Reservado → Entregado`; las reservas guardan QR, código manual, fecha de reserva y fecha de entrega.
- **QR:** el receptor obtiene un QR; el donante puede escanearlo desde la cámara o validar con el código de 6 dígitos.
- **Foto:** el prototipo permite tomar/subir una foto desde el formulario. Para producción se recomienda migrar las imágenes a un almacenamiento de objetos.
- **Dashboard dinámico:** los indicadores ya no son datos simulados.

## Relación con el documento del proyecto

El documento plantea publicación rápida de lotes, proximidad con Haversine y trazabilidad mediante QR. También define tres actores principales: donante, receptor y administrador. La implementación web mantiene esos tres roles y esos flujos. Ver páginas 3, 5, 7 y 12 del documento fuente. 

El documento también pide concurrencia para evitar reservas duplicadas y un respaldo manual de 6 dígitos para el QR; ambos mecanismos están implementados. Ver página 14. 

La documentación del proyecto describe Kotlin/MVVM y MySQL para una futura aplicación móvil. Esta entrega es la **versión web funcional** solicitada, por lo que utiliza Next.js + PostgreSQL, pero conserva las reglas de negocio, estados y contratos de API. Ver páginas 17–20.

---

# PASO A PASO PARA PONERLA EN FUNCIONAMIENTO

## 1. Instalar Node.js

Usa Node.js 20 LTS o superior. Comprueba:

```bash
node -v
npm -v
```

## 2. Instalar pnpm

El proyecto declara pnpm como gestor:

```bash
npm install -g pnpm
pnpm -v
```

## 3. Crear la base de datos PostgreSQL

Puedes usar PostgreSQL local o un proveedor PostgreSQL en la nube.

Crea una base llamada, por ejemplo:

```text
rescate_mermas
```

Obtén su cadena de conexión:

```text
postgresql://USUARIO:CONTRASEÑA@HOST:5432/rescate_mermas
```

## 4. Crear el archivo `.env.local`

Copia `.env.example` como `.env.local` y completa:

```env
DATABASE_URL=postgresql://...
BETTER_AUTH_URL=http://localhost:3000
```

**No publiques `.env.local` en GitHub.**

## 5. Instalar dependencias

Desde la carpeta raíz:

```bash
pnpm install
```

Si el proyecto fue descargado sin un lock actualizado por pnpm, ejecuta `pnpm install` normal (no `--frozen-lockfile`) para que pnpm actualice `pnpm-lock.yaml` con las nuevas dependencias de QR.

## 6. Crear las tablas

### Base nueva

Ejecuta primero `db/000_schema.sql`. Este archivo crea las tablas de autenticación, usuarios, donaciones y reservas.

### Base que ya usaba la versión anterior

No ejecutes `000_schema.sql` si las tablas ya existen. Conserva la base y continúa con `001` y `002`.

## 7. Ejecutar las migraciones de este proyecto

### Si la base es NUEVA

Ejecuta:

```bash
psql "TU_DATABASE_URL" -f db/000_schema.sql
psql "TU_DATABASE_URL" -f db/002_roles_geolocation_qr.sql
```

### Si vienes de la base de la versión anterior

Ejecuta:

```bash
psql "TU_DATABASE_URL" -f db/001_rescate_integrity.sql
psql "TU_DATABASE_URL" -f db/002_roles_geolocation_qr.sql
```

No ejecutes `001` después de `000`, porque `000` ya crea las claves foráneas del esquema nuevo.

También puedes abrir ambos archivos en el SQL Editor de tu proveedor PostgreSQL y ejecutarlos en ese orden.

## 8. Arrancar la web

```bash
pnpm dev
```

Abre:

```text
http://localhost:3000
```

## 9. Crear el primer administrador

Por seguridad, **el formulario público nunca permite registrarse como administrador**.

1. Entra a `/sign-up`.
2. Registra una cuenta cualquiera.
3. Copia el correo utilizado.
4. En PostgreSQL ejecuta:

```sql
UPDATE "user"
SET "role" = 'admin',
    "verificationStatus" = 'approved',
    "updatedAt" = NOW()
WHERE "email" = 'TU_CORREO_ADMIN';
```

5. Cierra sesión.
6. Vuelve a entrar.
7. En el dashboard aparecerá **Panel administrativo**.

## 10. Crear las cuentas de prueba

Crea dos cuentas:

### Cuenta Donante

Selecciona:

```text
Donante · restaurante / supermercado / panadería
```

### Cuenta Receptor

Selecciona:

```text
Receptor · comedor / ONG / albergue
```

Al principio estarán como `pending`.

Entra con el administrador → **Panel administrativo** → aprueba ambas organizaciones.

## 11. Probar el flujo completo

### Flujo A — Donante

1. Iniciar sesión.
2. Ver estado aprobado.
3. Pulsar **Publicar lote**.
4. Introducir producto.
5. Introducir cantidad.
6. Tomar/subir foto.
7. Indicar dirección.
8. Usar ubicación GPS.
9. Establecer hora límite.
10. Publicar.

El lote aparece como `Disponible`.

### Flujo B — Receptor

1. Cerrar sesión.
2. Entrar con la cuenta Receptor.
3. Permitir ubicación del navegador.
4. Elegir radio: 5, 15, 30 o 50 km.
5. Ver lotes ordenados por distancia.
6. Pulsar **Reservar lote**.
7. El lote pasa a `Reservado`.
8. Aparece un QR único.
9. También aparece un código de 6 dígitos.

### Flujo C — Entrega

1. El receptor llega al punto de recojo.
2. El donante abre **Validar recojo**.
3. Escanea el QR del receptor.
4. Si la validación es correcta, la reserva pasa a `completed` y el lote a `delivered`.
5. Se registra la fecha de entrega.

Si la cámara falla, el donante puede utilizar el código de 6 dígitos como respaldo.

## 12. GPS y cámara

En desarrollo local, Chrome permite cámara/GPS en `localhost`.

En producción debes utilizar **HTTPS** para que el navegador pueda conceder permisos de ubicación y cámara.

## 13. Publicar en producción

Una ruta sencilla es:

1. Subir el proyecto a GitHub.
2. Crear PostgreSQL administrado.
3. Crear un proyecto en tu plataforma de hosting para Next.js.
4. Conectar el repositorio.
5. Configurar:

```env
DATABASE_URL=...
BETTER_AUTH_URL=https://TU-DOMINIO.com
```

6. Ejecutar las migraciones SQL contra la base de producción.
7. Hacer deploy.
8. Abrir la web por HTTPS.
9. Crear la cuenta administrador y promoverla mediante SQL.
10. Crear las cuentas Donante/Receptor y aprobarlas.
11. Probar el ciclo completo en dos navegadores/celulares.

## 14. Prueba mínima antes de presentar

Debes comprobar al menos:

- [ ] Registro Donante.
- [ ] Registro Receptor.
- [ ] Creación de Administrador.
- [ ] Aprobación/rechazo de usuarios.
- [ ] Publicación de lote.
- [ ] Foto.
- [ ] GPS.
- [ ] Filtro por radio.
- [ ] Haversine.
- [ ] Reserva.
- [ ] Intento de doble reserva simultánea.
- [ ] Cancelación.
- [ ] Generación QR.
- [ ] Lectura QR.
- [ ] Código manual de 6 dígitos.
- [ ] Entrega confirmada.
- [ ] Historial/estado del lote.
- [ ] Métricas del dashboard.

## 15. Importante para producción real

El documento plantea una plataforma para alimentos aptos para consumo y señala riesgos sanitarios, fraude, conectividad, privacidad y cambios normativos. La aplicación no sustituye controles sanitarios ni la validación legal de las organizaciones.

Para una versión productiva conviene añadir:

- almacenamiento de fotos (S3/Cloudinary/Supabase Storage);
- auditoría de acciones administrativas;
- notificaciones email/push;
- límites anti-abuso;
- política de privacidad y términos;
- validaciones sanitarias y documentación de organizaciones;
- backups automáticos;
- monitoreo y logs;
- pruebas de carga para el endpoint geoespacial.


## Migración adicional v0.4.1

En una copia respaldada de la base de datos, aplica `db/006_profiles_and_food_windows.sql` y `db/007_persistent_auth_rate_limit.sql` después de las migraciones 004 y 005; luego aplica también 008 después de 007 para el peso en kg declarado. La migración 007 crea la tabla persistente que Better Auth utiliza para limitar solicitudes a autenticación. La migración 008 añade el campo opcional `quantityKg` para registrar peso real declarado. La migración conserva datos históricos y asigna a lotes existentes el límite de recojo conocido como fecha conservadora de vencimiento si no tenían fecha de alimento.


### Limitación operativa del cron

La configuración `vercel.json` usa una ejecución diaria (09:00 UTC) por compatibilidad con Vercel Hobby. La liberación/actualización de estados también se intenta en las consultas de las API que llaman `refreshLifecycle()`. Para una actualización programada cada 5 minutos (más adecuada para reservas de 30 minutos), se necesita un plan de Vercel que admita ese intervalo o un servicio externo de cron autorizado con `CRON_SECRET`. La precisión horaria del plan debe comprobarse en el proveedor.
