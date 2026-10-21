// @vitest-environment node
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const url = process.env.TEST_DATABASE_URL

// Sin TEST_DATABASE_URL (ej. en local sin BD de pruebas) el test se omite.
describe.skipIf(!url)('migrations', () => {
  const client = postgres(url!, { max: 1 })
  afterAll(() => client.end())

  it('creates every table of the schema', async () => {
    const rows = await client`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name <> '__drizzle_migrations'
      order by table_name`
    expect(rows.map((r) => r.table_name)).toEqual([
      'comments',
      'issue_events',
      'issues',
      'organizations',
      'users',
    ])
  })

  it('rejects an issue with a blank title', async () => {
    await expect(
      client`insert into issues (org_id, title, created_by)
             values (gen_random_uuid(), '   ', gen_random_uuid())`,
    ).rejects.toThrow(/issues_title_not_empty/)
  })
})
