# Solución de los errores observados en Windows

## 1. `npm test` indica que falta `.env.example`

v0.4.2 incluye tanto `.env.example` como `env.example`. La prueba busca el archivo oculto y utiliza el respaldo visible si el extractor omitió el dotfile. Si estás en una carpeta antigua, vuelve a extraer el ZIP v0.4.2 en una carpeta nueva. Para crear `.env.local`, ejecuta en CMD:

```bat
if exist .env.example (copy .env.example .env.local) else (copy env.example .env.local)
```

Si ya existe `.env.local`, no lo sobrescribas; conserva `DATABASE_URL` y los valores correctos, pero genera un nuevo `BETTER_AUTH_SECRET` porque la clave anterior apareció en un registro compartido.

## 2. Aviso de Better Auth por esquema PostgreSQL

Si ves `Missing tables rateLimit` o `Missing columns user.taxId`, `user.privacyConsent`, `user.privacyConsentAt`, la base configurada en `DATABASE_URL` está atrasada respecto del código. Antes de migrar, haz un respaldo y confirma que apuntas a la base correcta. En PowerShell desde la raíz del proyecto ejecuta primero:

```powershell
./scripts/apply-v041-upgrades.ps1
```

Si el modo de vista previa muestra los archivos esperados y ya existe un respaldo, ejecuta:

```powershell
./scripts/apply-v041-upgrades.ps1 -Apply
```

Escribe `APLICAR` solo después de verificar el respaldo y la base. Después vuelve a ejecutar `npm test`, `npm run typecheck` y `npm run build`. No ejecutes `db/000_schema.sql` sobre una base existente con datos.

## 3. Vulnerabilidades de `npm audit`

El informe compartido encontró 20 vulnerabilidades, incluidas dos críticas. No uses `npm audit fix --force` sin plan de actualización y pruebas, ya que puede instalar versiones incompatibles. Resuelve primero los avisos, actualiza Next.js y dependencias de forma controlada, y vuelve a ejecutar todo. No se debe considerar el proyecto apto para despliegue público mientras queden vulnerabilidades críticas sin resolver.
