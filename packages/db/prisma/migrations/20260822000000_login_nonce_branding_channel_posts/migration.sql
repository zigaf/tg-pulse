-- Telegram Login replay protection, workspace white-label branding, content module.
-- Statements extracted verbatim from `prisma migrate diff` against the current schema.

-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'ANIMATION', 'DOCUMENT', 'AUDIO', 'VOICE', 'STICKER', 'POLL', 'OTHER');

-- CreateTable
CREATE TABLE "login_nonces" (
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_nonces_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "login_nonces_created_at_idx" ON "login_nonces"("created_at");

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "brand_name" TEXT,
ADD COLUMN "brand_url" TEXT;

-- CreateTable
CREATE TABLE "channel_posts" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "message_id" INTEGER NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "edited_at" TIMESTAMP(3),
    "kind" "PostKind" NOT NULL,
    "preview" TEXT NOT NULL DEFAULT '',
    "reactions" JSONB,
    "reactions_total" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_posts_channel_id_posted_at_idx" ON "channel_posts"("channel_id", "posted_at");

-- CreateIndex
CREATE UNIQUE INDEX "channel_posts_channel_id_message_id_key" ON "channel_posts"("channel_id", "message_id");

-- AddForeignKey
ALTER TABLE "channel_posts" ADD CONSTRAINT "channel_posts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
