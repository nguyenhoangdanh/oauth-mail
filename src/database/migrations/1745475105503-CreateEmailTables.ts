import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailTables1745475105503 implements MigrationInterface {
  name = 'CreateEmailTables1745475105503';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "webhook_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "event" character varying NOT NULL, "endpoint" character varying NOT NULL, "secret" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "failedAttempts" integer NOT NULL DEFAULT '0', "lastFailure" TIMESTAMP, "lastSuccess" TIMESTAMP, "headers" json NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bf631ae77d39849d599817fb6f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2687b16e46419c17d3e3ebac73" ON "webhook_subscriptions" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "email_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "content" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "format" character varying NOT NULL DEFAULT 'html', "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e832fef7d0d7dd4da2792eddbf7" UNIQUE ("name"), CONSTRAINT "PK_06c564c515d8cdb40b6f3bfbbb4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "email_stats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL, "sent" integer NOT NULL DEFAULT '0', "delivered" integer NOT NULL DEFAULT '0', "opened" integer NOT NULL DEFAULT '0', "clicked" integer NOT NULL DEFAULT '0', "bounced" integer NOT NULL DEFAULT '0', "complained" integer NOT NULL DEFAULT '0', "failed" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_70da4b2befab60b7e7158faf0f7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "email_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "emailId" character varying NOT NULL, "to" character varying NOT NULL, "name" character varying, "subject" character varying NOT NULL, "template" character varying NOT NULL, "context" json NOT NULL DEFAULT '{}', "status" character varying NOT NULL DEFAULT 'pending', "messageId" character varying, "attempts" integer NOT NULL DEFAULT '0', "error" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "sentAt" TIMESTAMP, "lastStatusAt" TIMESTAMP, "openedAt" TIMESTAMP, "clickedAt" TIMESTAMP, "clickUrl" character varying, "bounceReason" character varying, "openCount" integer NOT NULL DEFAULT '0', "clickCount" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_999382218924e953a790d340571" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e7b3d9cda62d303307570ef2b" ON "email_logs" ("emailId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "email_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "emailId" character varying NOT NULL, "event" character varying NOT NULL, "recipient" character varying, "timestamp" TIMESTAMP NOT NULL, "metadata" json NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2ab38c98c3ca9385eff428134c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6f0b88890ddec99bd5bc032476" ON "email_events" ("emailId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6f0b88890ddec99bd5bc032476"`,
    );
    await queryRunner.query(`DROP TABLE "email_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2e7b3d9cda62d303307570ef2b"`,
    );
    await queryRunner.query(`DROP TABLE "email_logs"`);
    await queryRunner.query(`DROP TABLE "email_stats"`);
    await queryRunner.query(`DROP TABLE "email_templates"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2687b16e46419c17d3e3ebac73"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_subscriptions"`);
  }
}
