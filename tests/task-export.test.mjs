import assert from "node:assert/strict"
import test from "node:test"
import { createRecurringTask, recordCompletion } from "../recurrence.js"
import { parseTaskBackup } from "../task-recovery.js"
import { tasksToCsv, tasksToJson, tasksToText } from "../task-export.js"

const now = new Date("2026-11-13T12:00:00Z")
const gym = recordCompletion({ ...createRecurringTask({ id: "gym", title: "Ginásio", durationMinutes: 30, targetCount: 3, timezone: "Atlantic/Madeira" }), createdAt: Date.parse("2026-11-01T10:00:00Z") }, { taskId: "gym", eventId: "e1", occurredAt: "2026-11-12T19:00:00Z" })
const rent = { ...createRecurringTask({ id: "rent", title: "Pagar renda", durationMinutes: 30, targetCount: 1, timezone: "Atlantic/Madeira", frequency: "monthly" }), createdAt: null }
const tasks = [
    { id: "a", title: "Comprar pão", completed: false, createdAt: Date.parse("2026-11-10T09:00:00Z") },
    gym,
    rent,
    { id: "b", title: "Ligar à avó", completed: true, createdAt: null }
]

test("text list is ready to paste in WhatsApp", () => {
    assert.equal(tasksToText(tasks, now), [
        "*As minhas tarefas* (13/11/2026)",
        "",
        "*Por fazer*",
        "• Comprar pão",
        "• Ginásio (1/3 esta semana)",
        "• Pagar renda (0/1 este mês)",
        "",
        "*Concluídas*",
        "✓ Ligar à avó"
    ].join("\n"))
    assert.match(tasksToText([], now), /Ainda não há tarefas/)
})

test("CSV has one row per task, Excel-friendly separator and accents", () => {
    const csv = tasksToCsv(tasks, now)
    assert.ok(csv.startsWith("﻿"), "BOM so Excel reads accents")
    const rows = csv.slice(1).trimEnd().split("\r\n").map(row => row.split(";"))
    assert.deepEqual(rows[0], ["Tarefa", "Estado", "Repetição", "Meta por período", "Feitas neste período", "Total de sessões", "Última sessão", "Criada em"])
    assert.deepEqual(rows[1], ["Comprar pão", "Por fazer", "", "", "", "0", "", "2026-11-10"])
    assert.deepEqual(rows[2], ["Ginásio", "Por fazer", "Semanal", "3", "1", "1", "2026-11-12", "2026-11-01"])
    assert.deepEqual(rows[3], ["Pagar renda", "Por fazer", "Mensal", "1", "0", "0", "", ""])
    assert.deepEqual(rows[4], ["Ligar à avó", "Concluída", "", "", "", "0", "", ""])
})

test("CSV quotes separators and neutralises spreadsheet formulas", () => {
    const csv = tasksToCsv([{ id: "x", title: '=HYPERLINK("x");"y"', completed: false }, { id: "y", title: "-30 min", completed: false }], now)
    const lines = csv.slice(1).split("\r\n")
    assert.ok(lines[1].startsWith(`"'=HYPERLINK(""x"");""y"""`))
    assert.ok(lines[2].startsWith("'-30 min;"))
})

test("JSON export can be imported back without changes", () => {
    const backup = JSON.parse(tasksToJson(tasks, now))
    assert.equal(backup.exportedAt, now.toISOString())
    assert.deepEqual(parseTaskBackup(backup).map(task => task.id), ["a", "gym", "rent", "b"])
})
