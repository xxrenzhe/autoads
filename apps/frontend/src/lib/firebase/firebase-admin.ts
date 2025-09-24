// Lightweight stub for Firestore Admin on Next server runtime.
// In production, this frontend should not directly mutate Firestore; use backend APIs instead.

type DocRef = {
  get: () => Promise<{ exists: boolean; data: () => any | null }>;
  set: (data: any, opts?: { merge?: boolean }) => Promise<void>;
};

type ColRef = {
  doc: (id: string) => DocRef;
};

export const firestore: { collection: (name: string) => ColRef } = {
  collection: (_name: string) => ({
    doc: (_id: string) => ({
      async get() {
        return { exists: false, data: () => null };
      },
      async set(_data: any, _opts?: { merge?: boolean }) {
        // no-op
      },
    }),
  }),
};

