import assert from "node:assert/strict"
import { createRecurringTask, recordCompletion, weeklyProgress, suggestReplan } from "./recurrence.js"

const task = createRecurringTask({ id: "leetcode", title: "LeetCode", durationMinutes: 30, targetCount: 3, timezone: "Atlantic/Madeira" })
const week = "2026-11-09T00:00:00Z"
const afterFirst = recordCompletion(task, { eventId: "session-1", occurredAt: "2026-11-10T18:00:00Z" })
const duplicate = recordCompletion(afterFirst, { eventId: "session-1", occurredAt: "2026-11-10T18:00:00Z" })
assert.deepEqual(weeklyProgress(duplicate, week), { doneCount: 1, targetCount: 3, remaining: 2 })
assert.match(suggestReplan(duplicate, week).message, /2 sessão/) 
const complete = ["session-2", "session-3"].reduce((current, eventId, index) => recordCompletion(current, { eventId, occurredAt: `2026-11-${11 + index}T18:00:00Z` }), duplicate)
assert.equal(suggestReplan(complete, week), null)
assert.equal(weeklyProgress(complete, "2026-11-16T00:00:00Z").doneCount, 0)
console.log("recurrence e2e: 1/3 -> suggestion -> 3/3 -> next week 0/3; idempotent")
