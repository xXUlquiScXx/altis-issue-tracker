# ROADMAP — Issue Tracker Kanban (Challenge Altis)

**Entrega:** miércoles 21 de octubre de 2026, 5:00 p. m. (Colombia, UTC-5).
**Regla de oro:** un flujo principal completo, desplegado y probado vale más que extras a medias. Los extras opcionales (adjuntos, realtime, docker-compose, CD) NO se hacen hasta que todo lo obligatorio esté verde.

---

## 0. Decisiones de stack (cerradas)

| Tema | Decisión | Por qué |
|---|---|---|
| Framework | **TanStack Start + React + TypeScript** | Obligatorio. Frontend y backend (server functions) en una sola app. |
| Datos cliente | **TanStack Query** (React Query) | Obligatorio "o equivalente". Da caché, estados loading/error y actualización optimista. |
| BD | **PostgreSQL en Supabase** (solo como Postgres) | Gratis, en la nube. NO usar Supabase Auth. |
| ORM | **Drizzle ORM + drizzle-kit** | **Obligatorio** (PDF p.3). Esquema + migraciones versionadas en el repo. |
| Auth | **Propia**: `bcryptjs` (hash) + `jose` (JWT) + cookie `httpOnly` | Necesitamos `org_id` y `role` en nuestra tabla `users`. |
| Validación | **zod** (cliente y servidor, mismos esquemas) | Un solo esquema reutilizable. |
| UI | Tailwind CSS + shadcn/ui + `sonner` (toasts) | Rápido y responsive. |
| Drag & drop | `@dnd-kit/core` | Estándar, funciona con touch. |
| Markdown | `react-markdown` (+ `remark-gfm`) | Renderizado seguro (no usar `dangerouslySetInnerHTML`). |
| Tests | **Vitest** + Testing Library (+ `happy-dom` o `jsdom`) | Un solo runner para servidor y UI. |
| CI | **GitHub Actions** con service `postgres` | Obligatorio y automático en push/PR. |
| Hosting app | **Vercel** (plan Hobby, cuenta nueva) | Gratis, URL pública, sin cold start molesto. |
| Gestor de paquetes | **pnpm** | Rápido. (npm también vale; no mezclar.) |

> ⚠️ **Verificar en la documentación oficial antes de codificar**, porque la API de TanStack Start cambia rápido: `createServerFn`, middleware, manejo de cookies/headers de request, y el preset de despliegue a Vercel (Nitro). Docs: https://tanstack.com/start/latest

### Reglas de diseño que se aplican en TODAS las fases
1. **Toda** consulta a issues/comentarios/usuarios/eventos filtra por `org_id` del usuario de la sesión. El `org_id` NUNCA viene del cliente.
2. Autorización en el **servidor** (módulo único `can(user, action, resource)`); la UI solo refleja lo que ya decide ese módulo.
3. Recurso de otra organización → responder **404** (no 403), para no revelar que existe.
4. Errores con códigos consistentes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION` (400), `RATE_LIMITED` (429), `INTERNAL` (500). El 500 nunca expone stack traces ni mensajes de BD.
5. Cambio de issue + evento de historial = **una sola transacción**.
6. Código en inglés; documentación en español.

---

## 1. Modelo de datos (borrador)

```
organizations  id (uuid pk), name, slug (unique), created_at
users          id, org_id → organizations, email (unique), name, password_hash,
               role enum('admin','member'), created_at
issues         id, org_id, title (not null, check length>0), description (text, nullable),
               status enum('todo','in_progress','done') default 'todo',
               priority enum('low','med','high') default 'med',
               assignee_id → users (nullable), created_by → users,
               labels text[] default '{}', created_at, updated_at
comments       id, issue_id → issues (on delete cascade), org_id, author_id → users,
               body (not null), created_at, updated_at
issue_events   id, issue_id → issues (on delete cascade), org_id, actor_id → users,
               type enum('created','status_changed','priority_changed','assignee_changed'),
               from_value (text, nullable), to_value (text, nullable), created_at
