# REQUERIMIENTOS DEL SISTEMA — SIA

## 1. INFORMACIÓN GENERAL Y OBJETIVO DEL SISTEMA
El **SIA (Sistema Integral Académico)** es una plataforma web full-stack diseñada para centralizar y optimizar la gestión académica y administrativa de colegios (preescolar, primaria, secundaria y media). Su objetivo principal es facilitar la interacción entre administradores, docentes, estudiantes y acudientes, proporcionando herramientas para el seguimiento del rendimiento escolar, control de asistencia, y comunicación interna.

---

## 2. REQUERIMIENTOS FUNCIONALES (RF)

### 2.1 Módulo de Autenticación y Seguridad
- **RF1.1 Inicio de Sesión:** El sistema debe permitir el acceso mediante correo electrónico y contraseña (hasheada con bcrypt).
- **RF1.2 Gestión de Sesiones (JWT):** Generación de tokens con expiración de 8 horas.
- **RF1.3 Revalidación de Token:** El sistema debe verificar en cada petición que el usuario esté activo y mantenga el mismo rol en la base de datos.
- **RF1.4 Control de Acceso (RBAC):** Restricción de acceso a rutas y endpoints según el rol (Admin, Docente, Estudiante, Acudiente). El rol `profesor` se presenta como "Docente" en la interfaz.
- **RF1.5 Cambio de Contraseña:** Los usuarios deben poder actualizar su credencial validando su contraseña actual.

### 2.2 Módulo de Administración
- **RF2.1 Dashboard Administrativo:** Visualización de métricas globales (conteo de usuarios por rol, grados, asignaturas, cursos y matrículas).
- **RF2.2 Gestión de Usuarios:** CRUD completo de cuentas, incluyendo asignación de estado (activo/inactivo) y carga de foto de perfil (JPG/PNG/WEBP < 3MB).
- **RF2.3 Gestión de Grados:** Administración de grados con nivel (preescolar, primaria, secundaria, media) y orden.
- **RF2.4 Gestión de Asignaturas:** Administración de asignaturas con código corto opcional y grado asociado.
- **RF2.5 Gestión de Cursos:** Creación de cursos por grado, letra, director de grupo y año lectivo.
- **RF2.6 Asignación Docente:** Asignación de docentes a cada asignatura del curso por periodo académico (`AAAA-PN`, 4 periodos por año) y horario, con control de choques de horario del docente.
- **RF2.7 Matrículas:** Matrícula anual del estudiante al curso, con inscripción automática en sus asignaturas. Validaciones:
  - No duplicidad de matrícula en el mismo curso.
  - El cambio o retiro se bloquea si ya hay notas o asistencia registradas.
- **RF2.8 Vinculación de Acudientes:** Relación de uno o más acudientes con estudiantes específicos para el seguimiento académico.

### 2.3 Módulo del Docente
- **RF3.1 Planilla de Calificaciones:** Registro de notas en escala de 1.0 a 5.0.
- **RF3.2 Ponderación Automática:** Cálculo de la nota definitiva basado en:
  - Nota 1 (25%), Nota 2 (25%), Nota 3 (20%) y Examen Final (30%).
- **RF3.3 Registro de Asistencia:** Control diario de presencia con estados: *Presente, Ausente, Tarde, Excusa*.
- **RF3.4 Gestión de Soportes:** Carga y descarga de documentos (PDF/JPG/PNG) para justificar inasistencias bajo el estado "Excusa".
- **RF3.5 Reportes de Clase:** Visualización de promedios de asistencia y alertas por fallas acumuladas.

### 2.4 Módulo del Estudiante
- **RF4.1 Consulta Académica:** Visualización del historial de notas por asignatura y periodo.
- **RF4.2 Seguimiento de Asistencia:** Acceso al resumen de inasistencias y porcentaje de cumplimiento por asignatura.
- **RF4.3 Notificaciones:** Recepción de alertas del sistema ante la publicación de nuevas calificaciones definitivas.

### 2.5 Módulo del Acudiente
- **RF5.1 Gestión de Acudidos:** Visualización de la lista de estudiantes vinculados a su cargo.
- **RF5.2 Reporte de Seguimiento:** Consulta del promedio general, desglose de notas y récord de asistencia de cada acudido en tiempo real.

---

## 3. REQUERIMIENTOS NO FUNCIONALES (RNF)

### 3.1 Seguridad y Control de Acceso
- **RNF1.1 Integridad de Datos:** Uso de claves foráneas y transacciones en MySQL para evitar registros huérfanos.
- **RNF1.2 Rate Limiting:** Limitación de 15 peticiones por minuto en endpoints críticos (IA/Chat) y bloqueo de IP por múltiples fallos de login.
- **RNF1.3 CORS Dinámico:** Validación de orígenes permitidos basada en el Host de la petición y redes locales (LAN).

### 3.2 Rendimiento e Infraestructura
- **RNF2.1 API REST Eficiente:** Respuestas en formato JSON con uso de `asyncHandler` para evitar bloqueos del event loop.
- **RNF2.2 Health Check:** Existencia de endpoint `/health` para monitoreo de disponibilidad de la API y conexión a la base de datos.
- **RNF2.3 Persistencia Escalable:** Uso de pool de conexiones `mysql2/promise` para manejar múltiples peticiones concurrentes.

### 3.3 Usabilidad e Interfaz
- **RNF3.1 Idioma:** Toda la interfaz de usuario y los mensajes de error de la API deben estar en español.
- **RNF3.2 Diseño Responsivo:** Interfaz construida con Tailwind CSS adaptable a dispositivos móviles y escritorio.
- **RNF3.3 Feedback de Entrada:** Validación de datos en tiempo real (ej. tipos de archivo permitidos, longitud de contraseñas).

---

## 4. MATRIZ DE TRAZABILIDAD SIMPLE

| Requerimiento / Funcionalidad | Admin | Profesor | Estudiante | Acudiente |
| :--- | :---: | :---: | :---: | :---: |
| Login y Seguridad (JWT) | X | X | X | X |
| Gestión de Usuarios y Roles | X | | | |
| Configuración de Grados y Asignaturas | X | | | |
| Creación de Cursos y Asignaciones | X | | | |
| Matrícula anual de Estudiantes | X | | | |
| Vinculación Acudiente-Estudiante | X | | | |
| Registro de Notas (Planilla) | X | X | | |
| Registro de Asistencia y Excusas | X | X | | |
| Consulta de Calificaciones propias | | | X | |
| Consulta de Asistencia propia | | | X | |
| Seguimiento de Acudidos | | | | X |
| Recibir Notificaciones | | | X | |
