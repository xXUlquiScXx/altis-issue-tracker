import { hash } from 'bcryptjs'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  comments,
  issueEvents,
  issues,
  organizations,
  users,
  type eventTypeEnum,
  type priorityEnum,
  type statusEnum,
} from './schema'
import { describeDatabase } from './describe-database'

type Status = (typeof statusEnum.enumValues)[number]
type Priority = (typeof priorityEnum.enumValues)[number]
type EventType = (typeof eventTypeEnum.enumValues)[number]

// assignee: 0 = admin, 1 = primer member, 2 = segundo member, null = sin asignar.
interface IssueSeed {
  title: string
  description: string
  status: Status
  priority: Priority
  assignee: 0 | 1 | 2 | null
  labels: string[]
}

const PASSWORD = 'Password123!'

// prettier-ignore
const ORGS = [
  {
    name: 'Acme',
    slug: 'acme',
    users: [
      { email: 'admin@acme.test', name: 'Alicia Admin', role: 'admin' },
      { email: 'ana@acme.test', name: 'Ana Martínez', role: 'member' },
      { email: 'luis@acme.test', name: 'Luis Gómez', role: 'member' },
    ],
    issues: [
      { title: 'Error 500 al guardar el perfil', description: 'Al guardar el perfil con un nombre largo la API responde **500**.\n\nPasos:\n1. Ir a perfil\n2. Escribir más de 120 caracteres\n3. Guardar', status: 'in_progress', priority: 'high', assignee: 1, labels: ['bug', 'backend'] },
      { title: 'Agregar modo oscuro', description: 'Permitir cambiar entre tema claro y oscuro desde el menú de usuario.', status: 'todo', priority: 'low', assignee: 2, labels: ['feature', 'ui'] },
      { title: 'Revisar tiempos de carga del dashboard', description: 'El dashboard tarda más de 4 s en cargar. Medir con Lighthouse y listar causas.', status: 'todo', priority: 'med', assignee: null, labels: ['performance'] },
      { title: 'Exportar reportes a CSV', description: 'Botón para descargar el reporte mensual en formato `.csv`.', status: 'done', priority: 'med', assignee: 1, labels: ['feature'] },
      { title: 'Actualizar dependencias de seguridad', description: 'Hay 3 avisos de `pnpm audit`. Actualizar y verificar que el build sigue verde.', status: 'done', priority: 'high', assignee: 0, labels: ['chore', 'security'] },
      { title: 'Corregir typo en el correo de bienvenida', description: 'Dice "Bienvenodo" en lugar de "Bienvenido".', status: 'done', priority: 'low', assignee: 2, labels: ['bug'] },
      { title: 'Paginación del listado de clientes', description: 'Hoy se cargan todos los clientes. Paginar en el servidor (20 por página).', status: 'in_progress', priority: 'med', assignee: 2, labels: ['backend', 'performance'] },
      { title: 'Documentar el flujo de despliegue', description: 'Escribir en el wiki los pasos para desplegar y hacer rollback.', status: 'todo', priority: 'low', assignee: null, labels: ['docs'] },
      { title: 'El botón de guardar no se deshabilita', description: 'Se pueden enviar dos formularios haciendo doble clic.', status: 'todo', priority: 'high', assignee: 1, labels: ['bug', 'ui'] },
      { title: 'Notificaciones por correo', description: 'Enviar un correo cuando te asignan un issue.\n\n- [ ] Plantilla\n- [ ] Cola de envío', status: 'todo', priority: 'med', assignee: 0, labels: ['feature', 'backend'] },
      { title: 'Filtro por fecha en facturas', description: 'Agregar rango de fechas al listado de facturas.', status: 'in_progress', priority: 'med', assignee: 1, labels: ['feature', 'ui'] },
      { title: 'Migrar logs a formato JSON', description: 'Facilita la búsqueda en el agregador de logs.', status: 'done', priority: 'low', assignee: null, labels: ['chore'] },
      { title: 'Pantalla de login se ve rota en móvil', description: 'En 375 px el botón queda fuera de la pantalla.', status: 'in_progress', priority: 'high', assignee: 2, labels: ['bug', 'ui'] },
      { title: 'Límite de intentos de login', description: 'Bloquear 15 minutos tras 5 intentos fallidos.', status: 'todo', priority: 'high', assignee: 0, labels: ['security', 'backend'] },
      { title: 'Rediseñar tabla de usuarios', description: 'Usar el componente de tabla nuevo con ordenamiento.', status: 'todo', priority: 'low', assignee: null, labels: ['ui'] },
      { title: 'Pruebas para el módulo de pagos', description: 'Cubrir al menos pago exitoso, rechazado y reembolso.', status: 'done', priority: 'med', assignee: 1, labels: ['tests'] },
    ],
  },
  {
    name: 'Beta',
    slug: 'beta',
    users: [
      { email: 'admin@beta.test', name: 'Bruno Admin', role: 'admin' },
      { email: 'bea@beta.test', name: 'Beatriz Ruiz', role: 'member' },
      { email: 'carlos@beta.test', name: 'Carlos Peña', role: 'member' },
    ],
    issues: [
      { title: 'La app se cierra al abrir la cámara', description: 'En Android 13 la app se cierra al pedir permiso de cámara.', status: 'in_progress', priority: 'high', assignee: 1, labels: ['bug', 'mobile'] },
      { title: 'Nuevo onboarding de 3 pasos', description: 'Diseñar e implementar pantallas de bienvenida.\n\n**Meta:** subir la retención del día 1.', status: 'todo', priority: 'med', assignee: 2, labels: ['feature', 'ux'] },
      { title: 'Landing: cambiar texto del hero', description: 'Marketing pidió un mensaje nuevo para la campaña de noviembre.', status: 'done', priority: 'low', assignee: 1, labels: ['marketing'] },
      { title: 'Integrar pasarela de pagos', description: 'Evaluar proveedores y estimar esfuerzo.', status: 'todo', priority: 'high', assignee: 0, labels: ['feature', 'backend'] },
      { title: 'Imágenes sin optimizar en el catálogo', description: 'Las imágenes pesan más de 2 MB. Convertir a WebP.', status: 'in_progress', priority: 'med', assignee: null, labels: ['performance'] },
      { title: 'Traducir la app al inglés', description: 'Extraer textos a archivos de idioma.', status: 'todo', priority: 'low', assignee: null, labels: ['i18n'] },
      { title: 'Error al restablecer contraseña', description: 'El enlace del correo expira de inmediato.', status: 'done', priority: 'high', assignee: 2, labels: ['bug', 'security'] },
      { title: 'Agregar métricas de uso', description: 'Medir pantallas más visitadas sin guardar datos personales.', status: 'todo', priority: 'med', assignee: 1, labels: ['analytics'] },
      { title: 'Revisar accesibilidad del checkout', description: 'Contraste, foco y lectores de pantalla.', status: 'in_progress', priority: 'med', assignee: 2, labels: ['ux', 'a11y'] },
      { title: 'Limpiar ramas antiguas del repositorio', description: 'Borrar ramas mergeadas hace más de 3 meses.', status: 'done', priority: 'low', assignee: 0, labels: ['chore'] },
      { title: 'Notificaciones push duplicadas', description: 'Algunos usuarios reciben la misma notificación dos veces.', status: 'in_progress', priority: 'high', assignee: 1, labels: ['bug', 'mobile'] },
      { title: 'Modo sin conexión para el catálogo', description: 'Guardar en caché los últimos productos vistos.', status: 'todo', priority: 'med', assignee: 2, labels: ['feature', 'mobile'] },
      { title: 'Actualizar política de privacidad', description: 'Legal envió el texto nuevo. Publicarlo en web y app.', status: 'todo', priority: 'low', assignee: null, labels: ['docs', 'legal'] },
      { title: 'Rendimiento del buscador', description: 'La búsqueda tarda 2 s con 10 000 productos.', status: 'todo', priority: 'high', assignee: 0, labels: ['performance', 'backend'] },
      { title: 'Botón "Compartir" no funciona en iOS', description: 'No abre la hoja de compartir nativa.', status: 'done', priority: 'med', assignee: 1, labels: ['bug', 'mobile'] },
      { title: 'Crear guía de estilos', description: 'Colores, tipografías y espaciados en un solo documento.', status: 'in_progress', priority: 'low', assignee: 2, labels: ['ux', 'docs'] },
    ],
  },
] satisfies {
  name: string
  slug: string
  users: { email: string; name: string; role: 'admin' | 'member' }[]
  issues: IssueSeed[]
}[]

