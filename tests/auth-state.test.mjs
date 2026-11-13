import assert from "node:assert/strict"
import test from "node:test"
import { authStatusForAnonymousFailure, googleAuthAction, googleAuthErrorMessage, taskListState, taskSubmissionMessage } from "../auth-state.js"

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

test("Google provider conflicts never suggest an automatic merge", () => {
    const message = googleAuthErrorMessage("auth/credential-already-in-use")
    assert.match(message, /já está ligada a outro utilizador/i)
    assert.match(message, /não foram misturadas/i)
    assert.doesNotMatch(message, /merge automático|mistura automática|automaticamente/i)
})

test("Google popup errors have safe user-facing messages", () => {
    assert.match(googleAuthErrorMessage("auth/popup-closed-by-user"), /cancelado/i)
    assert.match(googleAuthErrorMessage("auth/operation-not-allowed"), /não está ativo/i)
    assert.doesNotMatch(googleAuthErrorMessage("auth/popup-blocked"), /auth\//i)
    assert.notEqual(googleAuthErrorMessage("auth/popup-blocked").trim(), "")
})

test("Google Sign-In waits for Auth initialization and supports explicit existing-account login", () => {
    assert.equal(googleAuthAction({ authReady: false, isAnonymous: true }), "wait")
    assert.equal(googleAuthAction({ authReady: true, isAnonymous: true }), "link")
    assert.equal(googleAuthAction({ authReady: true, isAnonymous: false }), "sign-in")
    assert.equal(googleAuthAction({ authReady: true, isAnonymous: true, existingAccountConflict: true }), "sign-in-existing")
})
