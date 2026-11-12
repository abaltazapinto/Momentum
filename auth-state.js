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

export function googleAuthErrorMessage(code) {
    const messages = {
        "auth/account-exists-with-different-credential": "Já existe uma conta com este email. Inicia sessão com o método original.",
        "auth/cancelled-popup-request": "Já existe um pedido de login Google em curso.",
        "auth/credential-already-in-use": "Esta conta Google já está ligada a outro utilizador. Inicia sessão nessa conta separadamente; as tarefas não foram misturadas.",
        "auth/popup-blocked": "O popup Google foi bloqueado. Permite popups e tenta novamente.",
        "auth/popup-closed-by-user": "O login Google foi cancelado.",
        "auth/operation-not-allowed": "O login Google ainda não está ativo neste projeto Firebase.",
        "auth/unauthorized-domain": "Este domínio ainda não está autorizado no Firebase Authentication.",
        "auth/network-request-failed": "Não foi possível contactar o Firebase. Verifica a ligação e tenta novamente."
    }
    return messages[code] || "Não foi possível iniciar sessão com Google. Tenta novamente."
}
