// What a delete confirmation refers to is fixed when the dialog opens:
// the task's immutable ID, the owner's UID and the session it was opened in.
export function createDeleteRequest(task, uid, sessionVersion) {
    return { taskId: task.id, title: task.title, uid, sessionVersion }
}

// Database path to remove on confirmation, or null when the request no longer
// applies (another account or session, or the task is already gone).
export function deleteTargetPath(request, { uid, sessionVersion, tasks }) {
    if (!request || !uid || request.uid !== uid || request.sessionVersion !== sessionVersion) return null
    if (!tasks.some(task => task.id === request.taskId)) return null
    return `users/${request.uid}/tasks/${request.taskId}`
}

// The second click of a double-click (or a tap that lands as the dialog opens)
// must not act on the dialog.
export function isSameGestureAsOpen(event, openedAt, windowMs = 400) {
    return event.detail > 1 || event.timeStamp - openedAt < windowMs
}
