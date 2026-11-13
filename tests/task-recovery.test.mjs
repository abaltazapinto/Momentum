import assert from "node:assert/strict"
import test from "node:test"
import { normalizeTask, parseTaskBackup, preserveBrowserRecovery, readBrowserRecovery } from "../task-recovery.js"

test("legacy recovery preserves IDs, completion, timestamps and recurring history", () => {
    const backup = { tasks: { old: " Tarefa antiga ", recurring: { title: "Estudar", completed: true, createdAt: 12, notes: "keep", recurrence: { frequency: "weekly", targetCount: 3, durationMinutes: 30, timezone: "Atlantic/Madeira" }, completionEvents: [{ id: "session-1", occurredAt: "2026-11-13T12:00:00Z" }] } } }
    const tasks = parseTaskBackup(backup)
    assert.equal(tasks[0].id, "old")
    assert.equal(tasks[0].title, "Tarefa antiga")
    assert.equal(tasks[1].completed, true)
    assert.equal(tasks[1].createdAt, 12)
    assert.equal(tasks[1].notes, "keep")
    assert.deepEqual(tasks[1].completionEvents, backup.tasks.recurring.completionEvents)
    assert.equal(backup.tasks.old, " Tarefa antiga ")
})

test("malformed backups fail before any import, including unsafe IDs and invalid recurrence", () => {
    assert.throws(() => parseTaskBackup({ tasks: { good: "Valid", bad: " " } }))
    assert.throws(() => parseTaskBackup({ tasks: { "../other-user": "Invalid" } }))
    assert.throws(() => parseTaskBackup(JSON.parse('{"tasks":{"__proto__":{"title":"Invalid"}}}')))
    assert.equal(normalizeTask("r", { title: "Bad recurrence", recurrence: { frequency: "weekly", targetCount: 2, durationMinutes: 30, timezone: "invalid" } }), null)
    assert.equal(normalizeTask("r", { title: "Bad event", completionEvents: [null] }), null)
})

test("preserving an old guest session never overwrites a browser backup", () => {
    let raw = null
    const storage = { getItem: () => raw, setItem: (_, value) => { raw = value } }
    preserveBrowserRecovery(storage, [{ id: "old", title: "Keep my edit", completed: true }])
    preserveBrowserRecovery(storage, [{ id: "old", title: "Original" }, { id: "new", title: "New task" }])
    const tasks = readBrowserRecovery(storage)
    assert.equal(tasks.length, 2)
    assert.equal(tasks[0].title, "Keep my edit")
    assert.equal(tasks[0].completed, true)
    raw = "{broken"
    assert.throws(() => preserveBrowserRecovery(storage, [{ id: "new", title: "Do not overwrite" }]))
    assert.equal(raw, "{broken")
})
