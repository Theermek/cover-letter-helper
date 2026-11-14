CREATE TABLE "profile" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"cv_text" text DEFAULT '' NOT NULL,
	"contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signature_enabled" boolean DEFAULT false NOT NULL,
	"signature_ru" text DEFAULT '' NOT NULL,
	"signature_en" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_single_row" CHECK ("profile"."id" = 1)
);