```

Índices: `issues(org_id, updated_at desc)`, `issues(org_id, status)`, `comments(issue_id, created_at)`, `issue_events(issue_id, created_at)`.
Seguridad extra opcional: FK compuestas o chequeo en servidor de que `assignee.org_id == issue.org_id`.

---

## 2. Fases

> Cada fase termina con un **checkpoint de commit**: el agente te avisa y te da un mensaje corto; tú revisas el diff y haces el commit manualmente.
> Marcas: **[P0]** obligatorio · **[P1]** muy deseable · **[P2]** si sobra tiempo.
> Tiempos = presupuesto aproximado. Si una fase se pasa del doble, parar y recortar (ver sección 4).

### Fase 0 — Cuentas y herramientas (~30 min) [P0]
- [x] Repo en GitHub (público o con acceso para evaluadores) — nombre sugerido: `altis-issue-tracker`.
- [x] Proyecto en **Supabase**: guardar la *database password*. Anotar las dos cadenas de conexión: **Transaction pooler** (puerto 6543, para la app) y **Session pooler / Direct** (puerto 5432, para migraciones).
- [x] Cuenta **Vercel** nueva (correo alterno), conectada a GitHub (el import del repo se hace en la fase 3, cuando exista la app).
- [x] **Node 22 LTS** (local: `nvm use 22`), pnpm, git. Docker (opcional, para Postgres local de pruebas): no instalado; se decide en la fase 13.
- [x] Fijar la versión de Node en el repo para que local, CI y Vercel coincidan: archivo `.nvmrc` con el contenido `22` (hecho). El `"engines": { "node": "22.x" }` de `package.json` se agrega en la fase 1 (se fija `22.x` y no `>=22`: Vercel advierte que `>=22` subiría solo de Node cuando salga una versión mayor).
- 🟢 Commit: `chore: pin node version to 22` (solo `.nvmrc`)

### Fase 1 — Scaffold (~45 min) [P0]
- [x] Crear proyecto TanStack Start + TS (seguir la guía oficial actual de "Getting Started"). Hecho con la guía "build from scratch" (sin CLI interactivo) + `nitro` para Vercel.
- [x] Instalar: tailwind, shadcn/ui, `@tanstack/react-query`, `zod`, `drizzle-orm`, `postgres` (driver), `drizzle-kit`, `bcryptjs`, `jose`, `sonner`, `@dnd-kit/core`, `react-markdown`, `remark-gfm`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `happy-dom`, eslint + prettier.
- [x] Scripts en `package.json`: `dev`, `build`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`, `db:seed`, `db:reset:test` (ver fase 2; los `db:*` apuntan a archivos que se crean en esa fase). También `engines` (node 22.x).
- [x] `.env.example` (sin secretos reales) con: `DATABASE_URL`, `DATABASE_URL_MIGRATE`, `TEST_DATABASE_URL`, `JWT_SECRET`, `DEMO_ORG_SLUG`, `APP_ORIGIN`.
- [x] `.gitignore` incluye `.env*` (excepto `.env.example`), `node_modules`, `dist`, `.output`, `.vercel`.
- 🟢 Commit: `chore: scaffold tanstack start app`

### Fase 2 — Base de datos con Drizzle (~1 h 15) [P0]
- [x] `src/db/schema.ts` con las tablas de la sección 1 (enums con `pgEnum`).
- [x] `drizzle.config.ts`; `pnpm db:generate` → carpeta `drizzle/` con migraciones SQL **commiteadas**.
- [x] `src/db/index.ts`: cliente `postgres(DATABASE_URL, { prepare: false })` (obligatorio con el pooler en modo transacción).
- [x] Script de migración (`db:migrate`) usando `DATABASE_URL_MIGRATE`. Imprime a qué base apunta (sin credenciales) y cuántas migraciones tiene al día (`3 of 3`). Los scripts `db:*` cargan `.env` con `--env-file-if-exists`. Se añadió también `db:reset:test` con su guard (se usa en la fase 13). `db:seed` BORRA los datos: muestra la base de destino y exige `--yes` (`pnpm db:seed --yes`).
- [x] `src/db/seed.ts` (idempotente o con truncado previo):
  - Orgs **Acme** y **Beta**; en cada una 1 admin + 2 members. Credenciales fijas y documentadas (ej. `admin@acme.test` / `Password123!`).
  - **≥ 30 issues** repartidos entre ambas orgs, variados en status, priority, assignee (incluye sin asignar) y labels.
  - Comentarios de ejemplo y eventos de historial coherentes con cada issue (al menos `created`, y algunos cambios).
- [x] Aplicar migración + seed contra Supabase y verificar en el Table Editor. Verificado por consulta con el cliente de la app: 2 orgs, 6 usuarios, 32 issues, 24 comentarios, 90 eventos.
- 🟢 Commit: `feat(db): drizzle schema, migrations and seed`

