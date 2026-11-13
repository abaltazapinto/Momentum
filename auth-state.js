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
    return socialAuthErrorMessage(code, "Google")
}

export function socialAuthErrorMessage(code, providerName = "conta") {
    const messages = {
        "auth/account-exists-with-different-credential": "Já existe uma conta com este email. Inicia sessão com o método original.",
        "auth/cancelled-popup-request": "Já existe um pedido de entrada em curso.",
        "auth/credential-already-in-use": `Esta conta ${providerName} já está ligada a outro utilizador. Usa «Entrar na conta existente»; as tarefas não foram misturadas.`,
        "auth/popup-blocked": "A janela de entrada foi bloqueada. Permite popups e tenta novamente.",
        "auth/popup-closed-by-user": "O login foi cancelado. Tenta novamente quando quiseres entrar.",
        "auth/operation-not-allowed": `O login com ${providerName} ainda não está ativo nesta app.`,
        "auth/unauthorized-domain": "A entrada com conta ainda não está autorizada neste endereço da app.",
        "auth/network-request-failed": "Não foi possível contactar o serviço de entrada. Verifica a ligação e tenta novamente.",
        "auth/project-mismatch": "A configuração de entrada não corresponde a esta app. É necessário corrigi-la antes de iniciar sessão.",
        "auth/configuration-not-found": "A entrada com conta ainda não está configurada nesta app.",
        "auth/invalid-api-key": "A configuração de entrada precisa de ser corrigida antes de iniciar sessão.",
        "auth/invalid-credential": "Email ou palavra-passe incorretos. Se ainda não tens conta, usa «Criar conta».",
        "auth/invalid-login-credentials": "Email ou palavra-passe incorretos. Se ainda não tens conta, usa «Criar conta».",
        "auth/user-not-found": "Não foi possível entrar. Verifica os dados ou usa «Criar conta».",
        "auth/wrong-password": "Email ou palavra-passe incorretos. Tenta novamente.",
        "auth/email-already-in-use": "Este email já tem uma conta. Usa «Entrar» ou o método com que criaste a conta.",
        "auth/weak-password": "Escolhe uma palavra-passe com pelo menos 6 caracteres.",
        "auth/invalid-email": "Escreve um endereço de email válido.",
        "auth/too-many-requests": "Houve demasiadas tentativas. Aguarda um pouco antes de tentar novamente.",
        "auth/guest-backup-failed": "Não foi possível preservar a sessão antiga. Usa «Criar conta» para a ligar a um novo email antes de mudar de conta."
    }
    return messages[code] || `Não foi possível iniciar sessão com ${providerName}. Tenta novamente.`
}

export function googleAuthAction({ authReady, isAnonymous, existingAccountConflict = false }) {
    if (!authReady) return "wait"
    if (existingAccountConflict) return "sign-in-existing"
    return isAnonymous ? "link" : "sign-in"
}
