# Plan de pruebas previo al commit — Backend V1

Fecha: 4 de noviembre de 2026. Alcance: AUTH, STEGO, despliegue local y contratos del primer parcial.

## Regla de aceptación

Todo commit que cambie `Unidad 1/Proyecto/Codigo/` debe aprobar el control automático sobre sus archivos **staged**. Una prueba fallida, Docker no disponible, dependencias ausentes, un secreto preparado o una colección inválida bloquean el commit.

Las pruebas manuales de Postman complementan esta barrera. Su ejecución debe registrarse aparte: el hook no afirma que haya utilizado la GUI de Postman.

## Preparación y ejecución

Desde `Codigo`, con Node 24 y Docker Desktop disponibles:

```powershell
npm ci --prefix auth
npm ci --prefix stego
node scripts/install-git-hooks.mjs
```

El instalador configura `core.hooksPath` solo en este repositorio y se detiene si encuentra otro hook que tendría que reemplazar. Cada clon debe instalarlo. Git no distribuye automáticamente la configuración local.

Para comprobar el área de trabajo antes de preparar los cambios:

```powershell
node scripts/check-before-commit.mjs --working-tree
```

En el siguiente commit normal, el hook prueba una copia temporal del índice Git. Usa las dependencias instaladas y exige que los locks preparados coincidan con los del área de trabajo. No prepara archivos, no crea commits ni publica cambios. La compilación del snapshot y PostgreSQL de los e2e son temporales; no modifican los datos de demostración.

## Barrera automática obligatoria

| ID | Comprobación | Resultado requerido |
|---|---|---|
| G01 | Archivos staged y whitespace | Sin claves privadas, JWT activos, `.env`, bases de datos ni errores de whitespace |
| G02 | Colección QA independiente | JSON válido, scripts parseables, assertions y muestras existentes; contraseñas/JWT exportados vacíos |
| G03 | Lint de ambos servicios | Código de salida 0; revisar advertencias |
| G04 | Build de ambos servicios | Compilación sin errores |
| G05 | Unitarias AUTH | Firma, claims, expiración, roles vigentes, logout y redacción de auditoría |
| G06 | Unitarias STEGO | Validación de archivos, límites, autorización, propiedad, errores, PNG de 16 bits y regresión del detector |
| G07 | E2E AUTH con PostgreSQL temporal | AppModule, migración, API y guards reales; HTTP 400/401/403/409; roles nuevos, cambio de contraseña y esquemas |
| G08 | E2E STEGO compilado | Guards antes de multipart, SQLite, análisis, límites y esquemas; AUTH simulado en la frontera externa |

Línea base actual: **34 unitarias y 17 e2e**. Se deben aprobar todos los casos existentes; el número no es un límite fijo. El control falla con el código de salida de cada herramienta.

### G09 — Integración real para cambios de seguridad o despliegue

Antes de confirmar cambios de AUTH, STEGO, Compose, claves o políticas, ejecutar también:

```powershell
.\scripts\start-demo.ps1
.\scripts\test-all.ps1
```

Incluye T01–T12, revocación, caída de AUTH, archivos y auditoría. Reinicia servicios y revoca/restaura el rol ANALYST de demostración. Por esos efectos, G09 se ejecuta explícitamente en el entorno local del proyecto y no desde el hook. Registrar su resultado antes del commit correspondiente.

## Colección nueva de Postman

Nombre: **QA Backend V1 | Pre-commit y regresion | Nueva**.

- `pruebas/postman-export/QA_Backend_V1.postman_collection.json`.
- `pruebas/postman-export/QA_Backend_V1.postman_environment.json`.

Para Postman 12 en modo local, la misma colección está convertida a YAML v3 dentro de `pruebas/postman/postman/collections/QA_Backend_V1/`, con el entorno `pruebas/postman/postman/environments/QA_Backend_V1.environment.yaml`. Los JSON de `postman-export` sirven para importación compatible.

Son archivos propios. Las colecciones anteriores y las de otros proyectos permanecen intactas. El entorno QA usa variables `qa_*`; el archivo exportado contiene contraseñas y tokens vacíos.

### Preparación de Postman

