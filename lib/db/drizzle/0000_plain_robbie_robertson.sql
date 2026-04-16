CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"level_descriptions" text[] NOT NULL,
	"level_requirements" text[] DEFAULT '{}' NOT NULL,
	"level_artifacts" text[] DEFAULT '{}' NOT NULL,
	"level_recommendations" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_skill_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	"name" text NOT NULL,
	"link" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_skill_levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	"level" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"overall_level" integer DEFAULT 0 NOT NULL,
	"assessment_status" text DEFAULT 'planned' NOT NULL,
	"last_assessed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "team_skill_artifacts" ADD CONSTRAINT "team_skill_artifacts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_skill_artifacts" ADD CONSTRAINT "team_skill_artifacts_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_skill_levels" ADD CONSTRAINT "team_skill_levels_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_skill_levels" ADD CONSTRAINT "team_skill_levels_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;