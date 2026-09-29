# Actividad 1: Identificación y Clasificación de Activos de Seguridad - SecureShop

## 1. Contexto del Sistema
**SecureShop** es una plataforma de comercio electrónico de productos tecnológicos construida bajo una arquitectura de microservicios, compuesta por:
- Un **API Gateway** como único punto de entrada de solicitudes externas.
- Microservicio **User Service** (gestión de usuarios).
- Microservicio **Product Service** (catálogo y stock de productos).
- Microservicio **Order Service** (gestión y procesamiento de pedidos).
- Bases de datos desacopladas para cada dominio.

---

## 2. Matriz de Identificación, Clasificación y Análisis de Impacto de Activos

A continuación, se listan **10 activos clave** clasificados según su tipología:

| Activo | Tipo | Consecuencia de ser Accedido, Modificado o Quedar Indisponible |
| :--- | :--- | :--- |
| **1. Credenciales de acceso y tokens (Hashes de contraseñas, claves JWT, API Keys)** | Información | **Acceso no autorizado:** Suplantación de identidad de clientes y administradores, escalamiento de privilegios y fuga masiva de cuentas.<br>**Modificación:** Bloqueo de acceso legítimo a los usuarios o generación de puertas traseras.<br>**Indisponibilidad:** Imposibilidad de autenticar solicitudes en el API Gateway, interrumpiendo el acceso total a la plataforma. |
| **2. Datos personales de los clientes (Nombres, correos, teléfonos, direcciones de entrega)** | Datos | **Acceso no autorizado:** Violación a la privacidad/normativas de protección de datos personales, multas legales y pérdida severa de reputación.<br>**Modificación:** Envíos erróneos de pedidos, fraude o suplantación en entregas.<br>**Indisponibilidad:** Imposibilidad de consultar destinatarios para despachos y retrasos operativos en logística. |
| **3. API Gateway** | Software | **Acceso/Compromiso:** Control del punto único de entrada, permitiendo interceptar o redirigir todo el tráfico legítimo hacia destinos maliciosos.<br>**Modificación:** Alteración de reglas de enrutamiento, bypass de rate limiting y eliminación de filtros de seguridad.<br>**Indisponibilidad:** Caída total de la plataforma SecureShop hacia el cliente (punto único de falla). |
