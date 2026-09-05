import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Configuración de tests de unidad/componentes con Vitest + jsdom.
// No incluye los plugins de TanStack Start/Nitro (solo aplican al build del
// servidor SSR); aquí solo se necesita el plugin de React.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
