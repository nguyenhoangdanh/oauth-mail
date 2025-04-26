// src/database/migrations/1719379000000-InitialSetup.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSetup1719379000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tạo extension UUID nếu chưa có
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Tạo ENUMs
    await queryRunner.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_logs_status_enum') THEN
              CREATE TYPE "email_logs_status_enum" AS ENUM(
                  'pending',
                  'processing',
                  'sent',
                  'delivered',
                  'opened',
                  'clicked',
                  'bounced',
                  'failed'
              );
          END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_events_event_enum') THEN
              CREATE TYPE "email_events_event_enum" AS ENUM(
                  'sent',
                  'delivered',
                  'opened',
                  'clicked',
                  'bounced',
                  'complained',
                  'failed'
              );
          END IF;
      END$$;
    `);

    // Tạo bảng email_templates
    if (!(await queryRunner.hasTable('email_templates'))) {
      await queryRunner.query(`
        CREATE TABLE "email_templates" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "name" character varying NOT NULL,
          "subject" character varying,
          "description" character varying,
          "content" text NOT NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "version" integer NOT NULL DEFAULT 1,
          "last_editor" character varying,
          "preview_text" character varying,
          "category" character varying,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "UQ_email_templates_name" UNIQUE ("name")
        )
      `);

      await queryRunner.query(
        `CREATE INDEX "IDX_email_templates_name" ON "email_templates" ("name")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_email_templates_category" ON "email_templates" ("category")`,
      );
    }

    // Tạo bảng email_logs
    if (!(await queryRunner.hasTable('email_logs'))) {
      await queryRunner.query(`
        CREATE TABLE "email_logs" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "email_id" character varying NOT NULL,
          "to" character varying NOT NULL,
          "name" character varying,
          "subject" character varying NOT NULL,
          "template" character varying NOT NULL,
          "context" json NOT NULL DEFAULT '{}',
          "status" "email_logs_status_enum" NOT NULL DEFAULT 'pending',
          "message_id" character varying,
          "attempts" integer NOT NULL DEFAULT 0,
          "error" character varying,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          "sent_at" TIMESTAMP,
          "last_status_at" TIMESTAMP,
          "opened_at" TIMESTAMP,
          "clicked_at" TIMESTAMP,
          "click_url" character varying,
          "bounce_reason" character varying,
          "open_count" integer NOT NULL DEFAULT 0,
          "click_count" integer NOT NULL DEFAULT 0,
          "campaign_id" character varying,
          "batch_id" character varying,
          "resend_id" character varying,
          "ip_address" character varying,
          "user_agent" character varying,
          "location" character varying,
          "device" character varying,
          "tags" json,
          "user_id" character varying,
          "complaint_reason" character varying,
          "is_test" boolean NOT NULL DEFAULT false
        )
      `);

      await queryRunner.query(
        `CREATE INDEX "IDX_email_logs_email_id" ON "email_logs" ("email_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_email_logs_status" ON "email_logs" ("status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_email_logs_campaign_id" ON "email_logs" ("campaign_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_email_logs_batch_id" ON "email_logs" ("batch_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_email_logs_user_id" ON "email_logs" ("user_id")`,
      );
    }

    // Tạo bảng email_events
    if (!(await queryRunner.hasTable('email_events'))) {
      await queryRunner.query(`
        CREATE TABLE "email_events" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "email_id" character varying NOT NULL,
          "event" "email_events_event_enum" NOT NULL,
          "recipient" character varying NOT NULL,
          "timestamp" TIMESTAMP NOT NULL,
          "metadata" json,
          "created_at" TIMESTAMP NOT NULL DEFAULT now()
        )
      `);

      await queryRunner.query(
        `CREATE INDEX "IDX_email_events_email_id" ON "email_events" ("email_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_email_events_event" ON "email_events" ("event")`,
      );
    }

    // Tạo bảng email_stats với cột date cho phép NULL ban đầu
    if (!(await queryRunner.hasTable('email_stats'))) {
      await queryRunner.query(`
        CREATE TABLE "email_stats" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "campaign_id" character varying,
          "template" character varying,
          "date" date,
          "sent" integer NOT NULL DEFAULT 0,
          "delivered" integer NOT NULL DEFAULT 0,
          "opened" integer NOT NULL DEFAULT 0,
          "clicked" integer NOT NULL DEFAULT 0,
          "bounced" integer NOT NULL DEFAULT 0,
          "complained" integer NOT NULL DEFAULT 0,
          "failed" integer NOT NULL DEFAULT 0,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now()
        )
      `);

      await queryRunner.query(
        `CREATE INDEX "IDX_email_stats_campaign_id" ON "email_stats" ("campaign_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_email_stats_template" ON "email_stats" ("template")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_email_stats_date" ON "email_stats" ("date")`,
      );
    }

    // Tạo bảng oauth_credentials
    if (!(await queryRunner.hasTable('oauth_credentials'))) {
      await queryRunner.query(`
        CREATE TABLE "oauth_credentials" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "provider" character varying NOT NULL,
          "access_token" text NOT NULL,
          "refresh_token" text NOT NULL,
          "expires_at" TIMESTAMP NOT NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "metadata" json,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now()
        )
      `);

      await queryRunner.query(
        `CREATE INDEX "IDX_oauth_credentials_provider" ON "oauth_credentials" ("provider")`,
      );
    }

    // Tạo bảng webhook_subscriptions
    if (!(await queryRunner.hasTable('webhook_subscriptions'))) {
      await queryRunner.query(`
        CREATE TABLE "webhook_subscriptions" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "name" character varying NOT NULL,
          "event" character varying NOT NULL,
          "endpoint" character varying NOT NULL,
          "secret" character varying NOT NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "failed_attempts" integer NOT NULL DEFAULT 0,
          "last_failure" TIMESTAMP,
          "last_success" TIMESTAMP,
          "headers" json NOT NULL DEFAULT '{}',
          "last_error_message" character varying,
          "success_count" integer NOT NULL DEFAULT 0,
          "max_retries" integer NOT NULL DEFAULT 5,
          "timeout" integer NOT NULL DEFAULT 30,
          "description" character varying,
          "user_id" character varying,
          "metadata" json,
          "method" character varying NOT NULL DEFAULT 'POST',
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now()
        )
      `);

      await queryRunner.query(
        `CREATE INDEX "IDX_webhook_subscriptions_name" ON "webhook_subscriptions" ("name")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_webhook_subscriptions_user_id" ON "webhook_subscriptions" ("user_id")`,
      );
    }

    // Tạo bảng webhook_delivery_logs
    if (!(await queryRunner.hasTable('webhook_delivery_logs'))) {
      await queryRunner.query(`
        CREATE TABLE "webhook_delivery_logs" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "webhook_id" character varying NOT NULL,
          "event" character varying NOT NULL,
          "payload" json NOT NULL,
          "attempt" integer NOT NULL DEFAULT 1,
          "status" character varying NOT NULL DEFAULT 'pending',
          "status_code" integer,
          "response" text,
          "error" text,
          "duration" integer,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "completed_at" TIMESTAMP,
          "email_id" character varying
        )
      `);

      await queryRunner.query(
        `CREATE INDEX "IDX_webhook_delivery_logs_webhook_id" ON "webhook_delivery_logs" ("webhook_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_webhook_delivery_logs_email_id" ON "webhook_delivery_logs" ("email_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xóa theo thứ tự ngược lại để tránh lỗi ràng buộc khóa ngoại
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_delivery_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_credentials"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_stats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_templates"`);

    // Xóa các enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "email_events_event_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "email_logs_status_enum"`);
  }
}
