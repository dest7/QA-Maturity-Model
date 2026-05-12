CREATE TABLE "team_skill_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
	"skill_id" integer NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
	"old_level" integer CHECK ("old_level" >= 0 AND "old_level" <= 3),
	"new_level" integer NOT NULL CHECK ("new_level" >= 0 AND "new_level" <= 3),
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"changed_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_history_team_date" ON "team_skill_history" ("team_id", "changed_at");
CREATE INDEX "idx_history_date" ON "team_skill_history" ("changed_at");
CREATE INDEX "idx_history_user" ON "team_skill_history" ("changed_by_user_id");
