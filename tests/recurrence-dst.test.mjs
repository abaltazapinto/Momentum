import assert from "node:assert/strict"
import test from "node:test"
import { createRecurringTask, recordCompletion, weeklyProgress } from "../recurrence.js"

test("Europe/Lisbon week boundary follows DST start", () => {
    const task = createRecurringTask({ id: "dst", title: "DST", durationMinutes: 30, targetCount: 2, timezone: "Europe/Lisbon" })
    const withSession = recordCompletion(task, { eventId: "after", occurredAt: "2026-03-29T22:30:00Z" })
    assert.equal(weeklyProgress(withSession, "2026-03-23T00:00:00.000Z").doneCount, 1)
})

test("Europe/Lisbon week boundary follows DST end", () => {
    const task = createRecurringTask({ id: "dst", title: "DST", durationMinutes: 30, targetCount: 2, timezone: "Europe/Lisbon" })
    const withSession = recordCompletion(task, { eventId: "after", occurredAt: "2026-10-31T23:30:00Z" })
    assert.equal(weeklyProgress(withSession, "2026-10-26T00:00:00.000Z").doneCount, 1)
})
