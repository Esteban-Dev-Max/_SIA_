# 003 · Gestión académica (admin)

**Estado:** implementado ✅

## Qué hace

El panel de Administrador (`/admin`) permite gestionar toda la estructura académica: usuarios (crear, listar, editar, activar/inactivar) con los 4 roles, carreras/grados, materias, grupos por materia-profesor-periodo-horario, matrículas de estudiantes, vinculación de acudientes y eventos del calendario. Incluye un resumen de estadísticas de la institución y permite registrar notas como respaldo del profesor.

## Por qué

Es la operación central del sistema: sin administración de usuarios y de la estructura académica no hay matrículas, notas ni paneles útiles. Centraliza lo que hoy se hace en planillas y hojas sueltas.

## Criterios de aceptación

- [x] El CRUD de usuarios valida correo único, encripta la contraseña con bcrypt (10 rondas) y permite desactivar cuentas sin borrar su historia.
- [x] Carreras y materias respetan sus códigos únicos; las materias llevan carrera opcional.
- [x] Un grupo no se crea si la materia o el profesor no existen; el horario es opcional.
- [x] Una matrícula repetida (mismo estudiante en el mismo grupo) responde 400 y no duplica.
- [x] La vinculación acudiente-estudiante es única por par y valida que ambos existan.
- [x] El panel de estadísticas muestra métricas generales (usuarios por rol, grupos, matrículas, notas promedio).
- [x] Solo el rol `admin` accede a `/admin` (redirección a `/` en caso contrario).
- [x] Crear un usuario con rol profesor o estudiante permite el login inmediato con su contraseña.

## Fuera de alcance

- Registro público de usuarios (solo el admin crea cuentas).
- Gestión de pagos, matrículas en línea o trámites financieros (ver `constitution/mission.md`).