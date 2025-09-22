import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Firebase Web 配置（公有，不属于敏感环境变量）
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function ensureApp() {
  if (!getApps().length) {
    return initializeApp(config)
  }
  return getApp()
}

export function getDb() {
  const app = ensureApp()
  const dbId = process.env.NEXT_PUBLIC_FIRESTORE_DB_ID
  return getFirestore(app, dbId)
}
