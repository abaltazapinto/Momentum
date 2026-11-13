import assert from "node:assert/strict"
import test from "node:test"
import { initializeApp, deleteApp } from "firebase/app"
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth"
import { connectDatabaseEmulator, get, getDatabase, goOffline, ref, runTransaction, set } from "firebase/database"
import { createRecurringTask, recordCompletion, weeklyProgress } from "../recurrence.js"

const projectId = "demo-momentum"
const apps = []
const makeClient = (name) => {
    const app = initializeApp({ apiKey: "demo", authDomain: "demo-momentum.local", projectId, databaseURL: "https://demo-momentum-default-rtdb.firebaseio.com" }, name)
    apps.push(app)
    const auth = getAuth(app)
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
    const database = getDatabase(app)
    connectDatabaseEmulator(database, "127.0.0.1", 9000)
    return { app, auth, database }
}

const anonymous = makeClient("anonymous")
const owner = makeClient("owner")
const other = makeClient("other")
const ownerCredential = await createUserWithEmailAndPassword(owner.auth, "owner@example.test", "password123")
const otherCredential = await createUserWithEmailAndPassword(other.auth, "other@example.test", "password123")
const ownerUid = ownerCredential.user.uid
const otherUid = otherCredential.user.uid
const taskPath = `users/${ownerUid}/tasks/leetcode`

test("Realtime Database denies unauthenticated access", async () => {
    await assert.rejects(() => get(ref(anonymous.database, taskPath)), /Permission denied/i)
})

test("Realtime Database isolates UIDs and permits the owner", async () => {
    await set(ref(owner.database, taskPath), { title: "LeetCode 3x/semana", completed: false, recurrence: { frequency: "weekly", targetCount: 3, durationMinutes: 30, timezone: "Europe/Lisbon" }, completionEvents: [] })
    assert.equal((await get(ref(owner.database, taskPath))).val().title, "LeetCode 3x/semana")
    await assert.rejects(() => get(ref(other.database, taskPath)), /Permission denied/i)
    await assert.rejects(() => set(ref(other.database, taskPath), { title: "intruso" }), /Permission denied/i)
    assert.equal((await get(ref(owner.database, taskPath))).val().title, "LeetCode 3x/semana")
    assert.notEqual(ownerUid, otherUid)
})

// Admin-only seed through the emulator REST API (clients cannot write these paths).
const adminPut = (path, value) => fetch(`http://127.0.0.1:9000/${path}.json?ns=demo-momentum-default-rtdb`, { method: "PUT", headers: { Authorization: "Bearer owner" }, body: JSON.stringify(value) })

test("legacy /tasks list is read-only and private to the original owner", async () => {
    await adminPut("legacyOwner", ownerUid)
    await adminPut("tasks", { legacy1: { title: "Tarefa antiga", completed: false } })
    assert.equal((await get(ref(owner.database, "tasks"))).val().legacy1.title, "Tarefa antiga")
    await assert.rejects(() => get(ref(owner.database, "legacyOwner")), /Permission denied/i)
    await assert.rejects(() => set(ref(owner.database, "legacyOwner"), otherUid), /Permission denied/i)
    await assert.rejects(() => get(ref(anonymous.database, "tasks")), /Permission denied/i)
    await assert.rejects(() => get(ref(other.database, "tasks")), /Permission denied/i)
    await assert.rejects(() => set(ref(owner.database, "tasks/new"), { title: "x" }), /Permission denied/i)
    await assert.rejects(() => set(ref(anonymous.database, "tasks/new"), { title: "x" }), /Permission denied/i)
})

test("unknown top-level paths are closed; endorsements stays open for the other app", async () => {
    await assert.rejects(() => get(ref(anonymous.database, "/")), /Permission denied/i)
    await assert.rejects(() => set(ref(owner.database, "anything"), "x"), /Permission denied/i)
    await set(ref(anonymous.database, "endorsements/check"), "ok")
    assert.equal((await get(ref(anonymous.database, "endorsements/check"))).val(), "ok")
})

test("real SDK transaction persists one recurring session after reload", async () => {
    const taskRef = ref(owner.database, taskPath)
    await runTransaction(taskRef, (current) => {
        if (!current) return current
        const task = { ...current, completionEvents: current.completionEvents || [] }
        return recordCompletion(task, { taskId: "leetcode", eventId: "session-1", occurredAt: "2026-11-10T18:00:00Z" })
    })
    const reloaded = (await get(taskRef)).val()
    assert.equal(reloaded.completionEvents.length, 1)
    assert.equal(reloaded.completionEvents[0].taskId, "leetcode")
    assert.deepEqual(weeklyProgress({ ...createRecurringTask({ id: "leetcode", title: reloaded.title, durationMinutes: 30, targetCount: 3, timezone: "Europe/Lisbon" }), completionEvents: reloaded.completionEvents }, "2026-11-09T00:00:00Z"), { doneCount: 1, targetCount: 3, remaining: 2 })
})

test.after(async () => {
    goOffline(anonymous.database)
    goOffline(owner.database)
    goOffline(other.database)
    await Promise.all([signOut(anonymous.auth), signOut(owner.auth), signOut(other.auth)])
    await Promise.all(apps.map(deleteApp))
})
