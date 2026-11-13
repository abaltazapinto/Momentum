import assert from "node:assert/strict"
import test from "node:test"
import { firebaseSettingsFromEnv, verifyFirebaseProject } from "../firebase-config.js"

test("cloud authentication requires the complete Web app config; no borrowed key fallback", () => {
    assert.equal(firebaseSettingsFromEnv(), null)
    assert.equal(firebaseSettingsFromEnv({ VITE_FIREBASE_API_KEY: "only-a-key" }), null)
    assert.equal(firebaseSettingsFromEnv({ VITE_FIREBASE_API_KEY: " ", VITE_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com", VITE_FIREBASE_PROJECT_ID: "example", VITE_FIREBASE_DATABASE_URL: "https://example-default-rtdb.firebaseio.com" }), null)
})

test("regression: shopping-list key cannot authenticate against the compras database", async () => {
    const settings = { apiKey: "public-test-key", projectId: "compras-e2b70" }
    await assert.rejects(verifyFirebaseProject(settings, async () => ({ ok: true, json: async () => ({ authorizedDomains: ["localhost", "shopping-list-d3a29.firebaseapp.com"] }) })), { code: "auth/project-mismatch" })
    await verifyFirebaseProject(settings, async () => ({ ok: true, json: async () => ({ authorizedDomains: ["localhost", "compras-e2b70.firebaseapp.com"] }) }))
    await assert.rejects(verifyFirebaseProject(settings, async () => ({ ok: false, status: 400 })), { code: "auth/configuration-not-found" })
})