### Fase 3 — Primer despliegue "esqueleto" (~45 min) [P0]
> Se hace **temprano** a propósito: los problemas de despliegue aparecen aquí, no a las 4 p. m. del último día.
- [x] Configurar el preset de Vercel según la doc oficial de TanStack Start. Se usa el plugin `nitro/vite`; en Vercel el preset se detecta solo y genera una función `nodejs22.x`.
- [x] En Vercel → Project Settings → General → **Node.js Version: 22.x**.
- [x] Variables de entorno en Vercel: `DATABASE_URL` (pooler 6543), `JWT_SECRET` (aleatorio largo: `openssl rand -base64 48`), `DEMO_ORG_SLUG`, `APP_ORIGIN`.
- [x] Ruta `/api/health` que haga `select 1` a la BD; abrirla en la URL de Vercel. Verificado: responde `200 {"status":"ok","db":"ok"}`.
- [x] Anotar la URL pública para el README: https://altis-issue-tracker.vercel.app/
- 🟢 Commit: `chore: vercel deployment skeleton + health check`

### Fase 4 — CI mínimo (~30 min) [P0]
> Se crea ya para que cada push se valide desde el principio.
- [x] `.github/workflows/ci.yml`, disparado en `push` y `pull_request`.
- [x] Job con `services: postgres:16` (env `POSTGRES_PASSWORD`, `POSTGRES_DB=test`, health check) y pasos: checkout → pnpm + Node (`actions/setup-node` con `node-version-file: .nvmrc` y caché de pnpm) → `pnpm install --frozen-lockfile` → `lint` → `typecheck` → `db:migrate` (contra el service, vía `TEST_DATABASE_URL`) → `test` → `build`.
- [x] Verificar que corre verde (aunque todavía haya 0–1 tests; agregar un test trivial si Vitest falla por "no tests"). Se añadió `tests/server/migrations.test.ts` (tablas creadas + check del título) en vez de un test vacío. Primer run verde: https://github.com/xXUlquiScXx/altis-issue-tracker/actions/runs/39530460906
- 🟢 Commit: `ci: github actions pipeline with postgres service`

### Fase 5 — Autenticación (~1 h 30) [P0]
- [x] `src/server/auth/password.ts`: `hashPassword` / `verifyPassword` con `bcryptjs` (cost 10–12).
- [x] `src/server/auth/session.ts`: `signSession({userId, orgId, role})` y `verifySession` con `jose` (HS256, `exp` 1–2 h). Cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción, `Path=/`.
- [x] Server functions: `register`, `login`, `logout`, `getMe` (en `src/server/auth/functions.ts`; la lógica vive en `service.ts` y la cookie en `cookie.ts`).
  - `register`: valida con zod, email único (normalizado a minúsculas), crea **siempre** `role='member'` en la org `DEMO_ORG_SLUG`. Ignorar cualquier `role`/`orgId` que envíe el cliente.
  - `login`: mensaje genérico ante credenciales inválidas (no revelar si el email existe).
- [x] **Rate limit** en `register`/`login` (por IP+email; ventana fija, en memoria). Documentar en README que en serverless es por instancia (trade-off).
- [x] Middleware `requireUser` que resuelve el usuario desde la cookie y lanza `UNAUTHENTICATED` si falta o expiró.
- [x] Expiración: si el JWT venció → 401 y el cliente redirige a `/login` (re-login simple, permitido por el PDF). Verificado: token vencido → 401; sin cookie, el SSR redirige 307 a `/login`.
- [x] Rutas UI: `/login`, `/register`; guard en rutas protegidas (`_authed.tsx` hace de guard). Probado a mano en el navegador: login, logout, contraseña errónea y email duplicado.
- 🟢 Commit: `feat(auth): register, login, jwt cookie session`

Mejoras de UX del login (pedidas tras la prueba manual):
- [x] Botón de ojo para mostrar/ocultar la contraseña (`src/components/password-input.tsx`, usado en login y registro).
- [x] Checkbox "Recordar mi correo": guarda solo el correo (nunca la contraseña) en `localStorage` tras un login exitoso y lo muestra al volver al login, por ejemplo al expirar la sesión.
- [x] La lógica común de los formularios (validar, enviar, errores, carga) se extrajo al hook `src/hooks/use-auth-form.ts`; las páginas quedan solo con el HTML. Se evita duplicar código entre login y registro.
- [x] Tests de comportamiento en `tests/ui/login-extras.test.tsx`.
- 🟢 Commit: `feat(auth): password toggle and remembered email`

