# Auditoría del Proyecto Integrador — Backend V1

## A. Diagnóstico ejecutivo

| Indicador | Resultado |
|---|---|
| Estado | Éxito parcial. Flujo funcional y suite oficial aprobados. Quedan brechas en autenticación entre servicios, alcance de la decisión por recurso y evidencias de entrega. |
| Nota técnica estimada | **18,5/20**. La calificación corresponde al docente. |
| Pruebas oficiales | **12 aprobadas, 0 fallidas, 0 sin verificar** en Docker Compose. |
| Pruebas automáticas adicionales | **51 aprobadas** en el control local, 34 unitarias y 17 de extremo a extremo. |
| Hallazgos críticos | 0 identificados en la revisión local. |
| Preparación para sustentación | Sí, con observaciones. |
| Versión | HEAD base `2eb473f18a2f7a233cad24faa5b19a46d506961f`, con cambios locales, incluida la migración. Véase [huellas del código evaluado](evidencia/huellas.txt). |
| Fecha | 5 de noviembre de 2026, Ecuador. |

Fuente normativa: [enunciado oficial](../Proyecto_Integrador_Primer_Parcial.pdf). Pruebas ejecutadas contra el entorno local de demostración. El reporte se guardó en la carpeta de documentación ignorada por Git.

## B. Rúbrica desglosada

| Criterio | Máximo | Nivel | Estimación | Evidencia y observaciones |
|---|---:|---|---:|---|
| Arquitectura | 3 | Excelente | 3 | Dos aplicaciones NestJS con contenedores y almacenamiento propios. T01 comprueba disponibilidad independiente. |
| Identidad | 3 | Excelente | 3 | PostgreSQL con nombres del Anexo C, restricciones verificadas, 3 de 3 contraseñas Argon2id y relación N:M demostrada. |
| Autenticación JWT | 3 | Excelente | 3 | Firma RS256, casos negativos, logout, revocación de sesión y límite 429 verificados. |
| RBAC e integración | 4 | Satisfactorio | 3 | T04, T07, T08 y T11 pasan. El valor por defecto permite autenticarse como servicio en el entorno local. AUTH decide por acción y STEGO aplica la propiedad del recurso. |
| Esteganografía | 5 | Excelente | 5 | Seis PNG con métricas reales, cuatro clasificaciones comprobadas incluyendo `error`, registros consultables y límites de carga. |
| Pruebas y documentación | 2 | Satisfactorio | 1,5 | OpenAPI en ejecución, 12 pruebas oficiales y evidencias, informe y diagramas locales. Queda consolidar el paquete de entrega y registrar el Runner de Postman. |
| **Total** | **20** | | **18,5** | |

## C. Matriz de pruebas oficiales

La preparación, los comandos y las fuentes se detallan en [reproducción](comandos_reproduccion.md). Los resultados proceden de [integración](evidencia/integracion.txt) y [sondas adicionales](evidencia/sondas.txt).

| ID | Esperado | Observado | Estado |
|---|---|---|---|
| T01 | Cada API responde con el otro servicio detenido | AUTH y STEGO respondieron 200 en las dos pruebas de independencia | Aprobada |
| T02 | Credenciales válidas emiten JWT, credenciales incorrectas se rechazan | JWT emitido y 401 para contraseña incorrecta | Aprobada |
| T03 | Rechazar JWT ausente, manipulado o expirado | 401 en los tres casos | Aprobada |
| T04 | USER carece de permiso de análisis | 403, también al inyectar cabeceras de rol | Aprobada |
| T05 | Dos roles para un usuario y un rol compartido | ANALYST y USER asignados al analista. USER compartido con el usuario de prueba | Aprobada |
| T06 | La asignación duplicada se bloquea | 409 y restricción UNIQUE confirmada en PostgreSQL | Aprobada |
| T07 | Revocación efectiva con JWT todavía vigente | 201 antes y 403 con el mismo JWT después | Aprobada |
| T08 | Denegar análisis si AUTH no responde | 503 durante la caída y 200 en la comprobación de recuperación de AUTH | Aprobada |
| T09 | Procesar originales y cargas LSB con métricas | Seis muestras clasificadas según lo esperado. La carga densa dio `sospechoso` | Aprobada |
| T10 | Rechazar tamaño, formato y PNG corrupto | 413, 415 y 422. Dos 422 produjeron registros `error` con SHA-256 validado. Los análisis sin error siguieron en 43 | Aprobada |
| T11 | Bloquear la lectura de un análisis ajeno | 403. La sonda de control obtuvo 200 como propietario y 404 para UUID inexistente | Aprobada |
| T12 | Trazabilidad sin secretos | Auditoría administrativa aprobada. La sonda correlacionó `authorization_decision` y `analysis_completed` con el mismo identificador | Aprobada |

## D. Contratos REST

Las 14 combinaciones de método y ruta exigidas se verificaron en OpenAPI servido por ambos contenedores. Los resultados de comportamiento proceden de la integración, las pruebas e2e o las sondas, según se indica.