1. Iniciar servicios y datos con `scripts/start-demo.ps1`, si hace falta.
2. Desde `stego`, ejecutar `node scripts/generate-t10-fixtures.mjs`. Las muestras de referencia están en `samples`.
3. Abrir/importar únicamente los dos archivos QA nuevos y seleccionar el entorno QA.
4. Configurar la CA de desarrollo `secrets/tls/ca.crt` en Postman. No desactivar globalmente la verificación TLS ni publicar la clave privada. Si aún no está configurada, registrar las pruebas HTTPS como bloqueadas hasta configurarla.
5. Completar **localmente** `qa_adminPassword`, `qa_analystPassword` y `qa_userPassword` con las credenciales de demostración configuradas. Las identidades por defecto son admin, analyst y user. No exportar ni sincronizar JWT activos.
6. Seleccionar los archivos de Body/form-data si Postman no resuelve rutas relativas a `Codigo`. No enviar imágenes a servicios externos.
7. Si una sesión anterior agotó el rate limit, esperar su vencimiento. No debilitar el límite para aprobar la prueba. La colección abre tres sesiones; el límite de login se verifica aparte.

### Orden de ejecución

| Grupo | Resultado esperado | Precauciones |
|---|---|---|
| 01 Preparación/sesiones | Health 200; login 201; IDs y JWT disponibles; perfil sin hash ni tokenVersion | Ejecutar primero |
| 02 Validación/contratos | UUID, fecha, null y campos extra: 400; duplicado: 409; contratos 200 con esquemas | Las entradas inválidas no deben modificar usuarios |
| 03 Autenticación/permisos | Sin token o manipulado: 401; USER: 403; asignación duplicada: 409; servicio sin identidad: 401 | Mantener separadas las tres identidades |
| 04 Imágenes/resultados | Referencia sin_indicios; carga densa sospechoso; ruido no_concluyente; inválidos 415/422/413; lecturas autorizadas 200 | Revisar SHA-256, métricas, técnica, fecha, política y limitaciones |
| 05 Revocación/restauración | Revocar 200; **mismo JWT**: 403; restaurar 201; analizar de nuevo 201 | Ejecutar completo. Restaurar el rol si se interrumpe |
| 06 Logout | Logout 201; reutilizar JWT: 401 | Ejecutar al final; repetir preparación para otra sesión |
| MANUAL Disponibilidad | Con AUTH detenido: STEGO 503, sin analizar | Excluir del Runner general; restaurar AUTH inmediatamente |

El caso de carga dispersa obtiene `sin_indicios` en el corpus actual: es una **limitación conocida**, no prueba de ausencia de datos ocultos. `sospechoso` tampoco demuestra esteganografía de forma concluyente.

## Trazabilidad con el PDF y la auditoría

| Requisito | Cobertura |
|---|---|
| T01 Independencia de APIs | G09: `test-independence.ps1` |
| T02 Login válido e inválido | G05/G07/G09; Postman sesiones |
| T03 JWT ausente, manipulado o vencido | G05/G06/G08/G09; Postman SEC-01/02. El vencido se comprueba en `test-core-security.ps1` |
| T04 USER sin privilegios | G07/G08; SEC-03 |
| T05/T06 N:M y unicidad | G07/G09; SET-01/02/03 y SEC-04 |
| T07 Revocación inmediata | G05/G09; grupo 05 |
| T08 AUTH inaccesible | G08 simulado; G09 y DIS-01 reales |
| T09 Detector verificable | G06; grupo 04; generador con mensaje LSB recuperable |
| T10 Archivos y límites | G06/G08/G09; IMG-05/06/07 |
| T11 Propiedad de resultados | G06/G09; no sustituirlo por un USER que carezca del permiso general |
| T12 Auditoría depurada | G05/G07/G09: actor, recurso, requestId y ausencia de secretos |
| Hallazgos recientes | G06/G08: PNG 16 bits; G07: 400/409, roles nuevos, contraseña y esquemas; G05: JWT sin exp y redacción |

## Evidencias y decisión de commit

Registrar fecha, rama, hash o árbol staged, comando/carpeta, resultado esperado, resultado real, estado aprobado/fallido/bloqueado, defecto asociado y limpieza efectuada.

El gate escribe un resumen local ignorado en `tmp/precommit-result.json`; el modo staged incluye el identificador del árbol probado. Para Postman, guardar el resumen del Runner y respuestas depuradas. Ocultar JWT, contraseñas y claves antes de capturar/exportar.

Un caso fallido o bloqueado no se convierte en aprobado por ejecutar otro. Las pruebas anteriores con Jest/Vitest/scripts **no cuentan como ejecución de la colección nueva en Postman**. Su ejecución y aprobación se registran por separado.

Referencia de formato local: [documentación oficial de Postman v3](https://learning.postman.com/docs/collections/collections-schemas).
