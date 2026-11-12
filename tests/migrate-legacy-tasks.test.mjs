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
assert.equal(result.reused, false)
assert.deepEqual(JSON.parse(await readFile(output, "utf8")), { old: { title: "Tarefa antiga", completed: false }, structured: { title: "Nova", completed: true } })
assert.equal(JSON.parse(await readFile(input, "utf8")).tasks.old, "  Tarefa antiga ")
assert.equal((await prepareMigration(input, output, "uid-user-a")).reused, true)
await writeFile(input, JSON.stringify({ tasks: { old: { title: "Alterada", customField: "preservar" } } }))
await assert.rejects(() => prepareMigration(input, output, "uid-user-a"), /overwrite/)
await writeFile(input, JSON.stringify({ tasks: { old: "  Tarefa antiga ", structured: { title: "Nova", completed: true } } }))
await assert.rejects(() => prepareMigration(input, input, "uid-user-a"), /different files/)
await assert.rejects(() => prepareMigration(input, join(dir, "other.json"), "bad\/uid"), /path segment/)
await assert.rejects(() => prepareMigration(join(dir, "missing.json"), join(dir, "missing-out.json"), "uid-user-a"), /ENOENT|no such file/i)
await writeFile(join(dir, "invalid.json"), JSON.stringify({ users: {} }))
await assert.rejects(() => prepareMigration(join(dir, "invalid.json"), join(dir, "invalid-out.json"), "uid-user-a"), /tasks object/)
console.log("legacy migration: normalized, validated, non-destructive")