| Operaciones | Acceso | Evidencia |
|---|---|---|
| POST /api/auth/login, GET /api/auth/profile, POST /api/auth/logout | Pública, sesión, sesión | Login 201/401, perfil e2e depurado, reutilización tras logout 401 |
| POST y GET /api/users, PATCH /api/users/{id} | ADMIN | Creación y actualización cubiertas por e2e. Sonda GET con USER y cabeceras ADMIN devuelve 403 |
| POST y GET /api/roles, PATCH /api/roles/{id} | ADMIN | OpenAPI para las tres, creación de rol e2e. GET/PATCH quedan sin una transcripción funcional individual en esta auditoría |
| POST /api/user-roles, DELETE /api/user-roles/{id} | ADMIN | Integración y e2e comprueban asignación, duplicados y retiro |
| POST /internal/authorization/check | Identidad de servicio y JWT del usuario | 401 sin credencial de servicio. S01 y S02 documentan sus límites |
| POST /api/steganography/analyze, GET /api/steganography/results/{id} | JWT vigente, rol y propiedad cuando aplica | 201, 200, 401, 403, 404, 413, 415, 422 y 503 observados en los casos descritos |

## E. Seguridad y F. Esteganografía

**S01 · Media en loopback. Alta si se amplía la exposición.** El valor de demostración del token de servicio está declarado en [Compose, líneas 29 y 51](../../Codigo/docker-compose.yml#L29), y [AUTH lo compara con la cabecera recibida](../../Codigo/auth/src/auth/auth.controller.ts#L63). La sonda envió el valor por defecto a la ruta publicada y llegó a la decisión de autorización. El JWT USER siguió recibiendo una decisión negativa. El impacto comprobado es la suplantación de la identidad de servicio en el entorno local. Corregir mediante un secreto aleatorio generado por instalación, compartido solo por AUTH y STEGO. Regresión: valor por defecto y token ausente producen 401. STEGO con su credencial válida sigue funcionando.

**S02 · Media, alcance de la decisión.** [El guard de STEGO envía el identificador de recurso](../../Codigo/stego/src/steganography/authorization.guard.ts#L25), pero [AUTH decide solo por acción y roles](../../Codigo/auth/src/auth/auth.service.ts#L94). AUTH devolvió `allowed=true` para un resultado propio y para un UUID inexistente. [STEGO aplica existencia y propiedad en SQLite](../../Codigo/stego/src/steganography/stego.service.ts#L294). El control final de acceso funcionó. Documentar la división de responsabilidad y contrastarla con el docente. Si la decisión de AUTH debe abarcar el recurso, incorporar contexto verificable desde STEGO y probar explícitamente recurso propio, ajeno e inexistente.

**Comprobaciones complementarias.** Una entrada SQL de prueba en login devolvió 401. Las cabeceras de rol fabricadas devolvieron 403 en AUTH y STEGO. JWT con firma, emisor, audiencia o algoritmo inválidos se rechazaron. `npm audit --omit=dev` reportó 0 avisos para ambos servicios en esta consulta. Es un resultado acotado a las dependencias de ejecución de Node, no al sistema operativo del contenedor. No se certificó la revisión de todo el historial Git, un escaneo de imágenes, ni la respuesta bajo concurrencia sostenida.

| Muestra | Estado | Puntaje |
|---|---|---:|
| Referencia | sin_indicios | 0 |
| Tablero | sin_indicios | 0 |
| Ruido original | no_concluyente | 0,998324 |
| Carga LSB densa | sospechoso | 0,997958 |
| Carga LSB dispersa | sin_indicios | 0,076248 |
| Patrón intermedio | no_concluyente | 0,937497 |
| PNG corrupto y PNG con píxeles excesivos | error, HTTP 422 | Sin puntaje |

La clasificación usa proporción de unos, tasa de transiciones, chi-cuadrado y contraste con el segundo plano. La carga dispersa ilustra un falso negativo posible. El puntaje es una heurística. Los resultados experimentales corresponden al corpus de demostración.

## G. Entregables y límites de la evidencia

El enunciado, PDF, diagramas, LaTeX, guía y evidencias están en [documentacion](../README.md), ignorada por Git por decisión del equipo. El PDF conserva una ejecución anterior. El código, los contratos generados, el plan operativo, la colección y las muestras están en `Codigo`. Falta decidir cómo acompañará la documentación a la versión que verá el docente. La colección QA está versionada y su validación automática aprobó. La corrida en la interfaz de Postman sigue pendiente. No se ejecutó un ensayo de persistencia de STEGO recreando su contenedor como parte de esta auditoría. La integración sí comprobó acceso a registros persistidos y reinició servicios.

## H. Plan de corrección

1. Eliminar el token fijo como opción de arranque en S01 y repetir las pruebas de integración y las sondas del endpoint interno.
2. Confirmar con el docente la división por recurso en S02 y hacer explícito el contrato. Conservar la comprobación de propiedad y el fallo seguro en la regresión.
3. Ejecutar el Runner de Postman. Registrar la versión evaluada, fecha, casos y respuestas depuradas. Añadir evidencia individual de GET/PATCH de roles y persistencia tras recreación de STEGO.
4. Consolidar el paquete final de documentación para el docente con la evidencia reciente.

## I. Guion de sustentación

Mostrar contenedores y Swagger. Iniciar sesión como analista, subir la muestra densa y consultar el análisis. Mostrar una asociación N:M y un 409 por duplicado. Repetir el análisis con el mismo JWT tras revocar el rol. Restaurar el rol. Detener AUTH, demostrar el 503 y recuperar el servicio. Cerrar con el identificador de correlación y la suite aprobada. Véanse [los comandos](comandos_reproduccion.md).

