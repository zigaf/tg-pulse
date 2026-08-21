-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'AGENCY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('TELEGRAM_STARS', 'LEMON_SQUEEZY');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "PixelEventType" AS ENUM ('PAGEVIEW', 'CLICK');

-- CreateEnum
CREATE TYPE "AdProvider" AS ENUM ('META_CAPI', 'YANDEX_METRIKA', 'GOOGLE_ADS', 'TIKTOK_EVENTS');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SaleKind" AS ENUM ('LEAD', 'PURCHASE', 'REFUND');

-- CreateEnum
CREATE TYPE "Attribution" AS ENUM ('EXACT', 'PROBABLE', 'ORGANIC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('JOIN', 'LEAVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tg_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "photo_url" TEXT,
    "language_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" "PaymentProvider" NOT NULL,
    "provider_ref" TEXT,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_payment_id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "period_days" INTEGER NOT NULL,
    "payer_tg_id" BIGINT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("user_id","workspace_id")
);

-- CreateTable
CREATE TABLE "workspace_invites" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'VIEWER',
    "created_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "accepted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "window_days" INTEGER NOT NULL DEFAULT 30,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "tg_chat_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "username" TEXT,
    "workspace_id" TEXT NOT NULL,
    "bot_status" "BotStatus" NOT NULL DEFAULT 'PENDING',
    "member_count" INTEGER,
    "member_count_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_links" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "creative" TEXT,
    "buyer" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "target_post_url" TEXT,
    "invite_link" TEXT,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clicks" (
    "id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,
    "ua_hash" TEXT,
    "referer" TEXT,
    "client_id" TEXT,
    "ad_click_ids" JSONB,
    "landing_url" TEXT,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pixel_events" (
    "id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" "PixelEventType" NOT NULL,
    "url" TEXT,
    "referer" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "ad_click_ids" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pixel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_integrations" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "provider" "AdProvider" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "credentials" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "send_joins" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_status" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_uploads" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "click_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postbacks" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url_template" TEXT NOT NULL,
    "on_join" BOOLEAN NOT NULL DEFAULT true,
    "on_leave" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_status" INTEGER,
    "last_error" TEXT,
    "last_fired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_events" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "tg_user_id" BIGINT,
    "username" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "kind" "SaleKind" NOT NULL DEFAULT 'PURCHASE',
    "external_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "link_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_api_keys" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "channel_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_subscriptions" (
    "channel_id" TEXT NOT NULL,
    "tg_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_subscriptions_pkey" PRIMARY KEY ("channel_id","tg_user_id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "tg_user_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "link_id" TEXT,
    "attribution" "Attribution" NOT NULL DEFAULT 'UNKNOWN',
    "joined_at" TIMESTAMP(3) NOT NULL,
    "left_at" TIMESTAMP(3),
    "rejoin_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_events" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "tg_user_id" BIGINT NOT NULL,
    "type" "EventType" NOT NULL,
    "link_id" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_tg_id_key" ON "users"("tg_id");

-- CreateIndex
CREATE INDEX "subscriptions_workspace_id_status_idx" ON "subscriptions"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_payment_id_key" ON "payment_events"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payment_events_workspace_id_created_at_idx" ON "payment_events"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invites_token_key" ON "workspace_invites"("token");

-- CreateIndex
CREATE INDEX "workspace_invites_workspace_id_idx" ON "workspace_invites"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_channel_id_idx" ON "share_links"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "channels_tg_chat_id_key" ON "channels"("tg_chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_links_slug_key" ON "tracked_links"("slug");

-- CreateIndex
CREATE INDEX "tracked_links_channel_id_idx" ON "tracked_links"("channel_id");

-- CreateIndex
CREATE INDEX "clicks_link_id_ts_idx" ON "clicks"("link_id", "ts");

-- CreateIndex
CREATE INDEX "clicks_link_id_client_id_idx" ON "clicks"("link_id", "client_id");

-- CreateIndex
CREATE INDEX "pixel_events_link_id_ts_idx" ON "pixel_events"("link_id", "ts");

-- CreateIndex
CREATE INDEX "pixel_events_link_id_client_id_idx" ON "pixel_events"("link_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_integrations_channel_id_provider_key" ON "ad_integrations"("channel_id", "provider");

-- CreateIndex
CREATE INDEX "conversion_uploads_status_created_at_idx" ON "conversion_uploads"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_uploads_integration_id_event_key_key" ON "conversion_uploads"("integration_id", "event_key");

-- CreateIndex
CREATE INDEX "postbacks_channel_id_idx" ON "postbacks"("channel_id");

-- CreateIndex
CREATE INDEX "sale_events_channel_id_occurred_at_idx" ON "sale_events"("channel_id", "occurred_at");

-- CreateIndex
CREATE INDEX "sale_events_link_id_idx" ON "sale_events"("link_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_events_channel_id_external_id_key" ON "sale_events"("channel_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_api_keys_key_hash_key" ON "channel_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "channel_api_keys_channel_id_idx" ON "channel_api_keys"("channel_id");

-- CreateIndex
CREATE INDEX "subscribers_channel_id_joined_at_idx" ON "subscribers"("channel_id", "joined_at");

-- CreateIndex
CREATE INDEX "subscribers_link_id_idx" ON "subscribers"("link_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_channel_id_tg_user_id_key" ON "subscribers"("channel_id", "tg_user_id");

-- CreateIndex
CREATE INDEX "member_events_channel_id_ts_idx" ON "member_events"("channel_id", "ts");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_links" ADD CONSTRAINT "tracked_links_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "tracked_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixel_events" ADD CONSTRAINT "pixel_events_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "tracked_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_integrations" ADD CONSTRAINT "ad_integrations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_uploads" ADD CONSTRAINT "conversion_uploads_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "ad_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postbacks" ADD CONSTRAINT "postbacks_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_events" ADD CONSTRAINT "sale_events_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_api_keys" ADD CONSTRAINT "channel_api_keys_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_subscriptions" ADD CONSTRAINT "alert_subscriptions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "tracked_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_events" ADD CONSTRAINT "member_events_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_events" ADD CONSTRAINT "member_events_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "tracked_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

