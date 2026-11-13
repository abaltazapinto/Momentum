import { createRecurringTask, recordCompletion, weeklyProgress, getWeekStartForInstant } from "./recurrence.js"
import { socialAuthErrorMessage } from "./auth-state.js"
import { normalizeTask, parseTaskBackup, readBrowserRecovery, preserveBrowserRecovery } from "./task-recovery.js"
import { firebaseSettingsFromEnv, verifyFirebaseProject } from "./firebase-config.js"

const el = id => document.getElementById(id)
const authFormEl = el("auth-form")
const authEmailEl = el("auth-email")
const authPasswordEl = el("auth-password")
const authStatusEl = el("auth-status")
const taskFormEl = el("task-form")
const taskInputEl = el("task-input")
const taskListEl = el("task-list")
const taskStatusEl = el("task-status")
const recurringToggleEl = el("recurring-toggle")
const recurringTargetEl = el("recurring-target")
const recurringDurationEl = el("recurring-duration")
const themeToggleEl = el("theme-toggle")
const recoveryStorage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }
const state = { user: null, tasks: [], taskStatus: "unavailable", isCreatingTask: false }
let auth = null, database = null, authApi = null, databaseApi = null
let providers = {}, authReady = false, authBusy = false, recoveryBusy = false
let stopTasksSubscription = null, sessionVersion = 0, pendingProvider = null
const sessionInFlight = new Set()

updateThemeToggle()
renderSession()
startAuthentication()

async function startAuthentication() {
    setAuthBusy(false)
    const settings = firebaseSettingsFromEnv(import.meta.env)
    if (!settings) {
        authStatusEl.textContent = "A entrada está temporariamente indisponível. Falta concluir a configuração da conta nesta app."
        return
    }
    authStatusEl.textContent = "A preparar a entrada…"
    try {
        const useEmulators = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_USE_EMULATORS === "true" && settings.projectId.startsWith("demo-")
        if (!useEmulators) await verifyFirebaseProject(settings)
        const [appModule, authModule, databaseModule] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/database")])
        authApi = authModule
        databaseApi = databaseModule
        const app = appModule.initializeApp(settings)
        auth = authModule.getAuth(app)
        database = databaseModule.getDatabase(app)
        if (useEmulators) {
            authModule.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
            databaseModule.connectDatabaseEmulator(database, "127.0.0.1", 9000)
        }
        providers = { Google: new authModule.GoogleAuthProvider(), Facebook: new authModule.FacebookAuthProvider(), GitHub: new authModule.GithubAuthProvider() }
        authModule.onAuthStateChanged(auth, user => {
            authReady = true
            authStatusEl.textContent = "Entra na tua conta ou cria uma para começar."
            if (user && !user.isAnonymous) startTaskSession(user)
            else closeTaskSession()
            setAuthBusy(authBusy)
        }, error => {
            authReady = false
            closeTaskSession()
            setAuthBusy(false)
            authStatusEl.textContent = socialAuthErrorMessage(error.code)
        })
    } catch (error) {
        authReady = false
        closeTaskSession()
        setAuthBusy(false)
        authStatusEl.textContent = socialAuthErrorMessage(error.code)
        console.error("Authentication unavailable:", error.code || error.message)
    }
}

