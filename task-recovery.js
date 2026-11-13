const BROWSER_RECOVERY_KEY = "momentum-local-tasks-v1"
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value)
const validId = id => typeof id === "string" && id.length > 0 && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(id) && !["__proto__", "constructor", "prototype"].includes(id)

export function normalizeTask(id, value) {
    if (!validId(id)) return null
    if (typeof value === "string") value = { title: value }
    if (!isObject(value) || typeof value.title !== "string" || !value.title.trim()) return null
    const recurrence = value.recurrence?.frequency === "weekly" ? value.recurrence : null
    if (recurrence) {
        if (!Number.isInteger(recurrence.targetCount) || recurrence.targetCount <= 0 || !Number.isFinite(recurrence.durationMinutes) || recurrence.durationMinutes <= 0 || typeof recurrence.timezone !== "string") return null
        try { new Intl.DateTimeFormat("en", { timeZone: recurrence.timezone }) } catch { return null }
    }
    const completionEvents = value.completionEvents ?? []
    if (!Array.isArray(completionEvents) || completionEvents.some(event => !isObject(event) || typeof event.occurredAt !== "string" || Number.isNaN(Date.parse(event.occurredAt)))) return null
    return { ...value, id, title: value.title.trim(), completed: value.completed === true, createdAt: typeof value.createdAt === "number" ? value.createdAt : null, recurrence, completionEvents }
}
export function parseTaskBackup(backup) {
    if (!isObject(backup) || !isObject(backup.tasks)) throw new Error("Invalid task backup")
    const tasks = Object.entries(backup.tasks).map(([id, value]) => normalizeTask(id, value))
    if (tasks.some(task => !task)) throw new Error("Invalid task in backup; nothing imported")
    return tasks
}
// Only a recovery source for authenticated imports, never an alternative task session.
export function readBrowserRecovery(storage) {
    const raw = storage.getItem(BROWSER_RECOVERY_KEY)
    return raw === null ? [] : parseTaskBackup(JSON.parse(raw))
}
export function preserveBrowserRecovery(storage, tasks) {
    const existing = readBrowserRecovery(storage)
    const merged = Object.fromEntries(existing.map(task => [task.id, task]))
    for (const candidate of tasks) {
        const task = normalizeTask(candidate.id, candidate)
        if (!task) throw new Error("Invalid task")
        if (!Object.hasOwn(merged, task.id)) merged[task.id] = task
    }
    storage.setItem(BROWSER_RECOVERY_KEY, JSON.stringify({ version: 1, tasks: merged }))
}