### Fase 6 — Autorización + backend de issues (~2 h) [P0]
- [x] `src/server/authz.ts` con `can(user, action, resource)` (función pura: la usa el servidor para rechazar y la UI para ocultar); acciones: `issue:create`, `issue:update`, `issue:assign`, `issue:delete`, `comment:create`, `comment:update`, `comment:delete`.
  - **admin**: todo sobre issues de su org.
  - **member**: crear (forzando `assignee_id = su propio id`), editar solo issues asignados a él (title, description, labels, status, priority), **no** cambiar `assignee_id`, **no** borrar.
- [x] Helper `getIssueForUser(user, id)` (en `src/server/issues/service.ts`): busca por `id AND org_id`; si no existe → `NOT_FOUND`.
- [x] Server functions: `listIssues`, `getIssue`, `createIssue`, `updateIssue`, `deleteIssue`, `listOrgUsers` (para el selector de assignee; solo de la org). Están en `src/server/issues/functions.ts`; la lógica, en `service.ts`.
- [x] `listIssues`: `page`, `pageSize` (máx. 100), filtros combinables `status`, `priority`, `assignee` (id | `unassigned`), búsqueda `q` con `ILIKE` en title y description (escapar `%` y `_`), orden `updated_at desc`. Devuelve `{ items, total, page, pageSize }`.
- [x] Validaciones: `title` trim y no vacío, defaults `todo`/`med`, `assignee_id` debe pertenecer a la misma org.
- [x] `updated_at` se actualiza en cada cambio efectivo. `updateIssue` ya corre en una transacción con `FOR UPDATE`; la fase 7 solo añade los eventos dentro de ella.
- [x] Tests: `tests/server/authz.test.ts` (matriz de permisos) y `tests/server/issues.test.ts` (aislamiento, permisos, filtros, paginación) contra Postgres aislado. Adelantan parte de la fase 13.
- 🟢 Commit: `feat(issues): crud with org isolation and role permissions`

### Fase 7 — Historial transaccional (~1 h) [P0]
- [x] En `createIssue`: `db.transaction` → insert issue + insert evento `created`.
- [x] En `updateIssue`: `db.transaction` → leer issue (con `for update`), validar permisos, calcular **diff real**; solo por cada campo de `status`/`priority`/`assignee_id` que **cambió efectivamente** insertar evento (`type`, `from_value`, `to_value`, `actor_id`). Si no hay cambios → no hay eventos. Si se rechaza (permiso/validación) → no hay escritura ni eventos.
- [x] `listIssueEvents` solo lectura, filtrado por org (en `src/server/issues/`: server function `listIssueEvents`, lógica `listEventsForIssue`). Devuelve nombres del actor y, en cambios de assignee, de las personas. Sin endpoints de editar/borrar eventos.
- [x] El delete de issue borra en cascada comentarios y eventos.
- [x] Ampliación posterior (a pedido): también generan evento los cambios efectivos de **título** (guarda el título anterior y el nuevo), de **descripción** (solo registra que cambió, sin guardar el texto) y de **etiquetas** (guarda la lista anterior y la nueva; reordenarlas no cuenta como cambio). Requirió las migraciones `drizzle/0001_*.sql` y `drizzle/0002_*.sql` (agregan `title_changed`, `description_changed` y `labels_changed` al enum `event_type`).
- [x] Tests en `tests/server/history.test.ts`, incluido el rollback con un fallo forzado en la BD (trigger que rechaza inserts de eventos). Adelantan la parte de persistencia de la fase 13.
- 🟢 Commit: `feat(history): transactional activity log`

### Fase 8 — Comentarios (~45 min) [P0]
- [x] `listComments(issueId)` (con nombre del autor), `createComment`, `updateComment`, `deleteComment` (en `src/server/comments/`: `functions.ts` y `service.ts`).
- [x] Cualquier usuario de la org puede comentar issues de su org; **solo el autor** edita o borra (incluso si otro es admin).
- [x] Siempre verificar que el issue pertenece a la org del usuario.
- [x] Tests en `tests/server/comments.test.ts` (aislamiento entre orgs, solo el autor edita/borra incluso siendo admin, comentar no toca el issue ni su historial).
- 🟢 Commit: `feat(comments): crud with author-only edit/delete`

### Fase 9 — Frontend: base y listado (~2 h 15) [P0]
> Se entrega en dos partes, cada una con su commit.

