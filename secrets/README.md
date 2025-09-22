This folder is intentionally ignored by Git (.gitignore) to prevent committing real credentials.

Place local-only credentials here for development, for example:

- firebase-adminsdk.json (Firebase Admin service account key)
- gcp_sa.json (GCP service account key for Secret Manager / Cloud SQL / Pub/Sub in local dev)

Environment variables (recommended):

- FIREBASE_CREDENTIALS_FILE=secrets/firebase-adminsdk.json
- GOOGLE_APPLICATION_CREDENTIALS=secrets/gcp_sa.json
- DATABASE_URL_SECRET_NAME=projects/<PROJECT_ID>/secrets/DATABASE_URL/versions/latest

Security notes:

- Do NOT commit any files inside this folder except this README.md.
- Rotate keys immediately if they were ever exposed or committed.
- In production (Cloud Run), prefer Workload Identity (ADC) instead of JSON keys.

