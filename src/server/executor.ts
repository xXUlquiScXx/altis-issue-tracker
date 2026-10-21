import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

// Sirve tanto para `db` como para una transacción (`tx`): las consultas de lectura
// pueden ejecutarse dentro de la transacción que está en curso.
export type Executor = Pick<PostgresJsDatabase, 'select'>