**Entrega 1 — Base de la interfaz**
- [x] Layout con header (usuario, org, rol, logout) y navegación Lista / Kanban (`src/components/app-header.tsx`; la ruta `/kanban` es provisional hasta la fase 11). `QueryClientProvider` y `Toaster` en `src/routes/__root.tsx`.
- [x] Capa `api` del cliente: manejo uniforme de errores (por `code`): 401 → login, 403 → toast "sin permiso", 400 → errores por campo, 500 → mensaje genérico. (`src/lib/api.ts` y `src/lib/query-client.ts`; los 400 los muestra cada formulario.)
- [x] Mensajes de error de la API traducidos al español (`src/lib/messages.ts`), con un test que avisa si el servidor emite un mensaje sin traducción.
- [x] Tema claro/oscuro: botón sol/luna en el header y flotante en login y registro; se guarda en el navegador y se aplica antes de pintar (sin destello); sin guardado, usa el tema del sistema.
- 🟢 Commit: `feat(ui): app shell, theme toggle and api error layer`

**Entrega 2 — Lista de issues**
- [x] Vista **Lista**: tabla (en pantallas chicas las columnas se pliegan bajo el título), filtros (status, priority, assignee, búsqueda con debounce de 300 ms), paginación server-side de 20, estados **loading** (skeleton), **vacío**, **error** (con reintentar). Componentes en `src/components/issues/`.
- [x] Filtros y página reflejados en la URL (search params de TanStack Router) → compartible y fácil de testear.
- [x] Formulario crear/editar issue (sin react-hook-form: `FormData` + los mismos esquemas zod del servidor); toasts de éxito/error; confirmación antes de eliminar.
- [x] Permisos en UI: ocultar/deshabilitar crear/editar/asignar/borrar según `can` del cliente (derivado del rol/usuario). Recordar: el servidor igual lo valida.
- [x] Mutaciones invalidan queries para mantener coherencia lista ↔ detalle ↔ kanban (claves en `src/lib/query-keys.ts`).
- [x] Tests de UI en `tests/ui/issues-list.test.tsx` (filtros, búsqueda, paginación, vacío, error, permisos, formulario y borrado). Adelantan la parte de interfaz de la fase 13.
- 🟢 Commit: `feat(ui): issue list with filters and pagination`

Mejoras tras la prueba manual en móvil:
- [x] La fecha de «Actualizado» ya no desaparece en pantallas chicas: se pliega como última fila bajo el título, alineada a la derecha.
- [x] Paginación arriba (debajo de los filtros) y abajo de la lista; en móvil los botones muestran solo el ícono.
- [x] Formulario en móvil: el diálogo se ajusta al área realmente visible cuando sale el teclado (`visualViewport`), se puede hacer scroll dentro de él y el campo enfocado se lleva a la vista. El `viewport` incluye `interactive-widget=resizes-content` para Android.
- 🟢 Commit: `fix(ui): mobile list layout and form with keyboard`

### Fase 10 — Detalle, comentarios e historial en UI (~1 h 30) [P0]
- [x] Detalle en ruta propia `/issues/$id` (en vez de modal, para poder compartir el enlace): título, descripción con **markdown renderizado**, metadatos, edición según permisos. Cualquier persona de la org puede verlo; *Editar* aparece solo si `can` lo permite. Incluye botón **Volver** (retrocede en el historial, así la lista reaparece con sus filtros, página y scroll; si el enlace se abrió directo, va a la lista) y **Copiar enlace**. En la lista, el título es un enlace real (abrir en otra pestaña con Ctrl/Cmd+clic) y toda la celda lo abre en móvil. Código: `src/routes/_authed/issues.$id.tsx` y `src/components/issues/issue-detail-page.tsx`; Markdown seguro en `src/components/markdown.tsx` (sin HTML crudo, sin imágenes, enlaces con `noopener`).
- [x] Enlace compartido sin sesión: se pide iniciar sesión y se vuelve a ese enlace después (`?redirect=`, validado para aceptar solo rutas internas: `src/lib/safe-redirect.ts`). También si la sesión expira a mitad de uso.
- 🟢 Commit (avance del detalle): `feat(ui): issue detail page with shareable link`
- [x] Página 404 propia en español para direcciones inexistentes (`src/components/not-found.tsx`, configurada como `defaultNotFoundComponent` del router). Quita el aviso `notFoundComponent option was not configured` del log.
- [x] Sección comentarios: listar (autor + fecha, marca «editado», Markdown), crear; editar/borrar solo en los propios (y borrar pide confirmación). `src/components/issues/issue-comments.tsx`.
- [x] Sección historial: lista cronológica «Ana cambió el estado de «Por hacer» a «En progreso» · fecha», con nombres en los cambios de responsable. `src/components/issues/issue-history.tsx` y `src/lib/history.ts`.
- [x] Estados loading / vacío / error en cada sección (detalle, comentarios e historial; con «Reintentar»).
- 🟢 Commit: `feat(ui): issue detail with comments and history`

