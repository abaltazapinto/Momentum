export function authStatusForAnonymousFailure() {
    return "error"
}

export function taskSubmissionMessage(authStatus) {
    return authStatus === "error"
        ? "Authentication is unavailable. Sign in with your email to recover your tasks."
        : "Authentication is still starting. Please try again in a moment."
}
