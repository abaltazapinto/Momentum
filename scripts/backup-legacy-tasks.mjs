import { execFile } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { promisify } from "node:util"
import { normalizeLegacyTask } from "./migrate-legacy-tasks.mjs"

// Read-only backup of the original Momentum list. Never writes to Firebase.
// The database rules deny unauthenticated reads of /tasks, so this reads with the
// project admin's Firebase CLI login (run `npx firebase login` first).
const project = process.env.MOMENTUM_FIREBASE_PROJECT || "compras-e2b70"
const source = `firebase database:get /tasks --project ${project}`
let stdout
try {
    ({ stdout } = await promisify(execFile)(resolve("node_modules/.bin/firebase"), ["database:get", "/tasks", "--project", project], { timeout: 60000, maxBuffer: 20 * 1024 * 1024 }))
} catch (error) {
    throw new Error(`Legacy read failed (${error.stderr?.trim() || error.message}); no backup written. Run \`npx firebase login\` with the project owner account.`)
}
const tasks = JSON.parse(stdout)
// A denied or empty read must never be treated as an empty source.
if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) throw new Error("No legacy task list found")
for (const [id, value] of Object.entries(tasks)) {
    if (!normalizeLegacyTask(id, value)) throw new Error("Invalid legacy record; original data left untouched")
}
const directory = resolve("recovery")
await mkdir(directory, { recursive: true, mode: 0o700 })
const output = resolve(directory, `momentum-tasks-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
await writeFile(output, JSON.stringify({ source, exportedAt: new Date().toISOString(), tasks }, null, 2) + "\n", { flag: "wx", mode: 0o600 })
console.log(JSON.stringify({ count: Object.keys(tasks).length, backup: output, remoteWrites: 0 }))
