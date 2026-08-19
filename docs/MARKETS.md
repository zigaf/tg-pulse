# Markets and ad platforms

Why this file exists: our integration backlog should follow where Telegram money actually is, not where
the APIs are easiest. Figures below are third-party estimates (app-analytics based), so treat them as
relative sizing, not as truth. Dated 2026-08.

## Where Telegram is big

| Market | Scale | What it means for us |
|---|---|---|
| India | largest user base by a wide margin | Meta and Google are the paid channels; Telegram Ads now has full features here |
| Russia and CIS | around half the population uses it; Uzbekistan, Kazakhstan, Belarus follow | Yandex is the paid channel, plus channel seeding. Meta is unavailable |
| Indonesia | tens of millions, fast growth | Meta and TikTok |
| Brazil and LATAM | very large combined base, strong growth | Meta first, TikTok second |
| Iran | tens of millions despite the block | no ad platform reaches it, seeding only |
| MENA, Egypt, Saudi | large and growing | Meta, TikTok, Snap |
| Germany, Italy | biggest in Western Europe | Meta and Google |
| United States | modest penetration, high value per user | Meta and Google |

Two clusters, and they need different integrations: **Meta plus TikTok plus Google** covers India, LATAM,
Indonesia, MENA and the West. **Yandex** covers Russia and CIS, where Meta does not operate.

## Ad platforms actually used to grow Telegram channels

1. **Meta (Facebook, Instagram)** — the default outside CIS. Conversions API. Shipped.
2. **Yandex Direct** — the default inside CIS; also sells ads inside Telegram channels through its ad
   network. Optimization is fed through Metrica offline conversions. Shipped.
3. **TikTok** — strong in Indonesia, LATAM, MENA. Events API 2.0 with `ttclid`. Next.
4. **Google Ads** — India, West, Brazil. Offline conversion import with `gclid`; needs a developer token,
   which takes days to approve, so plan the lead time.
5. **Telegram Ads** — sold through resellers and the Yandex network. No conversion API exists, so
   optimization stays manual: our reports tell the buyer which creative to pause. Never promise a postback.
6. **Channel seeding** — the dominant channel in CIS and Iran and unavoidable everywhere. No platform to
   feed; value comes from our fraud detection and buyer comparison instead.
7. **Push and pop networks (RichAds, PropellerAds and similar)** — used for grey verticals that Meta,
   Google and TikTok reject. They accept plain S2S postbacks, which our generic postback module already
   covers.

## Integration order

1. Meta CAPI, Yandex Metrica — done
2. TikTok Events API — same shape as Meta, unlocks Indonesia, LATAM and MENA
3. Google Ads offline conversions — biggest lift, start the developer-token application early
4. VK Ads — only if CIS customers ask; the Telegram growth playbook there runs through Yandex and seeding
