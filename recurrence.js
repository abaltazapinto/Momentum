export function createRecurringTask({ id, title, durationMinutes, targetCount, timezone = "Atlantic/Madeira" }) {
    if (!id || typeof title !== "string" || !title.trim() || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isInteger(targetCount) || targetCount <= 0 || typeof timezone !== "string") throw new Error("Invalid recurring task")
    return { id, title, completed: false, recurrence: { frequency: "weekly", targetCount, durationMinutes, timezone }, completionEvents: [] }
}

export function recordCompletion(task, { eventId, occurredAt }) {
    if (!eventId || occurredAt === undefined || Number.isNaN(new Date(occurredAt).getTime())) throw new Error("eventId and occurredAt are required")
    if (task.completionEvents.some(event => event.id === eventId)) return task
    return { ...task, completionEvents: [...task.completionEvents, { id: eventId, taskId: task.id, occurredAt }] }
}

export function weeklyProgress(task, weekStart) {
    const start = new Date(weekStart).getTime()
    const end = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000).getTime()
    const count = task.completionEvents.filter(event => {
        const timestamp = new Date(event.occurredAt).getTime()
        return timestamp >= start && timestamp < end
    }).length
    return { doneCount: count, targetCount: task.recurrence.targetCount, remaining: Math.max(task.recurrence.targetCount - count, 0) }
}

export function suggestReplan(task, weekStart) {
    const progress = weeklyProgress(task, weekStart)
    if (!progress.remaining) return null
    return { kind: "replan", taskId: task.id, message: `Ainda tens ${progress.remaining} sessão(ões) de ${task.title} pendente(s) esta semana. Queres reservar ${task.recurrence.durationMinutes} minutos ou adiar?`, progress }
}
