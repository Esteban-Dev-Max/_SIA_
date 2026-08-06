# 001 · Infraestructura

**Estado:** implementado ✅

## Qué hace

Establece la base del sistema: dos paquetes npm independientes (`backend/` Express y `frontend/` React+TanStack), una base de datos MySQL `academico` con su esquema relacional completo (14 tablas), y unos scripts (`migrate` + `seed`) que dejan el sistema funcional en minutos. Incluye la comunicación por red local entre el frontend y la API.

## Por qué

Nada de lo demás existe sin esta base: define cómo se arranca el proyecto, dónde vive cada pieza, qué comandos lo levantan y cómo se conectan los servicios. Al ser dos paquetes separados, backend y frontend pueden desarrollarse y reiniciarse de forma independiente.

## Criterios de aceptación

- [x] `npm run migrate` (en `backend/`) crea la base `academico` y las 14 tablas según `migrations/001_init.sql`.
- [x] `npm run seed` inserta la institución, usuarios demo (los 4 roles), materias, grupos, matrículas, notas, asistencia, tareas, evento, mensajes y notificaciones; es idempotente (re-ejecutable sin duplicar).
- [x] `npm run dev` levanta la API en `http://localhost:3001` y el frontend en `http://localhost:8080`.
- [x] Desde otro dispositivo de la misma red (ej. `http://192.168.x.x:8080`), la UI se comunica con la API automáticamente gracias al CORS de red local (`backend/lib/lan.js`) — sin configuración manual.
- [x] `npm run lint` en `frontend/` termina con 0 errores y `npm run build` compila para producción (TanStack Start + Nitro).
- [x] Existe `backend/.env.example` y `frontend/.env.example` con las variables documentadas en el README raíz.

## Fuera de alcance

- Despliegue en internet público u hosting en la nube (el sistema es de red local).
- Autenticación (ver feature 002) y cualquier módulo de negocio (ver features siguientes).