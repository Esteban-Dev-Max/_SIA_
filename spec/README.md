# spec/ — Spec Driven Development (SIA)

> Documentación de desarrollo dirigido por especificación (SDD) del proyecto **SIA — Sistema Integral Académico**. El orden manda: primero la spec, luego el plan, luego las tareas, y solo entonces se toca el código.
>
> **Cómo usar este repositorio de especificación:** la `constitution/` se rellena una vez y cambia poco (definen la identidad y el stack del proyecto). Cada feature nueva crea una carpeta en `features/NNN-nombre-feature/` con `spec.md`, `plan.md` y `tasks.md`; al terminar se mueve a "Hecho" en `constitution/roadmap.md`.

## Estructura

```
spec/
├── constitution/            ← reglas estables del proyecto (cambian poco)
│   ├── mission.md           ← qué construimos y para quién
│   ├── tech-stack.md        ← tecnologías, convenciones y límites
│   └── roadmap.md           ← orden de las features
└── features/                ← una carpeta por feature
    └── NNN-nombre-feature/
        ├── spec.md          ← qué hace + criterios de aceptación
        ├── plan.md          ← cómo se implementa
        └── tasks.md         ← checklist de tareas
```

_La constitución puede ser un único archivo si el proyecto es pequeño; cada feature también puede ser un único archivo. Divídelo cuando crezca._

## Flujo para una feature nueva

1. Crear `features/NNN-nombre-feature/` con el siguiente número libre (`013`, `014`, …).
2. Escribir `spec.md`: qué hace, por qué y criterios de aceptación medibles.
3. Escribir `plan.md`: enfoque técnico y decisiones, respetando `constitution/tech-stack.md`.
4. Desglosar en `tasks.md` y marcar el progreso.
5. Implementar y validar (`npm run lint` + `npm run build` en `frontend/`; `migrate` + `seed` + prueba manual en `backend/`).
6. Actualizar `constitution/roadmap.md` (mover la feature a "Hecho").

> La constitución manda: si una feature choca con `mission.md` o `tech-stack.md`, se replantea la feature, no la constitución.