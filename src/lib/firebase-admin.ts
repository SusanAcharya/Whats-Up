import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export function adminReady() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

export function getAdminDb(): Firestore {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
    }
    initializeApp({
      credential: cert(JSON.parse(raw) as Record<string, string>),
    });
  }
  return getFirestore(getApps()[0]!);
}

export function millis(value: unknown): number {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}
