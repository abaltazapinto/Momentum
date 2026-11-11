import assert from "node:assert/strict"
import { createRecurringTask, recordCompletion, weeklyProgress } from "./recurrence.js"

// Deterministic Firebase adapter double: same paths, auth ownership and transaction semantics.
class FakeRealtimeDatabase {
    constructor() { this.users = new Map() }
    userTasks(uid) { if (!this.users.has(uid)) this.users.set(uid, new Map()); return this.users.get(uid) }
    create(uid, task) { const tasks = this.userTasks(uid); tasks.set(task.id, structuredClone(task)) }
    read(uid) { return [...this.userTasks(uid).values()].map(value => structuredClone(value)) }
    transaction(uid, taskId, fn) {
        const tasks = this.userTasks(uid)
        const next = fn(structuredClone(tasks.get(taskId)))
        if (next) tasks.set(taskId, structuredClone(next))
    }
}

const db = new FakeRealtimeDatabase()
const userA = "uid-user-a"
const userB = "uid-user-b"
const oldTask = { id: "old-task", title: "Tarefa anterior", completed: false }
const leetCode = createRecurringTask({ id: "leetcode", title: "LeetCode", durationMinutes: 30, targetCount: 3 })
db.create(userA, oldTask)
db.create(userA, leetCode)

// 1. Create task and record one session through the authenticated user path.
db.transaction(userA, "leetcode", current => recordCompletion(current, { taskId: "leetcode", eventId: "session-1", occurredAt: "2026-11-10T18:00:00Z" }))

// 2. Reopen: a fresh read for the same UID keeps 1/3 and the prior task.
const reopened = db.read(userA)
const reopenedLeetCode = reopened.find(task => task.id === "leetcode")
assert.equal(reopenedLeetCode.completionEvents[0].taskId, "leetcode")
assert.deepEqual(weeklyProgress(reopenedLeetCode, "2026-11-09T00:00:00Z"), { doneCount: 1, targetCount: 3, remaining: 2 })
assert.ok(reopened.some(task => task.id === "old-task"), "previous task must remain")

// 3. Another device uses the same UID and sees the same data.
assert.deepEqual(db.read(userA), reopened)

// 4. A different UID cannot see or mutate the first user's tasks.
assert.deepEqual(db.read(userB), [])
db.create(userB, { id: "private", title: "Outra conta", completed: false })
assert.deepEqual(db.read(userA).map(task => task.id).sort(), ["leetcode", "old-task"])
assert.deepEqual(db.read(userB).map(task => task.id), ["private"])

console.log("auth persistence e2e: create -> 1/3 after reopen -> same UID on second device -> isolated UID -> previous task preserved")