function signedInUser() {
    const user = auth?.currentUser
    return user && !user.isAnonymous && state.user?.uid === user.uid ? user : null
}
function setAuthBusy(busy) {
    authBusy = busy
    for (const control of authFormEl.querySelectorAll("input, button")) control.disabled = busy || !authReady
}
authFormEl.addEventListener("submit", async event => {
    event.preventDefault()
    if (!authReady || authBusy) return
    const email = authEmailEl.value.trim(), password = authPasswordEl.value
    const creating = event.submitter === el("auth-create-button")
    setAuthBusy(true)
    try {
        if (creating && auth.currentUser?.isAnonymous) await authApi.linkWithCredential(auth.currentUser, authApi.EmailAuthProvider.credential(email, password))
        else if (creating) await authApi.createUserWithEmailAndPassword(auth, email, password)
        else { await preserveAnonymousTasks(); await authApi.signInWithEmailAndPassword(auth, email, password) }
        authPasswordEl.value = ""
        pendingProvider = null
        el("existing-sign-in-button").hidden = true
        startTaskSession(auth.currentUser)
    } catch (error) {
        authStatusEl.textContent = socialAuthErrorMessage(error.code, "email")
        console.error("Email authentication failed:", error.code)
    } finally { setAuthBusy(false) }
})
for (const [id, provider] of [["google-sign-in-button", "Google"], ["facebook-sign-in-button", "Facebook"], ["github-sign-in-button", "GitHub"]]) el(id).addEventListener("click", () => signInWithSocialProvider(provider))
el("existing-sign-in-button").addEventListener("click", () => {
    if (pendingProvider) signInWithSocialProvider(pendingProvider.name, true)
})
async function signInWithSocialProvider(name, existing = false) {
    if (!authReady || authBusy) return
    setAuthBusy(true)
    try {
        if (auth.currentUser?.isAnonymous && !existing) await authApi.linkWithPopup(auth.currentUser, providers[name])
        else if (existing) {
            await preserveAnonymousTasks()
            if (pendingProvider?.credential) await authApi.signInWithCredential(auth, pendingProvider.credential)
            else await authApi.signInWithPopup(auth, providers[name])
        } else {
            // A failed popup must not sign the existing session out.
            await authApi.signInWithPopup(auth, providers[name])
        }
        pendingProvider = null
        el("existing-sign-in-button").hidden = true
        startTaskSession(auth.currentUser)
    } catch (error) {
        if (error.code === "auth/credential-already-in-use") {
            const Provider = { Google: authApi.GoogleAuthProvider, Facebook: authApi.FacebookAuthProvider, GitHub: authApi.GithubAuthProvider }[name]
            pendingProvider = { name, credential: Provider.credentialFromError(error) }
            el("existing-sign-in-button").textContent = `Entrar na conta ${name} existente`
            el("existing-sign-in-button").hidden = false
        }
        authStatusEl.textContent = socialAuthErrorMessage(error.code, name)
        console.error("Social authentication failed:", error.code)
    } finally { setAuthBusy(false) }
}
async function preserveAnonymousTasks() {
    const user = auth?.currentUser
    if (!user?.isAnonymous) return
    try {
        const snapshot = await databaseApi.get(databaseApi.ref(database, `users/${user.uid}/tasks`))
        const tasks = parseTaskBackup({ tasks: snapshot.val() ?? {} })
        if (tasks.length) preserveBrowserRecovery(recoveryStorage, tasks)
    } catch { throw Object.assign(new Error("Guest backup failed"), { code: "auth/guest-backup-failed" }) }
}
el("sign-out-button").addEventListener("click", async () => {
    // Never blocked by a pending recovery: changing session makes that recovery stop.
    if (!signedInUser()) return
    el("sign-out-button").disabled = true
    try { await authApi.signOut(auth); closeTaskSession() }
    catch { showError("Não foi possível terminar a sessão. Tenta novamente.") }
    finally { el("sign-out-button").disabled = false }
})
function stopTaskSession() {
    sessionVersion++
    if (stopTasksSubscription) stopTasksSubscription()
    stopTasksSubscription = null
    sessionInFlight.clear()
}
function closeTaskSession() {
    stopTaskSession()
    state.user = null
    state.tasks = []
    state.taskStatus = "unavailable"
    state.isCreatingTask = false
    taskInputEl.value = ""
    authPasswordEl.value = ""
    clearStatus()
    renderSession()
}
function startTaskSession(user) {
    if (!user || user.isAnonymous) return closeTaskSession()
    if (state.user?.uid === user.uid && stopTasksSubscription) return
    stopTaskSession()
    state.user = user
    state.tasks = []
    state.taskStatus = "loading"
    const version = sessionVersion
    clearStatus()
    renderSession()
    stopTasksSubscription = databaseApi.onValue(databaseApi.ref(database, `users/${user.uid}/tasks`), snapshot => {
        if (version !== sessionVersion || !signedInUser()) return
        state.tasks = Object.entries(snapshot.val() ?? {}).map(([id, value]) => normalizeTask(id, value)).filter(Boolean)
        state.taskStatus = "ready"
        renderTasks()
    }, error => {
        if (version !== sessionVersion) return
        state.tasks = []
        state.taskStatus = "unavailable"
        renderTasks()
        showError("Não foi possível carregar as tarefas da conta. Tenta novamente mais tarde.")
        console.error("Task subscription failed:", error.code)
    })
}
function renderSession() {
    const entered = Boolean(signedInUser())
    el("entry-view").hidden = entered
    el("workspace-view").hidden = !entered
    el("app-tagline").textContent = entered ? "Um passo de cada vez. O teu dia começa aqui." : "Entra na tua conta para organizar o teu dia."
    el("account-label").textContent = entered ? state.user.displayName || state.user.email || "A tua conta" : ""
    if (entered) {
        try { el("import-browser-tasks-button").hidden = readBrowserRecovery(recoveryStorage).length === 0 }
        catch { el("import-browser-tasks-button").hidden = true }
    }
    renderTasks()
}
taskInputEl.addEventListener("invalid", event => { event.preventDefault(); showError("Escreve uma tarefa para continuar."); taskInputEl.focus() })
taskFormEl.addEventListener("submit", async event => {
    event.preventDefault()
    const user = signedInUser()
    if (!user || state.isCreatingTask || state.taskStatus !== "ready") return
    const title = taskInputEl.value.trim()
    if (!title) return showError("Escreve uma tarefa para continuar.")
    const version = sessionVersion
    clearStatus()
    state.isCreatingTask = true
    renderTaskControls()
    try {
        const task = { title, completed: false, createdAt: databaseApi.serverTimestamp(), updatedAt: databaseApi.serverTimestamp() }
        if (recurringToggleEl.checked) {
            task.recurrence = createRecurringTask({ id: "pending", title, durationMinutes: Number(recurringDurationEl.value), targetCount: Number(recurringTargetEl.value), timezone: "Atlantic/Madeira" }).recurrence
            task.completionEvents = []
        }
        await databaseApi.push(databaseApi.ref(database, `users/${user.uid}/tasks`), task)
        if (version === sessionVersion) { taskInputEl.value = ""; taskInputEl.focus() }
    } catch { if (version === sessionVersion) showError("Não foi possível guardar a tarefa. O texto foi mantido para tentares novamente.") }
    finally { if (version === sessionVersion) { state.isCreatingTask = false; renderTaskControls() } }
})
recurringToggleEl.addEventListener("change", () => { recurringTargetEl.hidden = !recurringToggleEl.checked; recurringDurationEl.hidden = !recurringToggleEl.checked })
taskListEl.addEventListener("change", async event => {
    const checkbox = event.target.closest('[data-action="toggle-task"]'), user = signedInUser()
    if (!checkbox || !user) return
    const task = state.tasks.find(item => item.id === checkbox.closest("[data-task-id]")?.dataset.taskId)
    if (!task) return
    const version = sessionVersion, completed = checkbox.checked
    checkbox.disabled = true
    clearStatus()
    try {
        // A transaction aborts if the task was deleted meanwhile, so it is never recreated half-empty.
        const result = await databaseApi.runTransaction(databaseApi.ref(database, `users/${user.uid}/tasks/${task.id}`), current => current ? { ...current, completed, updatedAt: Date.now() } : undefined)
        if (!result.committed && version === sessionVersion) renderTasks()
    }
    catch { if (version === sessionVersion) { checkbox.checked = task.completed; checkbox.disabled = false; showError("Não foi possível guardar a alteração. Tenta novamente.") } }
})
taskListEl.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]"), user = signedInUser()
    if (!button || !user) return
    const task = state.tasks.find(item => item.id === button.closest("[data-task-id]")?.dataset.taskId)
    if (!task || sessionInFlight.has(task.id)) return
    const version = sessionVersion, taskRef = databaseApi.ref(database, `users/${user.uid}/tasks/${task.id}`)
    sessionInFlight.add(task.id)
    button.disabled = true
    clearStatus()
    try {
        if (button.dataset.action === "record-session") {
            const completion = { taskId: task.id, eventId: crypto.randomUUID(), occurredAt: new Date().toISOString() }
            await databaseApi.runTransaction(taskRef, current => {
                if (!current?.recurrence) return
                return recordCompletion({ ...current, completionEvents: current.completionEvents || [] }, completion)
            })
        } else if (button.dataset.action === "delete-task") await databaseApi.remove(taskRef)
    } catch { if (version === sessionVersion) showError("Não foi possível guardar a alteração. Tenta novamente.") }
    // A request from an older session must not release a lock owned by the current one.
    finally { if (version === sessionVersion) { sessionInFlight.delete(task.id); renderTasks() } }
})
async function recoverTasks(loadTasks) {
    const user = signedInUser()
    if (!user || recoveryBusy || state.taskStatus !== "ready") return
    const version = sessionVersion
    recoveryBusy = true
    renderTaskControls()
    showInfo("A recuperar tarefas…")
    try {
        const tasks = await loadTasks()
        let count = 0
        for (const task of tasks) {
            if (version !== sessionVersion || signedInUser()?.uid !== user.uid) throw new Error("Session changed")
            const result = await databaseApi.runTransaction(databaseApi.ref(database, `users/${user.uid}/tasks/${task.id}`), current => current === null ? task : undefined)
            if (result.committed) count++
        }
        if (version === sessionVersion) showInfo(count ? `${count} tarefas recuperadas para a tua conta. A lista original foi preservada.` : "Não há tarefas novas para importar. As tarefas existentes foram preservadas.")
    } catch { if (version === sessionVersion) showError("A recuperação não terminou. Podes tentar novamente ou importar a cópia JSON; as tarefas originais foram preservadas.") }
    finally { recoveryBusy = false; renderTaskControls() }
}
el("recover-tasks-button").addEventListener("click", () => recoverTasks(async () => {
    const snapshot = await databaseApi.get(databaseApi.ref(database, "tasks"))
    return parseTaskBackup({ tasks: snapshot.val() ?? {} })
}))
el("import-browser-tasks-button").addEventListener("click", () => recoverTasks(() => readBrowserRecovery(recoveryStorage)))
el("import-tasks-button").addEventListener("click", () => { if (signedInUser()) el("import-tasks-file").click() })
el("import-tasks-file").addEventListener("change", async () => {
    const file = el("import-tasks-file").files[0]
    if (file) await recoverTasks(async () => parseTaskBackup(JSON.parse(await file.text())))
    el("import-tasks-file").value = ""
})
el("export-tasks-button").addEventListener("click", () => {
    if (!signedInUser() || state.taskStatus !== "ready") return
    const backup = { version: 1, exportedAt: new Date().toISOString(), tasks: Object.fromEntries(state.tasks.map(task => [task.id, task])) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `momentum-tasks-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
})
function renderTaskControls() {
    const ready = Boolean(signedInUser()) && state.taskStatus === "ready"
    el("add-task-button").disabled = !ready || state.isCreatingTask
    el("add-task-button").textContent = state.isCreatingTask ? "A guardar…" : "Adicionar tarefa"
    for (const id of ["recover-tasks-button", "import-tasks-button", "import-browser-tasks-button", "export-tasks-button"]) el(id).disabled = !ready || recoveryBusy
}
function renderTasks() {
    taskListEl.textContent = ""
    renderTaskControls()
    if (!signedInUser()) { el("daily-summary").textContent = ""; return }
    if (state.taskStatus !== "ready") {
        const loading = state.taskStatus === "loading"
        el("daily-summary").textContent = loading ? "A carregar…" : "Lista indisponível"
        taskListEl.append(createListMessage(loading ? "A carregar tarefas…" : "Tarefas indisponíveis", loading ? "" : "Não foi possível abrir a lista da conta. Tenta novamente mais tarde."))
        return
    }
    const completed = state.tasks.filter(task => task.completed).length
    el("daily-summary").textContent = `${state.tasks.length - completed} por fazer · ${completed} concluídas`
    if (!state.tasks.length) { taskListEl.append(createListMessage("Vamos organizar o teu dia", "Adiciona a primeira tarefa ou recupera a tua lista anterior nas opções abaixo.")); return }
    taskListEl.append(...state.tasks.map(createTaskElement))
}
function createListMessage(title, message) {
    const item = document.createElement("li"), heading = document.createElement("h2"), description = document.createElement("p")
    item.className = "task-list__empty"
    heading.className = "task-list__empty-title"
    heading.textContent = title
    description.className = "task-list__empty-message"
    description.textContent = message
    item.append(heading, description)
    return item
}
function createTaskElement(task) {
    const item = document.createElement("li")
    item.className = `task${task.completed ? " task--completed" : ""}`
    item.dataset.taskId = task.id
    const control = document.createElement("span"), checkbox = document.createElement("input")
    control.className = "task__checkbox-control"
    checkbox.className = "task__checkbox"
    checkbox.type = "checkbox"
    checkbox.checked = task.completed
    checkbox.dataset.action = "toggle-task"
    checkbox.setAttribute("aria-label", `Marcar ${task.title} como ${task.completed ? "pendente" : "concluída"}`)
    control.append(checkbox, icon("square", "task__checkbox-icon task__checkbox-icon--unchecked"), icon("check", "task__checkbox-icon task__checkbox-icon--checked"))
    const content = document.createElement("div"), title = document.createElement("span")
    content.className = "task__content"
    title.className = "task__title"
    title.textContent = task.title
    content.append(title)
    if (task.recurrence) {
        const progress = weeklyProgress(task, getWeekStartForInstant(new Date().toISOString(), task.recurrence.timezone))
        const progressEl = document.createElement("p"), sessionButton = document.createElement("button")
        progressEl.className = "recurring-progress"
        progressEl.textContent = `${progress.doneCount}/${progress.targetCount} esta semana · ${task.recurrence.durationMinutes} min`
        sessionButton.type = "button"
        sessionButton.className = "task__session-button"
        sessionButton.dataset.action = "record-session"
        sessionButton.textContent = "Registar sessão"
        sessionButton.disabled = sessionInFlight.has(task.id)
        content.append(progressEl, sessionButton)
    }
    const deleteButton = document.createElement("button")
    deleteButton.type = "button"
    deleteButton.className = "task__delete-button"
    deleteButton.dataset.action = "delete-task"
    deleteButton.setAttribute("aria-label", `Eliminar ${task.title}`)
    deleteButton.append(icon("trash", "task__delete-icon"))
    item.append(control, content, deleteButton)
    return item
}
function icon(name, className) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("class", `lucide ${className}`)
    svg.setAttribute("viewBox", "0 0 24 24")
    svg.setAttribute("aria-hidden", "true")
    const paths = { square: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"], check: ["M20 6 9 17l-5-5"], trash: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M10 11v6m4-6v6"] }
    for (const d of paths[name]) { const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", d); svg.append(path) }
    return svg
}
requestAnimationFrame(() => document.documentElement.classList.add("theme-ready"))
themeToggleEl.addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = theme
    updateThemeToggle()
    try { localStorage.setItem("momentum-theme", theme) } catch { /* Theme still works without storage. */ }
})
function updateThemeToggle() {
    const label = document.documentElement.dataset.theme === "dark" ? "Usar tema claro" : "Usar tema escuro"
    themeToggleEl.setAttribute("aria-label", label)
    themeToggleEl.title = label
}
function clearStatus() { taskStatusEl.textContent = ""; taskStatusEl.classList.remove("task-status--error") }
function showError(message) { taskStatusEl.textContent = message; taskStatusEl.classList.add("task-status--error") }
function showInfo(message) { taskStatusEl.textContent = message; taskStatusEl.classList.remove("task-status--error") }
