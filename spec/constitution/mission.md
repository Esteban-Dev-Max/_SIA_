# Misión

Definición de la razón de ser de **SIA**. Es la referencia que decide si una feature "encaja" o no.

## Qué construimos

SIA es una plataforma web full-stack que centraliza la gestión académica de colegios (preescolar, primaria, secundaria y media): estudiantes, docentes, grados, asignaturas, cursos, matrículas, notas, asistencia, tareas y comunicaciones en una sola aplicación, reemplazando las planillas en papel y las hojas de cálculo dispersas.

1. **Paneles dedicados por rol** — Administrador, Docente, Estudiante y Acudiente, cada uno con sus vistas y acciones.
2. **Núcleo académico** — grados, asignaturas, cursos, asignaciones docente, matrícula anual, notas con ponderación automática (25% + 25% + 20% + 30%), asistencia y tareas con entregas y calificación.
3. **Comunicación integrada** — mensajería interna, notificaciones y un chatbot asistente que responde preguntas académicas con datos reales del usuario.
4. **Calendario unificado** — eventos institucionales y tareas con fecha límite en vista mensual y semanal.

## Para quién

- **Administradores / coordinadores** — gestionan usuarios, matrículas, lo académico y las estadísticas generales.
- **Docentes** — registran notas, toman asistencia y califican entregas de tareas.
- **Estudiantes** — consultan notas en tiempo real, asistencia y tareas; reciben notificaciones y usan el asistente.
- **Acudientes** — monitorean el rendimiento y la asistencia de los estudiantes vinculados y pueden imprimir el boletín.

## Principios

- **Una sola fuente de verdad** — toda la información vive en MySQL; la API es la única puerta de acceso y los promedios/definitivas se calculan en el servidor, no en el cliente.
- **Seguridad por rol** — cada endpoint verifica token JWT y rol (`requireRole`); nunca se confía en el navegador.
- **Disponible en red local** — corre con XAMPP + dos terminales y es accesible desde el celular en la misma red WiFi, sin exponer nada a internet.
- **Simple y transparente** — sentencias preparadas siempre, errores JSON en español y sin frameworks extra del lado del servidor.
- **Datos demo reproducibles** — `migrate` + `seed` dejan un sistema funcional (todos los roles) en minutos.

## Qué NO es

- No es una plataforma SaaS multiarrendatario ni está pensada para desplegarse en internet público.
- No gestiona pagos, matrículas en línea ni trámites administrativos financieros.
- No sustituye un LMS: no tiene foros, quizzes ni contenidos de curso.
- No genera boletines en PDF por servidor: la impresión del boletín se hace desde el navegador.