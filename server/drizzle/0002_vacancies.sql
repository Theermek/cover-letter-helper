CREATE TABLE "vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_text" text NOT NULL,
	"text_hash" text NOT NULL,
	"url" text,
	"company" text,
	"title" text,
	"grade" text,
	"work_format" text,
	"salary_raw" text,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" text,
	"hard_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"soft_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"letter" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "vacancies_text_hash_key" ON "vacancies" USING btree ("text_hash");--> statement-breakpoint
CREATE INDEX "vacancies_created_at_idx" ON "vacancies" USING btree ("created_at" DESC NULLS LAST);