### Fase 11 — Kanban con actualización optimista (~1 h 30) [P0]
- [x] 3 columnas: Por hacer / En progreso / Hecho. **Decisión:** una sola consulta con `pageSize` 100 (el máximo del servidor) en vez de una por columna: más simple, una sola caché que actualizar de forma optimista, y si hay más de 100 issues el tablero avisa y se acota con filtros (prioridad, responsable y búsqueda; el estado es la columna). Filtros en la URL como en la lista.
- [x] Drag & drop con `@dnd-kit` (sensores de mouse, touch y teclado; se separan mouse y dedo para que en celular un deslizamiento siga haciendo scroll). Se arrastra desde el asa de la tarjeta. Solo se puede arrastrar una tarjeta si `can(update)`; si no, no es draggable y lleva un candado con la explicación. Alternativa sin arrastre (teclado, lector de pantalla, celular): el selector «Mover a» de cada tarjeta.
- [x] `useMutation` con patrón optimista (`src/hooks/use-move-issue.ts`): `onMutate` (cancelar queries, guardar copia, mover tarjeta) → `onError` (restaurar solo esa tarjeta + aviso con el motivo) → `onSettled` (invalidar; con varios movimientos a la vez, solo el último refresca).
- [x] Recargar la página debe mostrar el estado persistido.
- [x] Click en tarjeta abre el detalle (fase 10): el título es un enlace real y toda la tarjeta lo abre (salvo asa y selector).
- [x] Botón «Nuevo issue» también en el tablero (mismo formulario y mismas reglas que en la lista: el member solo crea para sí mismo). La tarjeta nueva aparece en la columna del estado elegido sin recargar. Se añadió después de la entrega inicial.
- [x] Tests en `tests/ui/kanban-board.test.tsx` y `kanban-logic.test.ts`: agrupación, movimiento optimista, reversión al fallar el servidor (con aviso), movimientos simultáneos, permisos y filtros. Cubren la parte de kanban de la fase 13. El gesto físico de arrastrar no se prueba automáticamente.
- 🟢 Commit: `feat(ui): kanban board with optimistic updates`

### Fase 12 — Pulido responsive y UX (~45 min) [P0]
- [x] Revisar en móvil (≈375 px): filtros colapsables (la búsqueda siempre visible y un botón «Filtros (n)» abre los selectores), kanban con scroll horizontal por columnas, modales usables con teclado (el formulario se ajusta al área visible), la fecha de la lista plegada bajo el título y paginación arriba y abajo.
- [x] Feedback de éxito/error en todas las acciones (avisos al crear, editar, borrar, comentar y mover; errores por campo en los formularios; avisos específicos si el issue ya fue borrado por otra persona). Botones deshabilitados mientras guardan.
- [x] Accesibilidad básica: labels en inputs, foco visible en enlaces y botones propios, `aria-label` en botones de icono, `aria-expanded`/`aria-controls` en «Filtros», título de tabla para lectores de pantalla, enlace «Saltar al contenido» y botones táctiles más grandes en celular.
- [x] Selector (`NativeSelect`) con flecha propia y su espacio, en lugar de la del navegador (que se pegaba al borde y no obedecía al padding).
- [x] Listas al día: si un issue fue borrado por otra persona, la lista y el tablero se actualizan al descubrirlo (al abrir el detalle, editar o borrar) y también al volver a la pestaña.
- [x] Botón de actualizar (ícono ⟳) en la lista y en el tablero: vuelve a pedir los datos sin recargar la página, conserva filtros y página, gira y se deshabilita mientras trabaja (`src/components/refresh-button.tsx`).
- 🟢 Commit: `style(ui): responsive polish and feedback states`

### Fase 13 — Pruebas obligatorias (~2 h) [P0]
Preparar BD de prueba: `TEST_DATABASE_URL` apuntando a un Postgres **aislado** (Docker local `postgres:16` o instalación local; **nunca** la BD de Supabase de producción). Script `db:reset:test` que migra y limpia. Documentar en README.

