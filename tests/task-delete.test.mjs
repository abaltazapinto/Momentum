import assert from "node:assert/strict"
import test from "node:test"
import { createDeleteRequest, deleteTargetPath, isSameGestureAsOpen } from "../task-delete.js"

const tasks = [{ id: "-Nabc", title: "Pão" }, { id: "-Ndef", title: "Pão" }]
const request = createDeleteRequest(tasks[0], "uid-a", 3)

test("request keeps the task ID, title, owner and session", () => {
    assert.deepEqual(request, { taskId: "-Nabc", title: "Pão", uid: "uid-a", sessionVersion: 3 })
})

test("confirmation targets only the task's ID under the owner's path", () => {
    assert.equal(deleteTargetPath(request, { uid: "uid-a", sessionVersion: 3, tasks }), "users/uid-a/tasks/-Nabc")
})

test("a task with the same title is never targeted instead", () => {
    const renamed = [{ id: "-Nabc", title: "Leite" }, { id: "-Ndef", title: "Pão" }]
    assert.equal(deleteTargetPath(request, { uid: "uid-a", sessionVersion: 3, tasks: renamed }), "users/uid-a/tasks/-Nabc")
})

test("no target after the account or session changed", () => {
    assert.equal(deleteTargetPath(request, { uid: "uid-b", sessionVersion: 3, tasks }), null)
    assert.equal(deleteTargetPath(request, { uid: null, sessionVersion: 3, tasks }), null)
    assert.equal(deleteTargetPath(request, { uid: "uid-a", sessionVersion: 4, tasks }), null)
})

test("no target when the task is already gone or there is no request", () => {
    assert.equal(deleteTargetPath(request, { uid: "uid-a", sessionVersion: 3, tasks: [tasks[1]] }), null)
    assert.equal(deleteTargetPath(null, { uid: "uid-a", sessionVersion: 3, tasks }), null)
})

test("second click of a double-click and taps right after opening are ignored", () => {
    assert.equal(isSameGestureAsOpen({ detail: 2, timeStamp: 5000 }, 1000), true)
    assert.equal(isSameGestureAsOpen({ detail: 1, timeStamp: 1200 }, 1000), true)
    assert.equal(isSameGestureAsOpen({ detail: 1, timeStamp: 1500 }, 1000), false)
    assert.equal(isSameGestureAsOpen({ detail: 0, timeStamp: 1500 }, 1000), false)
})

test("keyboard activation is never treated as part of the opening gesture", () => {
    assert.equal(isSameGestureAsOpen({ detail: 0, timeStamp: 1100 }, 1000), false)
})
