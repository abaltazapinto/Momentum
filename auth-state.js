export function authStatusForAnonymousFailure() {
    return "error"
}

export function taskSubmissionMessage(authStatus) {
    return authStatus === "error"
        ? "Authentication is unavailable. Sign in with your email to recover your tasks."
        : "Authentication is still starting. Please try again in a moment."
}

export function taskListState({ authStatus, isLoadingTasks, taskStatus }) {
    if (taskStatus === "unavailable" || authStatus === "error") return "unavailable"
    if (isLoadingTasks || taskStatus === "loading") return "loading"
    return "ready"
}
