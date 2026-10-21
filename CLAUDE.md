# CLAUDE.md — Issue Tracker Kanban (Challenge Altis)

Este archivo define las reglas del proyecto. El plan detallado por fases está en `ROADMAP.md`; síguelo en orden y no saltes fases.

## Contexto
- Mini-proyecto de entrevista técnica (fullstack junior): gestor de issues multi-organización con listado, kanban, comentarios e historial.
- **Entrega: miércoles 21-oct-2026, 5:00 p. m. (Colombia).** Prioriza el flujo completo y desplegado sobre los extras.
- El desarrollador es junior y debe poder **explicar cada línea** en una revisión en vivo. Código simple, legible, sin sobre-ingeniería.

## Stack obligatorio
React + TypeScript · TanStack Start (TS) · TanStack Query · PostgreSQL (Supabase como host) · **Drizzle ORM (obligatorio)** con migraciones versionadas · zod · Tailwind + shadcn/ui · Vitest · GitHub Actions · Vercel.
Auth propia: `bcryptjs` + `jose` + cookie httpOnly. **No usar Supabase Auth ni el cliente JS de Supabase.**
Antes de usar APIs de TanStack Start / Router / Query / Drizzle, **consulta la documentación oficial actual**; no asumas APIs de memoria.

## Idioma
- Código, identificadores, nombres de archivo, mensajes de commit y mensajes de error de la API: **inglés**.
- Texto de UI: español.
- Documentación (README, ROADMAP, comentarios largos): **español**.

## Flujo de trabajo
1. Trabaja **una fase a la vez** (ver `ROADMAP.md`). Al empezar, resume en 2–3 líneas qué vas a hacer.
2. **Nunca ejecutes `git commit`, `git push` ni crees ramas/PR.** El usuario hace los commits manualmente tras revisar el diff. Al terminar cada fase propón un mensaje corto en inglés (estilo `feat(scope): ...`, máx. ~60 caracteres).
3. Tras cada cambio relevante, corre `pnpm lint`, `pnpm typecheck` y los tests que apliquen; reporta resultados reales (si algo falla, dilo con la salida).
4. Cambios pequeños y revisables: evita diffs enormes mezclando temas.
5. Si una decisión es ambigua, elige la opción más simple, indícalo en una línea y continúa. Pregunta solo si bloquea.
6. Al terminar cada fase, explica en pocas líneas **qué se hizo y por qué**.

## Reglas de arquitectura y seguridad (no negociables)
- **Aislamiento por organización:** toda consulta de issues, comentarios, usuarios y eventos filtra por el `org_id` de la sesión. El `org_id`/`role` **jamás** se toman del cliente. Recurso de otra org → `NOT_FOUND` (404).
- **Autorización en el servidor** mediante un único módulo `can(user, action, resource)`. La UI solo oculta/deshabilita; nunca es la única barrera.
- Permisos:
  - `admin`: crear, editar, asignar, reasignar y borrar cualquier issue de su org.
  - `member`: crear issues asignados a sí mismo; editar solo los que tiene asignados (incl. status y priority); **no** reasigna ni borra.
  - Comentarios: solo el autor edita/borra (incluso si otro es admin).
  - El registro crea siempre `member` en la org demo; el cliente no puede elegir rol ni org.
- **Historial transaccional:** cambio de issue + eventos en la misma `db.transaction`. Eventos solo por cambios efectivos de status/priority/assignee/title/description (y creación); de la descripción no se guarda el texto, solo que cambió. Operación rechazada → cero escrituras y cero eventos. El historial es solo lectura.
- **Errores consistentes** con códigos: `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `VALIDATION` 400, `RATE_LIMITED` 429, `INTERNAL` 500. Nunca exponer stack traces, SQL ni detalles internos.
- **Validación** con zod en cliente y servidor (esquemas compartidos). `title` no vacío (trim); defaults `status=todo`, `priority=med`; assignee debe ser de la misma org.
- Passwords con bcrypt (`bcryptjs`); JWT con expiración (`jose`); cookie `httpOnly`, `SameSite=Lax`, `Secure` en prod; rate limit en login/registro.
- Markdown: renderizar con `react-markdown`; **prohibido** `dangerouslySetInnerHTML`.
- Secretos fuera del repo; mantener `.env.example` actualizado cada vez que se añada una variable.
- Conexión a BD con pooler de Supabase: `postgres(url, { prepare: false })`. Migraciones con la URL directa/session (`DATABASE_URL_MIGRATE`).
- Las pruebas de persistencia usan un Postgres **aislado** (`TEST_DATABASE_URL`). **Jamás** correr tests ni resets contra la BD de producción. Agrega un guard que aborte si `TEST_DATABASE_URL` coincide con `DATABASE_URL`.

## Convenciones de código
- TypeScript estricto; sin `any` salvo justificación en comentario.
- Estructura sugerida:
  ```
  src/
    db/            schema.ts, index.ts, seed.ts
    server/        auth/, authz.ts, errors.ts, issues.ts, comments.ts, ...
    routes/        rutas de TanStack Start (UI + API)
    components/    UI (ui/ = shadcn)
    lib/           utils, api client, query keys, zod schemas compartidos
  tests/           server/, ui/
  drizzle/         migraciones SQL (commiteadas)
  ```
- Funciones pequeñas y nombres descriptivos. Comentarios solo donde el "porqué" no es obvio.
- Query keys centralizadas; mutaciones invalidan las queries afectadas para mantener lista, kanban y detalle coherentes.
- No añadir dependencias sin necesidad; si agregas una, di para qué.
- No instalar ni generar nada que no esté en el alcance obligatorio hasta completar la fase 16 (los extras son P2).

## Comandos esperados (`package.json`)
`dev` · `build` · `lint` · `typecheck` · `test` · `db:generate` · `db:migrate` · `db:seed` · `db:reset:test`

## Pruebas mínimas obligatorias
Servidor (sin sesión, aislamiento entre orgs, permisos member/admin, comentarios solo autor) · Persistencia (status + evento; rollback si falla el historial; rechazo sin eventos) · UI (filtros/paginación; reversión visual del kanban al fallar el servidor). Priorizar pruebas de comportamiento, no cantidad.

## CI
`.github/workflows/ci.yml` en cada push y PR: lint → typecheck → migraciones sobre service Postgres → tests → build. Debe quedar verde en el commit entregado.

## README (se construye al final, fase 16)
Debe incluir: URL, credenciales de ambas orgs y roles, setup local, variables, migraciones/seed/tests, pasos de despliegue, enlace al CI verde, endpoints/funciones de servidor, decisiones y trade-offs, **uso de IA** (qué se delegó y cómo se verificó), código reutilizado y limitaciones honestas.

## Antes de dar algo por terminado
Ejecuta lint + typecheck + tests + build, resume el resultado real y señala lo que no pudiste verificar.
