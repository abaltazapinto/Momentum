import { currentProgress, PERIOD_LABELS } from "./recurrence.js"

const FREQUENCY_NAMES = { weekly: "Semanal", monthly: "Mensal", yearly: "Anual" }
const TIMEZONE = "Atlantic/Madeira"
const isoDay = (value, timeZone = TIMEZONE) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value))
const progressLabel = (task, now) => {
    const progress = currentProgress(task, now.toISOString())
    return `${progress.doneCount}/${progress.targetCount} ${PERIOD_LABELS[task.recurrence.frequency]}`
}

// Plain-text list for WhatsApp and similar apps (*bold* is WhatsApp formatting).
export function tasksToText(tasks, now = new Date()) {
    const line = task => task.recurrence ? `${task.title} (${progressLabel(task, now)})` : task.title
    const pending = tasks.filter(task => !task.completed), done = tasks.filter(task => task.completed)
    const date = new Intl.DateTimeFormat("pt-PT", { timeZone: TIMEZONE }).format(now)
    const sections = [`*As minhas tarefas* (${date})`]
    if (pending.length) sections.push(["*Por fazer*", ...pending.map(task => `• ${line(task)}`)].join("\n"))
    if (done.length) sections.push(["*Concluídas*", ...done.map(task => `✓ ${line(task)}`)].join("\n"))
    if (!tasks.length) sections.push("Ainda não há tarefas.")
    return sections.join("\n\n")
}

// One row per task. ";" + BOM so Excel in Portuguese opens it in columns with accents;
// Google Sheets detects the separator on import.
export function tasksToCsv(tasks, now = new Date()) {
    const header = ["Tarefa", "Estado", "Repetição", "Meta por período", "Feitas neste período", "Total de sessões", "Última sessão", "Criada em"]
    const rows = tasks.map(task => {
        const events = task.completionEvents ?? []
        const progress = task.recurrence ? currentProgress(task, now.toISOString()) : null
        const last = events.map(event => new Date(event.occurredAt).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0]
        return [
            task.title,
            task.completed ? "Concluída" : "Por fazer",
            task.recurrence ? FREQUENCY_NAMES[task.recurrence.frequency] : "",
            progress ? progress.targetCount : "",
            progress ? progress.doneCount : "",
            events.length,
            last ? isoDay(last) : "",
            typeof task.createdAt === "number" ? isoDay(task.createdAt) : ""
        ]
    })
    return "﻿" + [header, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n") + "\r\n"
}

export function tasksToJson(tasks, now = new Date()) {
    return JSON.stringify({ version: 1, exportedAt: now.toISOString(), tasks: Object.fromEntries(tasks.map(task => [task.id, task])) }, null, 2)
}

function csvCell(value) {
    let text = String(value)
    // Spreadsheets run cells starting with these characters as formulas.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
