import assert from "node:assert/strict"
import test from "node:test"
import { createRecurringTask, currentProgress, getPeriodStartForInstant, periodProgress, PERIOD_LABELS, recordCompletion, suggestReplan } from "../recurrence.js"
import { normalizeTask } from "../task-recovery.js"

const tz = "Atlantic/Madeira"
const withSessions = (task, ...instants) => instants.reduce((current, occurredAt, index) => recordCompletion(current, { taskId: task.id, eventId: `e${index}`, occurredAt }), task)

test("months start on the 1st at local midnight, also in summer time", () => {
    assert.equal(getPeriodStartForInstant("2026-11-13T12:00:00Z", tz, "monthly"), "2026-11-01T00:00:00.000Z")
    assert.equal(getPeriodStartForInstant("2026-07-15T12:00:00Z", tz, "monthly"), "2026-06-30T23:00:00.000Z")
    // 1 July 00:30 local (summer time) is still July, not June.
    assert.equal(getPeriodStartForInstant("2026-06-30T23:30:00Z", tz, "monthly"), "2026-06-30T23:00:00.000Z")
})

test("years start on 1 January at local midnight", () => {
    assert.equal(getPeriodStartForInstant("2026-11-13T12:00:00Z", tz, "yearly"), "2026-01-01T00:00:00.000Z")
    assert.equal(getPeriodStartForInstant("2027-01-01T00:00:00Z", tz, "yearly"), "2027-01-01T00:00:00.000Z")
})

test("monthly progress resets when the month changes", () => {
    const task = withSessions(createRecurringTask({ id: "m", title: "Pagar renda", durationMinutes: 30, targetCount: 2, timezone: tz, frequency: "monthly" }), "2026-11-02T10:00:00Z", "2026-11-30T23:59:00Z")
    assert.deepEqual(currentProgress(task, "2026-11-30T23:59:30Z"), { doneCount: 2, targetCount: 2, remaining: 0 })
    assert.deepEqual(currentProgress(task, "2026-12-01T00:00:00Z"), { doneCount: 0, targetCount: 2, remaining: 2 })
    assert.equal(task.completionEvents.length, 2, "history is kept")
})

test("yearly progress resets on 1 January and keeps history", () => {
    const task = withSessions(createRecurringTask({ id: "y", title: "Revisão do carro", durationMinutes: 30, targetCount: 1, timezone: tz, frequency: "yearly" }), "2026-12-31T23:59:00Z")
    assert.equal(currentProgress(task, "2026-12-31T23:59:30Z").doneCount, 1)
    assert.equal(currentProgress(task, "2027-01-01T00:00:00Z").doneCount, 0)
    assert.equal(periodProgress(task, "2026-01-01T00:00:00.000Z").doneCount, 1)
})

test("weekly tasks keep working exactly as before", () => {
    const task = withSessions(createRecurringTask({ id: "w", title: "LeetCode", durationMinutes: 30, targetCount: 3, timezone: tz }), "2026-11-12T19:30:00Z")
    assert.equal(task.recurrence.frequency, "weekly")
    assert.equal(currentProgress(task, "2026-11-15T23:59:00Z").doneCount, 1)
    assert.equal(currentProgress(task, "2026-11-16T00:00:00Z").doneCount, 0)
})

test("labels, replan message, validation and import support every frequency", () => {
    assert.deepEqual(PERIOD_LABELS, { weekly: "esta semana", monthly: "este mês", yearly: "este ano" })
    const monthly = createRecurringTask({ id: "m", title: "Ler", durationMinutes: 30, targetCount: 2, timezone: tz, frequency: "monthly" })
    assert.match(suggestReplan(monthly, "2026-11-01T00:00:00.000Z").message, /este mês/)
    assert.throws(() => createRecurringTask({ id: "d", title: "x", durationMinutes: 30, targetCount: 1, frequency: "daily" }))
    for (const frequency of ["weekly", "monthly", "yearly"]) {
        assert.equal(normalizeTask("t", { title: "x", recurrence: { frequency, targetCount: 1, durationMinutes: 30, timezone: tz } }).recurrence.frequency, frequency)
    }
})
