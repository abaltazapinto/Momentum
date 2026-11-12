import { access, readFile, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

export function normalizeLegacyTask(id, value) {
    if (!id || !value) return null
    if (typeof value === "string") return value.trim() ? { title: value.trim(), completed: false } : null
    if (typeof value !== "object" || Array.isArray(value) || typeof value.title !== "string" || !value.title.trim()) return null
    return { ...value, title: value.title.trim(), completed: value.completed === true }
}

export function validateUid(uid) {
    if (!/^[A-Za-z0-9._:-]+$/.test(uid)) throw new Error("UID must be one Firebase path segment")
}

export async function prepareMigration(inputPath, outputPath, uid) {
    validateUid(uid)
    const input = resolve(inputPath)
    const output = resolve(outputPath)
    if (input === output) throw new Error("Input and output must be different files")
    await access(input)
    if (!(await stat(input)).isFile()) throw new Error("Input must be a regular backup file")
    const backup = JSON.parse(await readFile(input, "utf8"))
    if (!backup || typeof backup !== "object" || Array.isArray(backup) || !Object.hasOwn(backup, "tasks") || !backup.tasks || typeof backup.tasks !== "object" || Array.isArray(backup.tasks)) throw new Error("Backup must contain a tasks object")
    const tasks = {}
    for (const [id, value] of Object.entries(backup.tasks)) { const task = normalizeLegacyTask(id, value); if (!task) throw new Error(`Invalid legacy task: ${id}`); tasks[id] = task }
    const serialized = `${JSON.stringify(tasks, null, 2)}\n`
    try {
        const existing = await readFile(output, "utf8")
        if (existing !== serialized) throw new Error("Refusing to overwrite an existing output or backup")
        return { count: Object.keys(tasks).length, input, output, destination: `users/${uid}/tasks`, reused: true }
    } catch (error) {
        if (error.code !== "ENOENT") throw error
    }
    await writeFile(output, serialized, { encoding: "utf8", flag: "wx" })
    return { count: Object.keys(tasks).length, input, output, destination: `users/${uid}/tasks`, reused: false }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const [inputPath, outputPath, uid] = process.argv.slice(2)
    if (!inputPath || !outputPath || !uid) { console.error("Usage: node scripts/migrate-legacy-tasks.mjs backup.json output.json uid"); process.exit(1) }
    const result = await prepareMigration(inputPath, outputPath, uid)
    console.log(`Prepared ${result.count} normalized tasks for review; no Firebase write was performed.`)
}