const COMMENT_BODIES = [
  'Lo estoy revisando, avanzo hoy.',
  'Pude reproducirlo. Dejo los pasos en la descripción.',
  'Cambio de prioridad según lo hablado en la reunión.',
  '¿Podemos dividirlo en tareas más pequeñas?',
  'Listo para revisión. Ojo con el caso de **datos vacíos**.',
  'Probé en producción y funciona bien.',
]

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

async function seed() {
  const url = process.env.DATABASE_URL_MIGRATE
  if (!url) throw new Error('DATABASE_URL_MIGRATE is not set')

  // El seed BORRA todos los datos antes de insertar. Para que nadie lo corra por
  // error contra la base equivocada, se muestra el destino y se exige --yes.
  console.log(`Target database: ${describeDatabase(url)}`)
  if (!process.argv.includes('--yes')) {
    console.error(
      'The seed DELETES all data in that database. To continue run: pnpm db:seed --yes',
    )
    process.exit(1)
  }

  const client = postgres(url, { max: 1 })
  const db = drizzle(client, { casing: 'snake_case' })
  const passwordHash = await hash(PASSWORD, 10)
  const now = Date.now()

  await db.transaction(async (tx) => {
    // Truncar primero hace que el seed sea reproducible.
    await tx.execute(
      sql`TRUNCATE organizations, users, issues, comments, issue_events RESTART IDENTITY CASCADE`,
    )

    for (const orgSeed of ORGS) {
      const [org] = await tx
        .insert(organizations)
        .values({ name: orgSeed.name, slug: orgSeed.slug })
        .returning()
      if (!org) throw new Error('Organization insert failed')

      const orgUsers = await tx
        .insert(users)
        .values(
          orgSeed.users.map((u) => ({ ...u, passwordHash, orgId: org.id })),
        )
        .returning()
      // returning() conserva el orden de inserción: [admin, member1, member2].
      const [admin] = orgUsers
      if (!admin) throw new Error('Admin insert failed')

      const issueRows: (typeof issues.$inferInsert)[] = []
      const eventRows: (typeof issueEvents.$inferInsert)[] = []
      const commentRows: (typeof comments.$inferInsert)[] = []

      orgSeed.issues.forEach((seedIssue, i) => {
        const id = crypto.randomUUID()
        const assignee =
          seedIssue.assignee === null ? null : orgUsers[seedIssue.assignee]!
        // Un member solo crea issues asignados a sí mismo; el resto los crea el admin.
        const assignedLater = assignee !== null && i % 3 === 0
        const creator =
          assignee && assignee.role === 'member' && !assignedLater
            ? assignee
            : admin
        const actor = assignee ?? admin

        let time = now - (orgSeed.issues.length - i) * DAY
        const createdAt = new Date(time)
        const addEvent = (
          type: EventType,
          who: typeof admin,
          from: string | null,
          to: string | null,
        ) => {
          time += HOUR
          eventRows.push({
            issueId: id,
            orgId: org.id,
            actorId: who.id,
            type,
            fromValue: from,
            toValue: to,
            createdAt: new Date(time),
          })
        }

        eventRows.push({
          issueId: id,
          orgId: org.id,
          actorId: creator.id,
          type: 'created',
          createdAt,
        })
        if (assignee && assignedLater) {
          addEvent('assignee_changed', admin, null, assignee.id)
        }
        if (seedIssue.priority !== 'med') {
          addEvent('priority_changed', actor, 'med', seedIssue.priority)
        }
        if (seedIssue.status !== 'todo') {
          addEvent('status_changed', actor, 'todo', 'in_progress')
        }
        if (seedIssue.status === 'done') {
          addEvent('status_changed', actor, 'in_progress', 'done')
        }

        if (i % 2 === 0) {
          const authors = [actor, orgUsers[(i + 1) % 3]!]
          const count = i % 4 === 0 ? 2 : 1
          for (let c = 0; c < count; c++) {
            time += HOUR / 2
            commentRows.push({
              issueId: id,
              orgId: org.id,
              authorId: authors[c]!.id,
              body: COMMENT_BODIES[(i + c) % COMMENT_BODIES.length]!,
              createdAt: new Date(time),
              updatedAt: new Date(time),
            })
          }
        }

        issueRows.push({
          id,
          orgId: org.id,
          title: seedIssue.title,
          description: seedIssue.description,
          status: seedIssue.status,
          priority: seedIssue.priority,
          assigneeId: assignee?.id ?? null,
          createdBy: creator.id,
          labels: seedIssue.labels,
          createdAt,
          updatedAt: new Date(time),
        })
      })

      await tx.insert(issues).values(issueRows)
      await tx.insert(issueEvents).values(eventRows)
      await tx.insert(comments).values(commentRows)
      console.log(
        `${org.name}: ${orgUsers.length} users, ${issueRows.length} issues, ${commentRows.length} comments, ${eventRows.length} events`,
      )
    }
  })

  await client.end()
}

await seed()
console.log('Seed completed')
