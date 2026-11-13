import { createRecurringTask } from "./recurrence.js"

export function draftFromTask(task) {
    return {
        id: task.id,
        title: task.title,
        recurring: Boolean(task.recurrence),
        frequency: task.recurrence?.frequency ?? "weekly",
        target: String(task.recurrence?.targetCount ?? 3)
    }
}

// Returns the edited task. Completion history is always kept, so a session recorded
// before switching e.g. weekly -> monthly still counts in the new period.
export function applyTaskEdit(current, draft, { now = Date.now(), durationMinutes = 30, timezone = "Atlantic/Madeira" } = {}) {
    const title = String(draft.title ?? "").trim()
    if (!title) throw Object.assign(new Error("Empty title"), { code: "empty-title" })
    const next = { ...current, title, updatedAt: now }
    if (draft.recurring) {
        const targetCount = Number(draft.target)
        if (!Number.isInteger(targetCount) || targetCount < 1) throw Object.assign(new Error("Invalid target"), { code: "invalid-target" })
        const base = current.recurrence ?? {}
        next.recurrence = createRecurringTask({ id: current.id ?? "edit", title, durationMinutes: base.durationMinutes ?? durationMinutes, targetCount, timezone: base.timezone ?? timezone, frequency: draft.frequency }).recurrence
        next.completionEvents = current.completionEvents ?? []
    } else {
        delete next.recurrence
    }
    return next
}
