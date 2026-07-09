# Backend Académico (Express + MySQL)

Servidor Node.js/Express con MySQL local. **Debe ejecutarse en tu máquina**, no en Lovable.

## Requisitos
- Node.js 18+
- MySQL 8+ corriendo en `localhost:3306`

## Instalación
```bash
cd server
cp .env.example .env      # edita credenciales de tu MySQL
npm install
npm run migrate           # crea la BD `academico` y las tablas
npm run seed              # crea usuarios demo
npm run dev               # arranca en http://localhost:3001
```

## Usuarios demo
| Rol         | Email             | Password  |
|-------------|-------------------|-----------|
| admin       | admin@demo.com    | admin123  |
| profesor    | profe@demo.com    | profe123  |
| estudiante  | alumno@demo.com   | alumno123 |

## Endpoints
- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/admin/{usuarios|carreras|materias|matriculas}`
- `GET /api/profesor/materias`, `/materias/:id/alumnos`
- `PUT /api/profesor/notas/:matricula_id`
- `POST /api/profesor/asistencia`
- `GET /api/estudiante/notas`, `/asistencia`

Todos los endpoints (excepto `/auth/login`) requieren header `Authorization: Bearer <token>`.
