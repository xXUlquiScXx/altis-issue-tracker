import { sql } from 'drizzle-orm'
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'member'])
export const statusEnum = pgEnum('status', ['todo', 'in_progress', 'done'])
export const priorityEnum = pgEnum('priority', ['low', 'med', 'high'])
export const eventTypeEnum = pgEnum('event_type', [
  'created',
  'status_changed',
  'priority_changed',
  'assignee_changed',
])

export const organizations = pgTable('organizations', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  orgId: uuid()
    .notNull()
    .references(() => organizations.id),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text().notNull(),
  role: roleEnum().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const issues = pgTable(
  'issues',
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id),
    title: text().notNull(),
    description: text(),
    status: statusEnum().notNull().default('todo'),
    priority: priorityEnum().notNull().default('med'),
    assigneeId: uuid().references(() => users.id),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    labels: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('issues_title_not_empty', sql`length(trim(${t.title})) > 0`),
    index('issues_org_updated_idx').on(t.orgId, t.updatedAt.desc()),
    index('issues_org_status_idx').on(t.orgId, t.status),
  ],
)

export const comments = pgTable(
  'comments',
  {
    id: uuid().primaryKey().defaultRandom(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('comments_issue_created_idx').on(t.issueId, t.createdAt)],
)

export const issueEvents = pgTable(
  'issue_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id),
    actorId: uuid()
      .notNull()
      .references(() => users.id),
    type: eventTypeEnum().notNull(),
    fromValue: text(),
    toValue: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('issue_events_issue_created_idx').on(t.issueId, t.createdAt)],
)
