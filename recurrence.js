export const RECURRENCE_FREQUENCIES = ["weekly", "monthly", "yearly"]
export const PERIOD_LABELS = { weekly: "esta semana", monthly: "este mês", yearly: "este ano" }

export function createRecurringTask({ id, title, durationMinutes, targetCount, timezone = "Atlantic/Madeira", frequency = "weekly" }) {
    if (!id || typeof title !== "string" || !title.trim() || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isInteger(targetCount) || targetCount <= 0 || typeof timezone !== "string" || !RECURRENCE_FREQUENCIES.includes(frequency)) throw new Error("Invalid recurring task")
    return { id, title, completed: false, recurrence: { frequency, targetCount, durationMinutes, timezone }, completionEvents: [] }
}

export function recordCompletion(task, { taskId, eventId, occurredAt }) {
    if (!taskId || !eventId || occurredAt === undefined || Number.isNaN(new Date(occurredAt).getTime())) throw new Error("taskId, eventId and occurredAt are required")
    if (task.completionEvents.some(event => event.id === eventId)) return task
    return { ...task, completionEvents: [...task.completionEvents, { id: eventId, taskId, occurredAt }] }
}

export function weeklyProgress(task, weekStart) {
    return countProgress(task, parseInstant(weekStart), nextLocalWeekBoundary(weekStart, task.recurrence.timezone))
}

// Progress in the weekly, monthly or yearly period that starts at periodStart (local midnight).
export function periodProgress(task, periodStart) {
    const { frequency, timezone } = task.recurrence
    if (frequency === "weekly") return weeklyProgress(task, periodStart)
    const { year, month } = localDate(new Date(parseInstant(periodStart)), timezone)
    const next = frequency === "monthly" ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1))
    return countProgress(task, parseInstant(periodStart), zonedMidnightToInstant(next, timezone))
}

// Weeks start on Monday, months on the 1st and years on 1 January, at local midnight.
export function getPeriodStartForInstant(instant, timezone, frequency = "weekly") {
    if (frequency === "weekly") return getWeekStartForInstant(instant, timezone)
    const { year, month } = localDate(new Date(parseInstant(instant)), timezone)
    const start = frequency === "monthly" ? new Date(Date.UTC(year, month - 1, 1)) : new Date(Date.UTC(year, 0, 1))
    return new Date(zonedMidnightToInstant(start, timezone)).toISOString()
}

export function currentProgress(task, instant = new Date().toISOString()) {
    return periodProgress(task, getPeriodStartForInstant(instant, task.recurrence.timezone, task.recurrence.frequency))
}

function countProgress(task, start, end) {
    const count = task.completionEvents.filter(event => {
        const timestamp = new Date(event.occurredAt).getTime()
        return timestamp >= start && timestamp < end
    }).length
    return { doneCount: count, targetCount: task.recurrence.targetCount, remaining: Math.max(task.recurrence.targetCount - count, 0) }
}

function localDate(date, timezone) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
    return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]))
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

export function suggestReplan(task, periodStart) {
    const progress = periodProgress(task, periodStart)
    if (!progress.remaining) return null
    return { kind: "replan", taskId: task.id, message: `Ainda tens ${progress.remaining} sessão(ões) de ${task.title} pendente(s) ${PERIOD_LABELS[task.recurrence.frequency]}. Queres reservar ${task.recurrence.durationMinutes} minutos ou adiar?`, progress }
}
