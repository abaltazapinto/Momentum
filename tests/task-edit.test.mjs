import assert from "node:assert/strict"
import test from "node:test"
import { createRecurringTask, currentProgress, recordCompletion } from "../recurrence.js"
import { applyTaskEdit, draftFromTask } from "../task-edit.js"
import { normalizeTask } from "../task-recovery.js"

const meeting = recordCompletion({ ...createRecurringTask({ id: "uas", title: "UAS - reunião semanal", durationMinutes: 45, targetCount: 1, timezone: "Europe/Lisbon" }), completed: false, createdAt: 1 }, { taskId: "uas", eventId: "e1", occurredAt: "2026-11-12T12:30:00Z" })

test("draft reflects the task, with sensible defaults for one-off tasks", () => {
    assert.deepEqual(draftFromTask(meeting), { id: "uas", title: "UAS - reunião semanal", recurring: true, frequency: "weekly", target: "1" })
    assert.deepEqual(draftFromTask({ id: "a", title: "Pão" }), { id: "a", title: "Pão", recurring: false, frequency: "weekly", target: "3" })
})

test("weekly meeting becomes monthly 2x, keeping history, duration, timezone and other fields", () => {
    const edited = applyTaskEdit(meeting, { title: "  UAS - reunião  ", recurring: true, frequency: "monthly", target: "2" }, { now: 99 })
    assert.equal(edited.title, "UAS - reunião")
    assert.deepEqual(edited.recurrence, { frequency: "monthly", targetCount: 2, durationMinutes: 45, timezone: "Europe/Lisbon" })
    assert.equal(edited.completionEvents.length, 1)
    assert.equal(edited.createdAt, 1)
    assert.equal(edited.updatedAt, 99)
    assert.deepEqual(currentProgress(edited, "2026-11-20T12:00:00Z"), { doneCount: 1, targetCount: 2, remaining: 1 })
    assert.ok(normalizeTask("uas", edited), "edited task still loads")
    assert.equal(meeting.recurrence.frequency, "weekly", "original object untouched")
})

test("one-off task can become recurring, and recurring can become one-off", () => {
    const made = applyTaskEdit({ title: "Ler", completed: false }, { title: "Ler", recurring: true, frequency: "yearly", target: "12" })
    assert.deepEqual(made.recurrence, { frequency: "yearly", targetCount: 12, durationMinutes: 30, timezone: "Atlantic/Madeira" })
    assert.deepEqual(made.completionEvents, [])
    const plain = applyTaskEdit(meeting, { title: "UAS", recurring: false, frequency: "weekly", target: "1" })
    assert.equal("recurrence" in plain, false)
    assert.equal(plain.completionEvents.length, 1, "history kept in case it becomes recurring again")
    assert.equal(normalizeTask("uas", plain).recurrence, null)
})

test("invalid edits are rejected with a code the UI can explain", () => {
    assert.throws(() => applyTaskEdit(meeting, { title: "   ", recurring: false }), { code: "empty-title" })
    for (const target of ["", "0", "-1", "2.5", "abc"]) {
        assert.throws(() => applyTaskEdit(meeting, { title: "x", recurring: true, frequency: "weekly", target }), { code: "invalid-target" })
    }
    assert.throws(() => applyTaskEdit(meeting, { title: "x", recurring: true, frequency: "daily", target: "1" }))
})
