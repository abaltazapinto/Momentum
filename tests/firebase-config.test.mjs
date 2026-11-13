import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { firebaseSettingsFromEnv, verifyFirebaseProject } from "../firebase-config.js"

const committedEnv = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")
    .filter(line => /^\s*VITE_[A-Z_]+=/.test(line)).map(line => line.split("=").map(part => part.trim())).map(([key, ...value]) => [key, value.join("=")]))

test("a complete config is accepted and trimmed", () => {
    assert.deepEqual(firebaseSettingsFromEnv({ VITE_FIREBASE_API_KEY: " key ", VITE_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com", VITE_FIREBASE_PROJECT_ID: "example", VITE_FIREBASE_DATABASE_URL: "https://example-default-rtdb.firebaseio.com" }),
        { apiKey: "key", authDomain: "example.firebaseapp.com", projectId: "example", databaseURL: "https://example-default-rtdb.firebaseio.com" })
})

test("the committed app config points auth and database at the same compras-e2b70 project", () => {
    const settings = firebaseSettingsFromEnv(committedEnv)
    assert.ok(settings, "the committed .env must contain a complete Web app config")
    assert.equal(settings.projectId, "compras-e2b70")
    assert.equal(settings.authDomain, `${settings.projectId}.firebaseapp.com`)
    assert.ok(new URL(settings.databaseURL).hostname.startsWith(`${settings.projectId}-default-rtdb.`))
})

test("verification checks the configured API key, not some other key", async () => {
    const settings = firebaseSettingsFromEnv(committedEnv)
    let requested = null
    await verifyFirebaseProject(settings, async url => { requested = new URL(url); return { ok: true, json: async () => ({ authorizedDomains: [`${settings.projectId}.firebaseapp.com`] }) } })
    assert.equal(requested.searchParams.get("key"), settings.apiKey)
})

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
