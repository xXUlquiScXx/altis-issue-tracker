ALTER TABLE "issues" ADD COLUMN "position" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Relleno de las filas que ya existían: cada tarjeta conserva el orden que tenía
-- (la más reciente primero) dentro de su organización y su columna.
UPDATE "issues" AS i SET "position" = ranked.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY org_id, status ORDER BY updated_at DESC, id DESC) AS rn
  FROM "issues"
) AS ranked
WHERE i.id = ranked.id;--> statement-breakpoint
CREATE INDEX "issues_org_status_position_idx" ON "issues" USING btree ("org_id","status","position");