import { app } from "./app.js";
import { pool } from "./db.js";

// Bootstrap: arranca el servidor usando la app exportada por app.js. La
// construcción de la app (middleware, rutas, errores) vive en app.js para
// poder reutilizarla con Supertest en los tests.
const PORT = Number(process.env.PORT) || 3001;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, async () => {
  console.log(`Server listening on port ${PORT}`);
  try {
    await pool.query("SELECT 1");
    console.log("MySQL conectado correctamente");
  } catch (err) {
    console.error(
      "No se pudo conectar a MySQL. Inicia MySQL en XAMPP y reinicia el backend.",
    );
    console.error(err.message);
  }
});
