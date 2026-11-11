export function createRecurringTask({ id, title, durationMinutes, targetCount, timezone = "Atlantic/Madeira" }) {
    if (!id || typeof title !== "string" || !title.trim() || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isInteger(targetCount) || targetCount <= 0 || typeof timezone !== "string") throw new Error("Invalid recurring task")
    return { id, title, completed: false, recurrence: { frequency: "weekly", targetCount, durationMinutes, timezone }, completionEvents: [] }
}

export function recordCompletion(task, { taskId, eventId, occurredAt }) {
    if (!taskId || !eventId || occurredAt === undefined || Number.isNaN(new Date(occurredAt).getTime())) throw new Error("taskId, eventId and occurredAt are required")
    if (task.completionEvents.some(event => event.id === eventId)) return task
    return { ...task, completionEvents: [...task.completionEvents, { id: eventId, taskId, occurredAt }] }
}

export function weeklyProgress(task, weekStart) {
    const start = parseInstant(weekStart)
    const end = nextLocalWeekBoundary(weekStart, task.recurrence.timezone)
    const count = task.completionEvents.filter(event => {
        const timestamp = new Date(event.occurredAt).getTime()
        return timestamp >= start && timestamp < end
    }).length
    return { doneCount: count, targetCount: task.recurrence.targetCount, remaining: Math.max(task.recurrence.targetCount - count, 0) }
}

export function getWeekStartForInstant(instant, timezone) {
    const date = new Date(parseInstant(instant))
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]))
    const local = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
    const day = local.getUTCDay() || 7
    local.setUTCDate(local.getUTCDate() - day + 1)
    return new Date(zonedMidnightToInstant(local, timezone)).toISOString()
}

function parseInstant(value) {
    const timestamp = new Date(value).getTime()
    if (Number.isNaN(timestamp)) throw new Error("weekStart must be a valid date")
    return timestamp
}

function nextLocalWeekBoundary(weekStart, timezone) {
    const date = new Date(parseInstant(weekStart))
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date)
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]))
    const local = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 0, 0, 0))
    local.setUTCDate(local.getUTCDate() + 7)
    return zonedMidnightToInstant(local, timezone)
}

function zonedMidnightToInstant(localDate, timezone) {
    const guess = localDate.getTime()
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess))
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]))
    const rendered = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second))
    return guess - (rendered - guess)
}

export function suggestReplan(task, weekStart) {
    const progress = weeklyProgress(task, weekStart)
    if (!progress.remaining) return null
    return { kind: "replan", taskId: task.id, message: `Ainda tens ${progress.remaining} sessão(ões) de ${task.title} pendente(s) esta semana. Queres reservar ${task.recurrence.durationMinutes} minutos ou adiar?`, progress }
}
