# SIA — Sistema Integral Académico

Plataforma web para gestionar estudiantes, profesores, carreras, materias, notas y asistencia.

## Estructura

```
SIA/
├── frontend/   # React + TanStack Start (puerto 8080)
└── backend/    # Express + MySQL (puerto 3001)
```

## Requisitos

- Node.js 18+
- MySQL 8+

## Inicio rápido

### Orden correcto para arrancar

1. XAMPP → Start MySQL
2. Terminal backend → cd backend → npm run dev
3. Terminal frontend → cd frontend → npm run dev
4. Abrir http://localhost:8080

### 1. Backend

```bash
cd backend
cp .env.example .env   # edita credenciales MySQL
npm install
npm run migrate
npm run seed
npm run dev
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Abre http://localhost:8080

## Usuarios demo

| Rol        | Email           | Password  |
|------------|-----------------|-----------|
| admin      | admin@demo.com  | admin123  |
| profesor   | profe@demo.com  | profe123  |
| estudiante | alumno@demo.com | alumno123 |

Más detalles del API en [backend/README.md](backend/README.md).
