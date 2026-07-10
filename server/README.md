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

📋 Requisitos Previos (Lo que debe tener la PC)
Antes de tocar el código, la computadora donde vayas a correr el proyecto debe tener instalado:

Node.js (Versión LTS recomendada).

MySQL Server (Ya sea mediante XAMPP, WampServer o MySQL Workbench).

Visual Studio Code (O cualquier editor).

🚀 Pasos para Arrancar el Proyecto Desde Cero (En cualquier PC)
Paso 1: Clonar o Descargar el Proyecto
Abre la carpeta del proyecto en Visual Studio Code. Verás que tienes la estructura con la carpeta server (backend) y la carpeta src (frontend).

Paso 2: Dejar la Base de Datos Lista
Abre tu herramienta de MySQL (Workbench o phpMyAdmin de XAMPP).

Crea una base de datos vacía ejecutando:

SQL
CREATE DATABASE academic_hub;
Paso 3: Configurar las Variables de Entorno (.env)
Ve a la carpeta server/.

Si no existe el archivo .env, crea uno nuevo (o copia el .env.example y cámbiale el nombre a .env).

Configura los datos de conexión según la PC actual:

Fragmento de código
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=TU_CONTRASEÑA_DE_MYSQL_AQUÍ  # Si usas XAMPP, déjalo vacío
DB_NAME=academic_hub
JWT_SECRET=sena_secret_key_123
Paso 4: Levantar el Backend (Servidor)
Abre una terminal en VS Code y muévete a la carpeta del servidor:

Bash
cd server
npm install
npm run migrate
npm run seed
npm run dev
💡 ¿Qué hace esto? npm install descarga los paquetes, migrate crea automáticamente todas tus tablas en MySQL, seed te inserta los usuarios de prueba (Admin, Profesor, Estudiante) y dev enciende tu API en el puerto 3001.

Paso 5: Levantar el Frontend (Interfaz)
Abre otra terminal diferente en VS Code y asegúrate de estar en la raíz del proyecto (academic-hub-32):

Bash
npm install
npm run dev
💡 Esto encenderá la interfaz visual en el puerto 8080. ¡Listo! Abres http://localhost:8080 en el navegador y el sistema estará 100% operativo.