import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { normalizeLegacyTask } from "./migrate-legacy-tasks.mjs"

// Read-only recovery of the original Momentum list. Never writes to Firebase.
const source = "https://compras-e2b70-default-rtdb.europe-west1.firebasedatabase.app/tasks.json"
const response = await fetch(source, { signal: AbortSignal.timeout(15000) })
if (!response.ok) throw new Error(`Legacy read failed (${response.status}); no backup written`)
const tasks = await response.json()
if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) throw new Error("No legacy task list found")
for (const [id, value] of Object.entries(tasks)) {
    if (!normalizeLegacyTask(id, value)) throw new Error("Invalid legacy record; original data left untouched")
}
const directory = resolve("recovery")
await mkdir(directory, { recursive: true, mode: 0o700 })
const output = resolve(directory, `momentum-tasks-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
await writeFile(output, JSON.stringify({ source, exportedAt: new Date().toISOString(), tasks }, null, 2) + "\n", { flag: "wx", mode: 0o600 })
console.log(JSON.stringify({ count: Object.keys(tasks).length, backup: output, remoteWrites: 0 }))
