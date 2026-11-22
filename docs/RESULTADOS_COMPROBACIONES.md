# Resultados de comprobaciones — Rescate v0.4.2

Fecha: 1 de noviembre de 2026. Se separan los resultados reportados desde la computadora del usuario de las comprobaciones reproducidas durante la preparación de v0.4.2.

## Resultados reportados desde Windows

| Comprobación | Resultado visible | Interpretación correcta |
|---|---|---|
| `npm ci` | Instaló 433 paquetes | Instalación finalizó, pero reportó vulnerabilidades. |
| `npm test` en v0.4.1 | 17 aprobadas, 3 fallidas | Las tres fallas tienen la misma causa: `ENOENT` al leer `.env.example`. No son tres fallas funcionales distintas. |
| `npm run typecheck` | Se lanzó `tsc --noEmit`; después empezó `npm run build` | No aparecen errores de TypeScript en el registro compartido, por lo que parece haber finalizado con éxito; repetir en v0.4.2 para confirmar. |
| `npm run build` | Compiló, terminó TypeScript, recopiló datos y generó 23/23 páginas/rutas | El build finalizó, pero Better Auth advirtió que la base activa no contiene `rateLimit`, `user.taxId`, `user.privacyConsent` ni `user.privacyConsentAt`. Es un problema de esquema de base de datos pendiente. |
| `npm audit` | 20 vulnerabilidades: 2 bajas, 8 moderadas, 8 altas y 2 críticas | No desplegar públicamente hasta planificar y probar la actualización de dependencias vulnerables. No usar `npm audit fix --force` sin revisar compatibilidad. |

## Corrección de empaquetado en v0.4.2

- Se incluye el archivo canónico `.env.example` y una copia visible `env.example`.
- La prueba estática busca el archivo visible como alternativa si un proceso de extracción no dejó el dotfile.
- En las comprobaciones de preparación, `node --test tests/static-regression.test.mjs` pasó **20/20**, incluso simulando que `.env.example` no está presente. El usuario debe repetir `npm test` sobre el ZIP v0.4.2.
- Se agregó `scripts/apply-v041-upgrades.ps1` para aplicar las migraciones incrementales 005–008, con modo de vista previa y confirmación explícita. Hacer un respaldo y verificar `DATABASE_URL` antes de aplicar.

## Próximas acciones obligatorias

1. Descomprimir v0.4.2 en una carpeta nueva e instalar con `npm ci`.
2. Ejecutar `npm test`, `npm run typecheck` y `npm run build`; guardar las salidas completas.
3. Hacer respaldo de PostgreSQL y aplicar las migraciones 005–008 a la base exacta indicada por `.env.local`. No ejecutar `db/000_schema.sql` contra una base existente con datos.
4. Repetir el build tras las migraciones; confirmar que desaparecen los avisos de esquema de Better Auth.
5. Revisar `npm audit` y actualizar Next.js/dependencias a versiones parcheadas; repetir todas las pruebas. Las dos vulnerabilidades críticas y las ocho altas deben tratarse como impedimento para publicar en Internet hasta resolverse o aceptarse formalmente en una evaluación controlada.
6. La clave `BETTER_AUTH_SECRET` que apareció en el registro compartido debe considerarse expuesta: generar otra y reemplazarla en `.env.local`. No volver a pegarla en capturas o informes.

## Lo que aún no está verificado

Estas evidencias no sustituyen las pruebas de API con PostgreSQL, las pruebas de concurrencia, k6, OWASP ZAP, Lighthouse, las pruebas en dispositivos móviles, la aceptación de usuarios ni la validación de un despliegue HTTPS. No se certifica todavía el 100 % funcional.
