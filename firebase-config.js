export function firebaseSettingsFromEnv(env = {}) {
    const fields = {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        databaseURL: env.VITE_FIREBASE_DATABASE_URL
    }
    if (Object.values(fields).some(value => typeof value !== "string" || !value.trim())) return null
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim()]))
}

// Validate the API key's actual project before creating a session or submitting credentials.
export async function verifyFirebaseProject(settings, fetcher = fetch) {
    const response = await fetcher(`https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(settings.apiKey)}`, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw Object.assign(new Error("Firebase authentication configuration unavailable"), { code: "auth/configuration-not-found" })
    const config = await response.json()
    if (!config.authorizedDomains?.includes(`${settings.projectId}.firebaseapp.com`)) {
        throw Object.assign(new Error("Firebase API key belongs to a different project"), { code: "auth/project-mismatch" })
    }
}
