# Reproducción

Desde la raíz del proyecto, entrar en Codigo. La integración reinicia servicios y revoca y restaura un rol de demostración.

~~~powershell
Set-Location .\Codigo
.\scripts\start-demo.ps1
docker compose ps
node scripts/check-before-commit.mjs --working-tree
.\scripts\test-all.ps1
~~~

| Casos | Script desde Codigo | Condición y comprobación |
|---|---|---|
| T01 | scripts/test-independence.ps1 | Ambos servicios iniciados. Detiene cada uno por turno y consulta health del otro. |
| T02–T07, T11–T12 | scripts/test-core-security.ps1 | Usuarios demo. Verifica login, asignaciones, revocación, propiedad y auditoría. Restaura ANALYST. |
| T08 | scripts/test-fail-closed.ps1 | JWT ANALYST vigente. Detiene AUTH, verifica 503 y restaura AUTH. |
| T09 | scripts/test-detector.ps1 | Usa seis PNG de samples. Guarda puntaje y clase. |
| T10 | scripts/test-t10.ps1 | Genera fixtures en tmp/t10. Verifica HTTP, registros error y SHA-256. |

Ejecutar la suite completa para que el reinicio entre grupos limpie el limitador de login. Para las sondas, consultar /docs-json de los dos servicios y las tablas information_schema.columns y pg_constraint en PostgreSQL. Probar una entrada SQL de prueba en login, cabeceras de rol en operaciones protegidas, el endpoint interno con y sin su credencial, y la decisión para dos UUID distintos. Enviar un x-request-id único con un análisis y filtrar los logs de ambos servicios por ese identificador. La evidencia depurada de estas sondas está en [sondas.txt](evidencia/sondas.txt).

Para Postman, importar la colección QA y el entorno desde pruebas/postman-export, configurar la CA local, completar credenciales de demostración localmente y seguir el orden del plan pre-commit. Guardar el resumen del Runner sin tokens.
