CREATE TABLE "team_skill_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"skill_id" integer NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
	"level" integer NOT NULL CHECK ("level" >= 0 AND "level" <= 3),
	"snapshot_date" date NOT NULL DEFAULT CURRENT_DATE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_skill_snapshots_unique" UNIQUE ("team_id", "skill_id", "snapshot_date")
);

CREATE INDEX "idx_snapshots_team_date" ON "team_skill_snapshots" ("team_id", "snapshot_date");
CREATE INDEX "idx_snapshots_date" ON "team_skill_snapshots" ("snapshot_date");
