import assert from "node:assert/strict"
import test from "node:test"
import { createRecurringTask, getWeekStartForInstant, recordCompletion, weeklyProgress } from "../recurrence.js"

for (const instant of ["2026-03-30T00:30:00+01:00", "2026-07-13T00:30:00+01:00"]) {
    test(`${instant} belongs to the preceding local week`, () => {
        const weekStart = getWeekStartForInstant(instant, "Europe/Lisbon")
        assert.equal(weekStart, instant.startsWith("2026-03-30") ? "2026-03-29T23:00:00.000Z" : "2026-07-12T23:00:00.000Z")
    })
}

test("Europe/Lisbon week boundary follows DST start", () => {
    const task = createRecurringTask({ id: "dst", title: "DST", durationMinutes: 30, targetCount: 2, timezone: "Europe/Lisbon" })
    const withSession = recordCompletion(task, { taskId: "dst", eventId: "after", occurredAt: "2026-03-29T22:30:00Z" })
    assert.equal(weeklyProgress(withSession, "2026-03-23T00:00:00.000Z").doneCount, 1)
})

test("Europe/Lisbon week boundary follows DST end", () => {
    const task = createRecurringTask({ id: "dst", title: "DST", durationMinutes: 30, targetCount: 2, timezone: "Europe/Lisbon" })
    const withSession = recordCompletion(task, { taskId: "dst", eventId: "after", occurredAt: "2026-10-31T23:30:00Z" })
    assert.equal(weeklyProgress(withSession, "2026-10-26T00:00:00.000Z").doneCount, 1)
})
