import { readFile, writeFile } from "node:fs/promises"

const [inputPath, outputPath, uid] = process.argv.slice(2)
if (!inputPath || !outputPath || !uid) {
    console.error("Usage: node scripts/migrate-legacy-tasks.mjs backup.json output.json uid")
    process.exit(1)
}

const backup = JSON.parse(await readFile(inputPath, "utf8"))
const legacy = backup.tasks ?? backup
if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) throw new Error("Backup must contain an object at tasks or root")
const tasks = Object.fromEntries(Object.entries(legacy).map(([id, task]) => [id, task]))
const output = { generatedAt: new Date().toISOString(), source: "/tasks", destination: `users/${uid}/tasks`, tasks }
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8")
console.log(`Prepared ${Object.keys(tasks).length} tasks for review; no Firebase write was performed.`)
