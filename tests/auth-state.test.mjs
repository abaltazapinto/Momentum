import assert from "node:assert/strict"
import test from "node:test"
import { authStatusForAnonymousFailure, taskListState, taskSubmissionMessage } from "../auth-state.js"

test("anonymous auth failure is terminal but recoverable through email sign-in", () => {
    assert.equal(authStatusForAnonymousFailure(), "error")
    assert.equal(taskSubmissionMessage("error"), "Authentication is unavailable. Sign in with your email to recover your tasks.")
    assert.doesNotMatch(taskSubmissionMessage("error"), /starting/i)
})

test("task submission keeps the startup message only while auth is starting", () => {
    assert.equal(taskSubmissionMessage("starting"), "Authentication is still starting. Please try again in a moment.")
    assert.equal(taskSubmissionMessage("anonymous-sign-in"), "Authentication is still starting. Please try again in a moment.")
})

test("task list distinguishes unavailable data from an empty, ready list", () => {
    assert.equal(taskListState({ authStatus: "error", isLoadingTasks: false, taskStatus: "unavailable" }), "unavailable")
    assert.equal(taskListState({ authStatus: "authenticated", isLoadingTasks: false, taskStatus: "ready" }), "ready")
    assert.equal(taskListState({ authStatus: "authenticated", isLoadingTasks: true, taskStatus: "loading" }), "loading")
})
