Recommendations Service
Purpose
- Provide discovery/suggestions/risk checks decoupled from adscenter execution to minimize Google Ads API calls.
- First feature: keyword brand-term risk detection without Ads API.

API
- POST /api/v1/recommend/keywords/brand-check
  - body: { seedDomain, keywords[], locale?, landingUrl? }
  - returns: items[{ keyword, containsBrand, matchedAlias?, method(exact|fuzzy|none), score?, severity(error|warn|none) }]
- GET /api/v1/recommend/keywords/brand-profile?seedDomain=...
  - returns: { seedDomain, aliases[], updatedAt }
- GET /api/v1/recommend/keywords/brand-results?seedDomain=...&limit=50&cursor=...&severity=error&containsBrand=true
  - returns: { items: BrandCheckItem[], next: cursor }
- POST /api/v1/recommend/internal/offline/brand-audit
  - body: { seedDomain, accountId?, keywords?, days?, limit?, shard?, totalShards? }
  - if keywords not provided and BQ_ENABLED=1, pulls from BigQuery Export; runs asynchronously and returns 202.

Environment
- DATABASE_URL (optional): enable persistence (brand_profile, keyword_risk_results)
- FIRESTORE_ENABLED=1 + GOOGLE_CLOUD_PROJECT (optional): write UI cache users/{uid}/recommendations/brand-check/{seed}
- BROWSER_EXEC_URL (optional): use /api/v1/browser/page-signals for landing signals (title/og:site_name)
- BROWSER_INTERNAL_TOKEN (optional): bearer token for browser-exec
- BQ_ENABLED=1 (optional) together with:
  - BQ_PROJECT_ID, BQ_DATASET, BQ_TABLE (export table)
  - BQ_KEYWORD_COL (default: keyword_text)

Deployment
- Build image: docker build -f services/recommendations/Dockerfile .
- Cloud Run service name: recommendations (expected by gateway render script)
- Gateway v2 routes include /api/v1/recommend/*; deploy-gateway workflow discovers its URL automatically.

Scheduler (offline audit)
- Single job: deployments/scripts/create-reco-scheduler.sh
- Sharded jobs: deployments/scripts/create-reco-scheduler-sharded.sh (TOTAL_SHARDS=N)

