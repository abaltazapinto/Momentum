import assert from "node:assert/strict"
import test from "node:test"
import { authStatusForAnonymousFailure, taskSubmissionMessage } from "../auth-state.js"

test("anonymous auth failure is terminal but recoverable through email sign-in", () => {
    assert.equal(authStatusForAnonymousFailure(), "error")
    assert.match(taskSubmissionMessage("error"), /email/i)
})

test("task submission keeps the startup message only while auth is starting", () => {
    assert.match(taskSubmissionMessage("starting"), /starting/i)
    assert.match(taskSubmissionMessage("anonymous-sign-in"), /starting/i)
})