**Servidor** (`tests/server/*.test.ts`, llamando a las funciones/handlers reales contra la BD de prueba):
- [x] Sin sesión → `UNAUTHENTICATED` en listar/crear/editar/borrar. (`tests/server/session-required.test.ts`.) Se prueban los middleware reales `requireUser` (sin sesión lanza `UNAUTHENTICATED` y no llega al handler) y `errorMiddleware` (401/403/404/400/429 y 500 sin filtrar detalles internos), y una prueba de política que exige `requireUser` en **toda** server function salvo las públicas (`register`, `login`, `logout`), para que una función nueva sin protección haga fallar el test. Limitación: no se hace una petición HTTP completa dentro de los tests (el motor interno de TanStack Start necesita el contexto de una petición real); esa comprobación se hizo a mano contra un servidor en las fases 5 a 8.
- [x] Usuario de Acme no puede leer ni modificar issue/comentario/historial de Beta (aunque use su ID) → `NOT_FOUND`. (Cubierto en `issues.test.ts` — leer, editar, borrar y listar —, `comments.test.ts` — listar, comentar, editar y borrar — e `history.test.ts` — leer el historial.)
- [x] Member: crea solo asignado a sí mismo; edita solo los suyos; no reasigna; no borra. Admin: puede todo en su org. (Hecho en la fase 6: `tests/server/issues.test.ts`.)
- [x] Comentarios: otro usuario (incluso admin) no puede editar/borrar un comentario ajeno. (Hecho en la fase 8.)
- [x] Registro: nunca crea admin aunque se envíe `role: 'admin'`. (`tests/server/auth-service.test.ts`: también ignora el `orgId` enviado, normaliza el email, guarda la contraseña como hash y el login no revela qué correos existen.)

**Persistencia** (`tests/server/history.test.ts`):
- [x] Cambiar status guarda el nuevo estado **y** el evento con from/to correctos. (Hecho en la fase 7.)
- [x] Si falla el insert del historial (forzar el fallo, p. ej. mock/spy o FK inválida), el cambio del issue **no** queda aplicado (rollback). (Hecho en la fase 7, con un trigger en la BD de pruebas.)
- [x] Una operación rechazada no crea eventos. (Hecho en la fase 7.)

**Interfaz** (`tests/ui/*.test.tsx`, Testing Library, servidor mockeado):
- [x] Interacción de filtros o paginación (p. ej. elegir status "done" cambia la petición y la lista; "siguiente página" pide `page=2`). (Hecho en la fase 9.)
- [x] Kanban: al mover una tarjeta y fallar el servidor, la tarjeta **vuelve** a su columna y aparece el mensaje de error. (Hecho en la fase 11.)
- 🟢 Commit: `test: server, persistence and ui behavior tests`

### Fase 14 — CI completo (~30 min) [P0]
- [x] Confirmar que el pipeline ejecuta TODO (lint, typecheck, migraciones, tests, build) y queda **verde** en el último commit. Verificado con la API de GitHub en el run de `d0b5a06`: checkout → pnpm y Node (desde `.nvmrc`) → `install --frozen-lockfile` → lint → typecheck → `db:migrate` (sobre su Postgres 16 temporal) → test → build, todos en `success`, 69 s.
- [ ] Runner fijado a `ubuntu-24.04` (en vez de `ubuntu-latest`, que GitHub está migrando a Ubuntu 26 desde el 19-oct-2026). Verificar que el siguiente run siga verde tras el push.
- [ ] Copiar el enlace del run exitoso (para el README): pestaña **Actions** del repo → clic en el run del commit → copiar la URL (`.../actions/runs/<número>`). Debe ser el run del **último commit de código**; como editar el README genera otro commit y otro run, el README llevará además el badge de estado y el enlace a la página del workflow. Último run verde conocido: https://github.com/xXUlquiScXx/altis-issue-tracker/actions/runs/39634227191
- 🟢 Commit (si hay ajustes): `ci: finalize pipeline`

### Fase 15 — Despliegue final y verificación E2E (~1 h) [P0]
- [ ] Aplicar migraciones y seed en Supabase (producción) si no están al día. Comprobar con `pnpm db:status` (solo lectura: dice a qué base apunta, si las migraciones están al día y si el enum `event_type` tiene todos los valores).
- [ ] Desplegar rama principal en Vercel y recorrer **el flujo completo en la URL pública**, con las dos orgs:
  - registro y login, logout, expiración
  - admin vs member (UI y servidor), aislamiento Acme/Beta
  - CRUD de issues, filtros, paginación, búsqueda
  - kanban + optimista + persistencia al recargar
  - comentarios (solo autor) e historial
