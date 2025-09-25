-- Preprod seed for E2E validation (can be removed later)
INSERT INTO "Offer" (id, userid, name, originalurl, status, created_at)
SELECT 'smoke-offer-demo', 'smoke-user', 'Smoke Offer Seed', 'https://www.wikipedia.org', 'evaluating', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Offer" WHERE id = 'smoke-offer-demo');
