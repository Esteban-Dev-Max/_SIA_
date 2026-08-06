# 011 · Portal acudiente — Plan

Cómo se implementa lo descrito en `spec.md`. Respeta la `constitution/`.

## Enfoque

El panel del acudiente consume datos agregados del backend sobre los estudiantes vinculados vía `acudiente_estudiante`: notas ponderadas por materia, promedio, materias cursadas, conteo de fallas e historial de asistencia. El boletín se genera en el navegador (impresión del área correspondiente), sin librería PDF en el servidor. Toda la información sale de las mismas consultas que usan los paneles del estudiante.

## Implementación

1. **API** — `backend/routes/acudiente.js` (protegida con `requireRole("acudiente")`): lista los estudiantes vinculados y, por cada uno, resumen académico (notas ponderadas y promedio por materia), conteo de fallas (ausente + tarde) y detalle del historial.
2. **UI** — `frontend/src/routes/acudiente/index.tsx` con `acudiente/route.tsx` (protección + `AuthGate` + `PanelShell`): selector de estudiante, tarjetas de rendimiento, alertas de inasistencia e historial.
3. **Boletín** — vista imprimible (CSS de impresión) que el acudiente descarga pulsando el botón de imprimir; el navegador exporta a PDF.
4. **Cálculo** — la definitiva ponderada se calcula en el backend con la misma fórmula 25/25/20/30 de la feature 004.

## Decisiones

- **Boletín por impresión del navegador** — sin librería de PDF (generación por servidor en backlog); aprovecha el CSS de impresión y es suficiente para el uso local.
- **Reutilizar cálculos del estudiante** — las consultas del acudiente son la misma lógica que `estudiante.js` pero para los IDs vinculados (se descartó una API separada de "boletines").
- **Selector de estudiante en el panel** — un acudiente con varios hijos elige cuál ver; el boletín refleja al seleccionado.

## Riesgos

- **Vinculaciones malas** — si `acudiente_estudiante` apunta a un estudiante inactivo o inexistente, el panel muestra el estado y no rompe (validación en el JOIN).
- **Escala del historial** — el historial de asistencia se agrega por materia en el backend para no traer filas sueltas al cliente.