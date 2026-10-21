# Issue Tracker Kanban

[![CI](https://github.com/xXUlquiScXx/altis-issue-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/xXUlquiScXx/altis-issue-tracker/actions/workflows/ci.yml)

Gestor de issues **multi-organización** con listado, tablero kanban (arrastrar y soltar, con orden manual dentro de cada columna), comentarios en Markdown e historial de cambios. Proyecto del reto técnico de Altis.

- **App desplegada:** https://altis-issue-tracker.vercel.app/
- **Repositorio:** https://github.com/xXUlquiScXx/altis-issue-tracker
- **CI (workflow):** https://github.com/xXUlquiScXx/altis-issue-tracker/actions/workflows/ci.yml
- **Run verde de referencia:** https://github.com/xXUlquiScXx/altis-issue-tracker/actions/runs/39645226386

> La primera petición tras un rato sin uso puede tardar unos segundos (ver [Limitaciones](#limitaciones-honestas)).

## Credenciales de prueba

Todas las cuentas usan la contraseña **`Password123!`**.

| Organización | Rol | Nombre | Correo |
|---|---|---|---|
| Acme | admin | Alicia Admin | `admin@acme.test` |
| Acme | member | Ana Martínez | `ana@acme.test` |
| Acme | member | Luis Gómez | `luis@acme.test` |
| Beta | admin | Bruno Admin | `admin@beta.test` |
| Beta | member | Beatriz Ruiz | `bea@beta.test` |
| Beta | member | Carlos Peña | `carlos@beta.test` |

Cada organización tiene 16 issues, comentarios e historial. Cualquier cuenta nueva creada desde `/register` es siempre `member` de **Acme** (el cliente no puede elegir rol ni organización).

## Qué hace

- **Lista** de issues con búsqueda (título y descripción), filtros por estado, prioridad y responsable, y paginación en el servidor. Los filtros viven en la URL, así que se pueden compartir y sobreviven a recargar.
- **Kanban** con tres columnas (Por hacer / En progreso / Hecho). Se arrastra una tarjeta a otra columna o **entre dos tarjetas** para ordenarla; el orden queda guardado. La actualización es optimista: la tarjeta se mueve al instante y, si el servidor rechaza el cambio, vuelve a su sitio y aparece el motivo. Alternativa sin arrastre (teclado, celular, lector de pantalla): el selector «Mover a» de cada tarjeta.
- **Detalle** en una ruta propia (`/issues/<id>`), con edición, borrado, comentarios con Markdown seguro e historial de cambios (solo lectura).
- **Roles:** el admin gestiona cualquier issue de su organización; el member crea issues asignados a sí mismo y edita solo los que tiene asignados (incluido status y prioridad), sin reasignar ni borrar. Solo el autor edita o borra su comentario (aunque otro sea admin).
- Tema claro/oscuro, diseño responsive (probado desde 375 px).

## Stack

React 19 + TypeScript · TanStack Start (server functions) · TanStack Router · TanStack Query · PostgreSQL en Supabase · Drizzle ORM (migraciones SQL versionadas) · zod · Tailwind CSS + shadcn/ui · `@dnd-kit/core` · `react-markdown` · Vitest + Testing Library · GitHub Actions · Vercel.

Autenticación propia con `bcryptjs` + `jose` (JWT) + cookie `httpOnly`. **No se usa Supabase Auth ni el cliente JS de Supabase**: Supabase es solo el servidor de Postgres.

## Ejecución local

Requisitos: Node 22 (ver `.nvmrc`), pnpm 12 (la versión exacta está en `packageManager`) y un Postgres para pruebas.

```bash
pnpm install
cp .env.example .env      # y completa los valores (ver tabla)
pnpm db:migrate           # aplica las migraciones a DATABASE_URL_MIGRATE
pnpm db:seed --yes        # BORRA los datos de esa base y carga los de ejemplo
pnpm dev                  # http://localhost:3000
```

### Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Conexión que usa la app. En Supabase: pooler en modo transacción (puerto 6543). |
| `DATABASE_URL_MIGRATE` | Conexión para migraciones y seed. En Supabase: session pooler (puerto 5432) o conexión directa. |
| `TEST_DATABASE_URL` | Postgres **aislado** para las pruebas. Los tests y `db:reset:test` lo **vacían**. Debe ser distinto de `DATABASE_URL`. |
| `JWT_SECRET` | Secreto largo y aleatorio para firmar la sesión (`openssl rand -base64 48`). |
| `DEMO_ORG_SLUG` | Organización donde se registran los usuarios nuevos (`acme`). |
| `APP_ORIGIN` | URL pública de la app (`http://localhost:3000` en local). |

Los secretos no están en el repo: `.env` está ignorado y solo se versiona `.env.example`.

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` / `pnpm build` | Servidor de desarrollo / build de producción. |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit`. |
| `pnpm test` | Todas las pruebas (carga `.env`). |
| `pnpm db:generate` | Genera una migración nueva a partir de `src/db/schema.ts`. |
| `pnpm db:migrate` | Aplica las migraciones pendientes. |
| `pnpm db:status` | Solo lectura: base de destino, migraciones aplicadas, valores del enum y conteo de filas. |
| `pnpm db:seed --yes` | Vacía la base y carga 2 organizaciones × (1 admin + 2 members), 32 issues, comentarios e historial. Sin `--yes` solo muestra el destino y se detiene. |
| `pnpm db:reset:test` | Vacía y vuelve a migrar la base de pruebas. |

### Pruebas

```bash
createdb altis_issue_tracker_test            # una vez, en tu Postgres local
# en .env: TEST_DATABASE_URL=postgres://TU_USUARIO@localhost:5432/altis_issue_tracker_test
pnpm db:reset:test
pnpm test
```

Hay 23 archivos y 276 pruebas (servidor + interfaz). Las que usan base de datos corren contra `TEST_DATABASE_URL`; si no está definida, se omiten. Un guard aborta si `TEST_DATABASE_URL` apunta a la misma base que `DATABASE_URL`, para no tocar nunca producción.

Qué cubren, priorizando comportamiento:

- **Servidor:** sin sesión → 401; aislamiento entre organizaciones (404); permisos admin/member; comentarios solo del autor; el registro nunca crea admins; cookie y token; límite de intentos; una prueba de política que exige `requireUser` en cada función de servidor no pública.
- **Persistencia:** cada cambio de status, prioridad, responsable, título, descripción o etiquetas deja su evento; si falla el historial se revierte todo el cambio (rollback); una operación rechazada no escribe nada ni genera eventos; el orden manual (posiciones, renumeración, concurrencia, permisos, aislamiento).
- **Interfaz:** filtros y paginación; el kanban mueve al instante y **revierte visualmente** si el servidor falla; orden entre tarjetas; línea de inserción; login, formulario y Markdown seguro.

El gesto físico de arrastrar no se automatiza: los tests simulan lo que entrega `dnd-kit` al soltar (qué tarjeta, sobre cuál, en qué mitad). El arrastre real se probó a mano.

## Despliegue

Servicios: **Vercel** (app), **Supabase** (Postgres) y **GitHub Actions** (CI).

1. En Supabase crea un proyecto y copia dos cadenas: el pooler en modo transacción (6543) para `DATABASE_URL` y el session pooler (5432) para `DATABASE_URL_MIGRATE`.
2. Desde tu máquina, con `DATABASE_URL_MIGRATE` apuntando a Supabase: `pnpm db:migrate`, luego `pnpm db:status` (debe decir `4 of 4` y `up to date`) y, una sola vez, `pnpm db:seed --yes`.
3. En Vercel importa el repo de GitHub (el build es `pnpm build`; Nitro detecta Vercel solo). Define `DATABASE_URL`, `JWT_SECRET`, `DEMO_ORG_SLUG` y `APP_ORIGIN` (la URL pública). La región de las funciones es `iad1`, la más cercana a la base.
4. Cada push a `main` despliega. **Orden importante cuando hay migraciones nuevas: migrar Supabase primero y después hacer push**; si no, la app pediría una columna que aún no existe.

No repitas el seed en producción después de que alguien se registre: borra todos los datos.

## CI

`.github/workflows/ci.yml` corre en cada push y pull request sobre `ubuntu-24.04` (fijado en lugar de `ubuntu-latest` para que el resultado no cambie con la migración de GitHub a una imagen nueva) con un Postgres 16 temporal como *service*:

`install --frozen-lockfile` → `lint` → `typecheck` → `db:migrate` (sobre el Postgres temporal) → `test` → `build`.

## Funciones de servidor

La app usa *server functions* de TanStack Start (RPC tipado), no una API REST. Todas validan la entrada con zod, devuelven errores con la forma `{ error: { code, message, fields? } }` y están en `src/server/`.

| Función | Método | Qué hace | Quién |
|---|---|---|---|
| `register` | POST | Crea un `member` en la org demo y abre sesión. Límite de intentos. | Público |
| `login` | POST | Abre sesión (cookie `httpOnly`). Mensaje idéntico para correo inexistente o contraseña errónea. Límite de intentos. | Público |
| `logout` | POST | Borra la cookie. | Público |
| `getMe` | GET | Usuario de la sesión. | Sesión |
| `listIssues` | GET | Lista paginada (`page`, `pageSize` ≤ 100) con filtros `status`, `priority`, `assignee`, `q`. Orden: más reciente primero. | Sesión |
| `getIssue` | GET | Detalle de un issue. | Sesión |
| `createIssue` | POST | Crea un issue. El member solo puede asignárselo a sí mismo. | Sesión |
| `updateIssue` | POST | Edita campos; registra eventos de los cambios efectivos en la misma transacción. | Admin, o member si es suyo |
| `moveIssue` | POST | Cambia la columna y/o el lugar dentro de ella (kanban). | Admin, o member si es suyo |
| `deleteIssue` | POST | Borra el issue (y en cascada sus comentarios y eventos). | Solo admin |
| `listOrgUsers` | GET | Usuarios de la org (solo id, nombre y rol), para filtros y asignación. | Sesión |
| `listIssueEvents` | GET | Historial del issue, en orden cronológico. Solo lectura. | Sesión |
| `listComments` | GET | Comentarios de un issue. | Sesión |
| `createComment` | POST | Comenta un issue de la org. | Sesión |
| `updateComment` / `deleteComment` | POST | Edita o borra un comentario. | Solo su autor |
| `/api/health` | GET | Comprueba que la app llega a la base. Sin detalles internos. | Público |

Los permisos se deciden en un solo módulo, `can(user, action, resource)` (`src/server/authz.ts`). La interfaz solo oculta o deshabilita lo que no se puede hacer; nunca es la única barrera.

## Decisiones y trade-offs

- **Aislamiento por organización.** Toda consulta de issues, comentarios, usuarios y eventos filtra por el `org_id` de la sesión; `org_id` y `role` se leen de la base, jamás del cliente ni del token. Un recurso de otra organización responde **404** (no 403), para no revelar que existe.
- **Historial transaccional.** El cambio del issue y sus eventos se escriben en la misma `db.transaction`. Si algo falla o la operación se rechaza, no queda ni cambio ni evento. Solo hay eventos por cambios *efectivos* (guardar sin cambiar nada no crea nada). De la descripción no se guarda el texto, solo que cambió. Los eventos se borran en cascada con el issue.
- **Cookie en vez de `localStorage`.** El JWT va en cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción (mitiga el robo por XSS); expira en 2 horas y se vuelve a iniciar sesión, sin refresh tokens para mantenerlo simple. Las llamadas a las funciones de servidor con `Origin` ausente o ajeno se rechazan con 403 (comprobado en producción).
- **Rate limit en memoria** (5 intentos por minuto por IP + correo). Es simple y suficiente para la demo, pero en serverless cada instancia lleva su propia cuenta: no es un límite global.
- **Kanban con una sola consulta** (`pageSize` 100) en lugar de una por columna: una sola caché que actualizar de forma optimista. Con más de 100 issues el tablero avisa y se acota con filtros.
- **Orden manual con posiciones fraccionarias.** Cada issue tiene un número `position`; al soltar entre dos tarjetas se usa el promedio de sus vecinas, sin reescribir las demás. Si se agotan los decimales, el servidor renumera la columna. Reordenar dentro de una columna no genera evento de historial. Se usó solo `@dnd-kit/core` en vez de añadir `@dnd-kit/sortable`: una dependencia menos que explicar.
- **Búsqueda con `ILIKE`** y paginación por *offset*: suficientes para este volumen; con más datos serían búsqueda de texto completo y paginación por cursor.
- **Pooler en modo transacción** → `postgres(url, { prepare: false })`; las migraciones usan otra cadena (session pooler) porque necesitan una conexión de sesión.
- **Markdown** solo con `react-markdown`; no se usa `dangerouslySetInnerHTML` en ningún lugar.
- **Validación compartida:** los mismos esquemas de zod validan en el formulario (respuesta rápida) y en el servidor (la que realmente protege).

## Uso de IA

Usé **Claude Code** (CLI de Anthropic) como asistente de programación durante todo el proyecto, fase por fase, siguiendo el plan de `ROADMAP.md` y las reglas de `CLAUDE.md` (ambos están en el repo).

**Qué se delegó:** la mayor parte de la escritura de código y pruebas (esquema y migraciones, servicios del servidor, interfaz, kanban, tests y workflow de CI), la búsqueda en la documentación oficial y la redacción de este README.

**Qué decidí yo y cómo se verificó:**
- Las decisiones de alcance y comportamiento (por ejemplo: separar la entrega en dos partes, mostrar el detalle como ruta compartible, registrar en el historial también título, descripción y etiquetas, añadir el orden manual en el kanban) las pedí yo y las revisé.
- Revisé el diff de cada fase antes de hacer yo mismo cada commit; el asistente tenía prohibido hacer commits, push o ramas.
- Las ejecuciones reales (lint, typecheck, tests, build, migraciones) se reportaron con su salida; cuando algo falló se mostró y se corrigió.
- Para comprobar que las pruebas detectan fallos de verdad, se hicieron **pruebas de mutación manuales**: romper a propósito el código (quitar un filtro de organización, un permiso, un rollback, etc.) y confirmar que alguna prueba se pone en rojo; luego se restauró el código.
- En producción verifiqué a mano el flujo completo con las dos organizaciones (permisos, aislamiento, registro, CRUD, kanban, comentarios, historial, sesión) y se complementó con un script de solo lectura de 56 comprobaciones sin fallos contra la URL pública.
- Cuando una sugerencia dependía de una API de TanStack Start, Router, Query o Drizzle, se consultó la documentación oficial vigente antes de usarla.

Entiendo y puedo explicar el código entregado; el repo está pensado con funciones pequeñas y sin abstracciones innecesarias para facilitarlo.

## Código reutilizado

- Componentes de **shadcn/ui** (generados por su CLI en `src/components/ui/`) y el scaffold inicial de TanStack Start.
- Librerías de terceros listadas en `package.json`; no se copió código de otros proyectos.

## Limitaciones honestas

- **Plan gratuito.** Vercel tiene *cold start*: tras un rato sin uso, la primera petición puede tardar entre 1 y 4 segundos (medido: 0,5 a 3,5 s). Supabase **pausa** los proyectos gratuitos tras una semana sin actividad; si la app no carga datos, hay que reactivar el proyecto desde su panel.
- **Rate limit por instancia**, no global (ver arriba).
- **Seed de ejemplo con contraseña única y pública.** Es solo para esta demo; en un sistema real no existiría.
- **Sin recuperación de contraseña, verificación de correo ni cierre de sesión en otros dispositivos.** La sesión dura 2 horas y no se renueva.
- **Tablero acotado a 100 issues** por consulta (con aviso); no hay paginación dentro del kanban.
- **Dos personas moviendo la misma columna a la vez:** el servidor serializa los cambios (bloqueo de fila), pero la pantalla del otro usuario se actualiza al volver a la pestaña o recargar; no hay tiempo real.
- **Arrastre no automatizado:** el gesto físico se probó a mano; los tests simulan los eventos de `dnd-kit`.
- **Búsqueda `ILIKE`** sin índices de texto: adecuada para decenas de miles de filas, no para millones.
- Los extras opcionales del reto (adjuntos, tiempo real, `docker-compose`, despliegue continuo propio) no se implementaron.
