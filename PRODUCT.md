# Product

## Register

product

## Users

**Creadores** (docentes, administrativos): usan el dashboard, editor de formularios, panel de analytics y resultados. Su contexto es laboral/educativo; necesitan eficiencia y claridad para crear exámenes, configurar secciones, lógica condicional, modo quiz, y revisar respuestas.

**Respondentes** (estudiantes, alumnos): acceden mediante un link público para responder exámenes. Su contexto es de evaluación; necesitan una interfaz limpia, sin distracciones, que les permita concentrarse en las preguntas.

## Product Purpose

Plataforma para crear y administrar exámenes, formularios y encuestas. Los creadores diseñan formularios con secciones, lógica condicional, modo quiz, y personalización visual; los estudiantes los responden y reciben resultados. El éxito es que un docente pueda crear un examen completo en minutos y que el alumno lo resuelva sin fricción.

## Brand Personality

Claro, profesional, confiable. Tonos serios pero no fríos. La interfaz debe inspirar confianza (apto para entornos educativos formales) sin sentirse anticuada.

## Anti-references

- Interfaces over-decoradas con gradientes, sombras excesivas, glassmorphism (típico de templates genéricos AI)
- Formularios que se sienten pesados o lentos (demasiadas animaciones, transiciones largas)
- Editores complejos tipo "hoja en blanco" sin guía (el creador debe sentirse acompañado)
- Estilos infantiles o demasiado casuales (no es una herramienta de entretenimiento)

## Design Principles

1. **La tarea primero** — Cada pantalla prioriza la tarea del usuario: crear una pregunta, responder un examen, revisar resultados. Sin decoración que compita.
2. **Consistencia sin monotonía** — Mismos patrones de interacción en toda la app. Un botón primario, un estilo de tarjeta, un vocabulario de componentes. La variedad viene del contenido, no de la forma.
3. **Claridad sobre creatividad** — Tipografía legible, espaciado generoso, contraste suficiente. La personalización (tema) existe para el contexto del examen, no para la app misma.
4. **Confianza por熟悉idad** — Patrones estándar (top bar + nav lateral, formularios con secciones, tabs). El usuario no debería preguntarse "¿cómo guardo esto?".
5. **Feedback inmediato** — Cada acción tiene respuesta visual: hover, focus, disabled, loading, error, éxito. Sin estados silenciosos.

## Accessibility & Inclusion

- WCAG 2.1 AA como mínimo (contraste 4.5:1 texto normal, 3:1 texto grande)
- Navegación por teclado en toda la interfaz
- `prefers-reduced-motion` para todas las animaciones
- No depender exclusivamente del color para transmitir información
- Etiquetas semánticas y roles ARIA donde sea necesario
