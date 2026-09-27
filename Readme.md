# 🚀 GestionCloud | E-Commerce B2B/B2C & CMS Tecnológico

Plataforma e-commerce moderna, modular y autoadministrable orientada a la comercialización de hardware de alto rendimiento (PCs armadas especializadas), soluciones de cartelería digital (**Xibo**) y sistemas de seguridad (**CCTV Hikvision**).

El sistema está diseñado bajo una arquitectura limpia y robusta, separando responsabilidades mediante **POO (Programación Orientada a Objetos)** y el patrón **MVC**, ideal para entornos de producción en Home Labs y despliegues cloud agnósticos.

---

## 🛠️ Stack Tecnológico & Arquitectura

* **Backend / Servidor**: Node.js, Express.
* **Patrón de Diseño**: MVC (Model-View-Controller) + Servicios desacoplados con POO (Clases en JavaScript y manipulación avanzada de arreglos mediante `.map()`, `.filter()`, `.reduce()`).
* **Base de Datos**: PostgreSQL 15.
* **ORM**: Sequelize (con sincronización automatizada y auditoría de acciones).
* **Frontend**: Tailwind CSS (UI moderna y responsiva con modo oscuro espacial y acentos azul cian), FontAwesome.
* **Seguridad & Resiliencia**: Helmet.js, Express-Rate-Limit (protección contra fuerza bruta en logins), BCrypt para hashing de contraseñas y Express-Session.
* **Contenedorización**: Docker y Docker Compose.

---

## 💻 Módulos Principales y Funcionalidades

1. **Catálogo Priorizado y Dinámico**:
   * Ordenamiento inteligente priorizando **PCs Armadas** (Escolar, Oficina, Diseño y Arquitectura, Alto Procesamiento, Gamer, Gamer Pro), seguido de cartelería digital y CCTV.
   * Filtros dinámicos mediante Endpoints API REST asincrónicos.

2. **CMS Autoadministrable Integrado**:
   * Panel de control exclusivo para administradores y empleados logueados.
   * Edición en vivo de textos globales de la web, títulos principales, subtítulos, logo de marca y redes sociales.
   * ABM completo para la publicación y eliminación de productos y banners promocionales de marcas.

3. **Canal de Venta Directa (Sin Comisiones)**:
   * Integración directa con botones y enlaces flotantes de **WhatsApp**, generando mensajes automáticos precargados con el detalle del producto, precio de transferencia/alias y datos del cliente.

4. **Cumplimiento Normativo (Ley 24.240)**:
   * Secciones de preguntas frecuentes (FAQ), plazos de entrega, garantía y políticas de devolución.

---

## 📂 Estructura de Directorios

```text
gestioncloud-app/
├── src/
│   ├── config/         # Conexión a Base de Datos (Sequelize) y Logger (Winston)
│   ├── models/         # Modelos relacionales (Product, User, Banner, Setting, AuditLog)
│   ├── services/       # Lógica de negocio orientada a objetos (POO) y métodos de arreglos
│   ├── controllers/    # Controladores HTTP y renderizado de vistas dinámicas
│   └── app.js          # Punto de entrada de la aplicación y rutas del servidor
├── logs/               # Registro de errores y actividad del sistema
├── Dockerfile          # Definición de la imagen de Node.js
├── docker-compose.yml  # Orquestación de servicios (App + PostgreSQL)
└── package.json        # Dependencias del proyecto
⚙️ Puesta en Marcha Local (Docker)
Asegurate de tener instalado Docker y Docker Compose en tu sistema (compatible con WSL2 / Linux).

Clonar o posicionarse en el directorio del proyecto.

Levantar los contenedores en segundo plano con reconstrucción automática:

Bash
docker compose up --build -d
Acceder a la aplicación desde el navegador web:

URL de la Tienda: http://localhost:3010

🔐 Credenciales Iniciales (Modo Admin)
Al iniciar el sistema por primera vez, Sequelize genera automáticamente un usuario administrador por defecto para pruebas y gestión:

Correo: admin@gestioncloud.com.ar

Contraseña: admin2026

🌐 Autor & Desarrollador
José Nuñez — Estudiante Avanzado de Analista de Sistemas (UNPAZ) / Especialista en Infraestructura, DevOps & IT/OT.

Proyecto enfocado en la aplicación práctica de arquitectura de software, contenedores y automatización.
