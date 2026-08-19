# Feeding conversions back to ad platforms

Goal: an ad platform optimizes toward *subscribers*, not clicks. That only happens if the platform
receives a conversion tied to its own click id. Capturing `yclid`/`gclid`/`fbclid`/`ttclid` (already done)
is half the job; this document covers the other half, the actual upload.

## What each platform requires

| Platform | Channel | Identifier | Notes |
|---|---|---|---|
| Meta | Conversions API, `POST /v{ver}/{pixel_id}/events` | `fbc` built as `fb.1.<click_ts_ms>.<fbclid>`, sent in `user_data` in plain text | Offline Conversions API was retired in 2025, CRM events go through CAPI. `event_id` must be stable for dedup. |
| Yandex | Metrica offline conversions, `POST /management/v1/counter/{id}/offline_conversions/upload` | `yclid` | CSV upload, OAuth token, "offline conversions" must be enabled on the counter. Goal name must match the Metrica goal exactly. Direct then optimizes on that goal. Processing takes up to 2 hours. |
| Google Ads | `ConversionUploadService.UploadClickConversions` | `gclid` | Needs a developer token, OAuth refresh token and customer id. Do not set `user_identifiers` alongside a gclid, that switches the call to enhanced conversions for leads. Default gclid window is 30 days. |
| TikTok | Events API 2.0 | `ttclid` | Same shape as Meta, lower priority. |
| Telegram Ads | none | none | There is no public conversion API. Optimization stays manual: our own reports show which creative to pause. Never claim otherwise. |

Build order: Meta and Yandex first (self-serve credentials, immediate value), Google Ads next
(developer token approval takes days), TikTok last.

## Architecture

1. An attributed join is written by the bot as today.
2. In the same handler, one `ConversionUpload` row is created per active integration of the channel,
   status `PENDING`, with a stable `eventKey` (`<subscriberId>:<integrationId>`) used as the platform
   dedup key, plus the click id and the click timestamp captured from the matching `Click`.
3. A worker drains the outbox: Meta every minute in batches of up to 500 events, Yandex every 15 minutes
   as a CSV upload (Metrica needs up to 2 hours anyway), Google Ads every 15 minutes.
4. Success marks rows `SENT`. Failures increment `attempts` with exponential backoff and stop at 6
   attempts with `FAILED`, surfacing `lastError` on the integration so the dashboard can show it.

The outbox exists because a platform outage must never silently lose a conversion: without it, a failed
upload is a subscriber the algorithm never learns from.

## Credentials

Encrypted at rest with AES-256-GCM using `ENCRYPTION_KEY` (32 random bytes, hex). Format:
`v1:<iv-base64>:<tag-base64>:<ciphertext-base64>`. The API never returns credentials, only a masked hint
(`token ending in 4f2a`) and connection status. Rotating `ENCRYPTION_KEY` invalidates stored credentials
by design, the user reconnects.

## Plan gating

Native integrations are a Pro feature (`features.postbacks` covers the whole conversion layer).
Free plans keep generic URL postbacks only.

## What the user must do

- **Meta**: create a system user token with `ads_management`, take the pixel (dataset) id.
- **Yandex**: OAuth token for Metrica, counter id, enable offline conversions on the counter, create a
  goal and paste its exact name.
- **Google Ads**: OAuth refresh token, developer token, customer id, conversion action id.

Each connection has a "Test" action that performs a real dry-run call and reports what the platform said.
