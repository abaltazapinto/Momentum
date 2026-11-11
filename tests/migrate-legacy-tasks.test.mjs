import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { prepareMigration } from "../scripts/migrate-legacy-tasks.mjs"

const dir = await mkdtemp(join(tmpdir(), "momentum-migration-"))
const input = join(dir, "backup.json")
const output = join(dir, "users.json")
await writeFile(input, JSON.stringify({ tasks: { old: "  Tarefa antiga ", structured: { title: "Nova", completed: true } } }))
const result = await prepareMigration(input, output, "uid-user-a")
assert.equal(result.count, 2)
assert.deepEqual(JSON.parse(await readFile(output, "utf8")), { old: { title: "Tarefa antiga", completed: false }, structured: { title: "Nova", completed: true } })
assert.equal(JSON.parse(await readFile(input, "utf8")).tasks.old, "  Tarefa antiga ")
await assert.rejects(() => prepareMigration(input, input, "uid-user-a"), /different files/)
await assert.rejects(() => prepareMigration(input, join(dir, "other.json"), "bad\/uid"), /path segment/)
await assert.rejects(() => prepareMigration(join(dir, "missing.json"), join(dir, "missing-out.json"), "uid-user-a"), /ENOENT|no such file/i)
await writeFile(join(dir, "invalid.json"), JSON.stringify({ users: {} }))
await assert.rejects(() => prepareMigration(join(dir, "invalid.json"), join(dir, "invalid-out.json"), "uid-user-a"), /tasks object/)
await assert.rejects(() => prepareMigration(input, output, "uid-user-a"), /overwrite/)
console.log("legacy migration: normalized, validated, non-destructive")
