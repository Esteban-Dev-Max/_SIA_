# 005 · Asistencia

**Estado:** implementado ✅

## Qué hace

El profesor toma la asistencia diaria de cada grupo marcando a cada estudiante como presente, ausente, tarde o excusa, con observaciones opcionales. El estudiante consulta su porcentaje de asistencia, fallas acumuladas y detalle por materia; el acudiente ve el conteo de ausencias y el historial de los estudiantes a su cargo.

## Por qué

El control de asistencia es un requisito administrativo habitual y la base de las alertas a acudientes: evita papel y permite detectar ausencias repetidas de un vistazo.

## Criterios de aceptación

- [x] La misma matrícula y fecha solo pueden tener un registro: repetir la toma del día la actualiza, no duplica.
- [x] Los estados válidos son presente, ausente, tarde y excusa; cualquier otro responde 400.
- [x] El profesor solo toma asistencia de los grupos que dicta.
- [x] El estudiante ve porcentaje total, fallas (ausente + tarde) y detalle por materia.
- [x] El porcentaje y las fallas se calculan en el API, no en el cliente.
- [x] El acudiente ve la información agregada de todos los estudiantes vinculados.
- [x] Las observaciones se guardan y se muestran en el historial.

## Fuera de alcance

- Justificaciones aprobadas por la institución (flujo administrativo).
- Notificaciones automáticas por inasistencia (el acudiente las detecta en su panel).