- [ ] Verificar que los datos persisten entre sesiones y reinicios.
- [ ] Anotar limitaciones del plan gratuito (cold start de funciones, pausa de proyectos Supabase tras inactividad: **abrir el panel de Supabase el día de la entrega para asegurar que no esté pausado**).

### Fase 16 — README.md (~45 min) [P0]
Secciones obligatorias del PDF:
- [ ] URL desplegada + credenciales (admin y 2 members de **Acme** y **Beta**).
- [ ] Instalación y ejecución local, variables de entorno, migraciones, seed y cómo correr pruebas (incluida la BD de prueba).
- [ ] Pasos para reproducir el despliegue y servicios usados (Vercel + Supabase + GitHub Actions).
- [ ] Enlace al pipeline exitoso del commit entregado.
- [ ] Descripción de las funciones de servidor/endpoints.
- [ ] Decisiones técnicas y trade-offs (ver lista de ideas abajo).
- [ ] **Uso de IA**: herramientas (Claude Code), qué se delegó, cómo se verificó (tests, revisión manual de diff, pruebas manuales en el despliegue). Declarar plantillas/código reutilizado (shadcn/ui, etc.).
- [ ] Limitaciones y requisitos incompletos, con honestidad.
- 🟢 Commit: `docs: readme`

### Fase 17 — Preparación para la revisión en vivo (~30 min) [P1]
- [ ] Repasar la guía privada de estudio.
- [ ] Practicar 2–3 cambios pequeños en vivo (ej. agregar un nuevo valor de priority, añadir un filtro, cambiar una regla de permiso) y saber en qué archivos tocar.

### Extras (solo si TODO lo anterior está verde) [P2]
`docker-compose.yml` para Postgres local → CD automático a Vercel → adjuntos → realtime.

---

## 3. Calendario sugerido (24 h, con sueño y margen)

| Bloque | Fases | Meta |
|---|---|---|
| Hoy, primeras ~4 h | 0–4 | Esqueleto desplegado + CI verde |
| Siguientes ~5 h | 5–8 | Backend completo (auth, permisos, issues, historial, comentarios) |
| Dormir | — | Dormir de verdad; rinde más que 4 h extra cansado |
| Mañana, ~5 h | 9–12 | UI completa |
| Mañana, ~3 h | 13–14 | Tests + CI verde |
| Última ~2 h antes de las 5 p. m. | 15–17 | Verificación en producción + README. **Congelar código a las 3:30 p. m.** |

**Checkpoints duros:** a las 12:00 a. m. debe existir backend con tests de permisos; a las 12:00 m. de mañana la UI debe estar completa; a las 3:30 p. m. se congela el código y solo se arreglan bugs críticos y README.

## 4. Lista de recortes si el tiempo aprieta (en este orden)
1. Pulido visual y accesibilidad extra.
2. Kanban con una sola consulta (`pageSize` alto) en vez de por columna.
3. Rate limit: versión simple en memoria (ya es la propuesta).
4. Búsqueda `ILIKE` simple (sin índices ni trigram).
**Nunca recortar:** autorización en servidor, aislamiento por org, transacción de historial, los tests mínimos listados, CI verde, despliegue con URL, README.

## 5. Ideas de decisiones/trade-offs para el README
- Supabase solo como Postgres; auth propia por requerir `org_id` y `role` en el modelo.
- JWT en cookie httpOnly (mitiga XSS) con `SameSite=Lax` (mitiga CSRF básico); re-login al expirar en lugar de refresh tokens.
- 404 en lugar de 403 en recursos de otra org (no filtra existencia).
- Rate limit en memoria: simple, pero por instancia en serverless.
- `ILIKE` para búsqueda: suficiente para el volumen; con más datos se usaría full-text search/trigram.
- Paginación por offset (simple); con más volumen, keyset.
- Pooler en modo transacción → `prepare: false`.
- Historial dentro de la misma transacción que el cambio (atomicidad).
- Eventos en cascada al borrar el issue (permitido por el enunciado).

## 6. Definición de "terminado" (checklist final)
- [ ] URL pública funciona con credenciales de README (6 usuarios: 3 por org).
- [ ] Todos los requisitos de las páginas 1–2 del PDF verificados en producción.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pasan en local.
- [ ] CI verde en el commit entregado, enlace en README.
- [ ] Migraciones Drizzle en el repo; seed reproducible (≥30 issues).
- [ ] `.env.example` presente, ningún secreto en el repo (revisar historial de git).
- [ ] README completo y honesto.
