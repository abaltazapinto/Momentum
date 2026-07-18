import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js"
import { getDatabase, ref, push, onValue, remove, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js"

const appSettings = {
    databaseURL: "https://compras-e2b70-default-rtdb.europe-west1.firebasedatabase.app"
}

const app = initializeApp(appSettings)
const database = getDatabase(app)
const tasksInDB = ref(database, "tasks")

const taskFormEl = document.getElementById("task-form")
const taskInputEl = document.getElementById("task-input")
const addTaskButtonEl = document.getElementById("add-task-button")
const taskStatusEl = document.getElementById("task-status")
const taskListEl = document.getElementById("task-list")

const state = {
    tasks: [],
    isCreatingTask: false
}

taskFormEl.addEventListener("submit", async function(event) {
    event.preventDefault()

    const taskTitle = taskInputEl.value.trim()

    if (!taskTitle || state.isCreatingTask) {
        return
    }

    setCreatingTask(true)
    clearStatus()

    try {
        await push(tasksInDB, {
            title: taskTitle,
            completed: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        })

        clearTaskInput()
        taskInputEl.focus()
    } catch (error) {
        showError("We couldn't add that task. Please try again.")
        console.error("Failed to create task:", error)
    } finally {
        setCreatingTask(false)
    }
})

onValue(tasksInDB, function(snapshot) {
    if (snapshot.exists()) {
        state.tasks = Object.entries(snapshot.val())
            .map(([taskID, value]) => normalizeTask(taskID, value))
            .filter(Boolean)
    } else {
        state.tasks = []
    }

    renderTasks()
}, function(error) {
    showError("We couldn't load your tasks. Please refresh and try again.")
    console.error("Failed to load tasks:", error)
})

taskListEl.addEventListener("change", async function(event) {
    const checkbox = event.target.closest('[data-action="toggle-task"]')

    if (!checkbox) {
        return
    }

    const taskEl = checkbox.closest("[data-task-id]")
    const task = state.tasks.find(({ id }) => id === taskEl?.dataset.taskId)

    if (!task) {
        return
    }

    checkbox.disabled = true
    clearStatus()

    try {
        await update(ref(database, `tasks/${task.id}`), {
            title: task.title,
            completed: checkbox.checked,
            createdAt: task.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp()
        })
    } catch (error) {
        checkbox.checked = task.completed
        checkbox.disabled = false
        showError("We couldn't update that task. Please try again.")
        console.error("Failed to update task:", error)
    }
})

taskListEl.addEventListener("click", async function(event) {
    const deleteButton = event.target.closest('[data-action="delete-task"]')

    if (!deleteButton) {
        return
    }

    const taskEl = deleteButton.closest("[data-task-id]")
    const taskID = taskEl?.dataset.taskId

    if (!taskID) {
        return
    }

    deleteButton.disabled = true
    clearStatus()

    try {
        await remove(ref(database, `tasks/${taskID}`))
    } catch (error) {
        deleteButton.disabled = false
        showError("We couldn't delete that task. Please try again.")
        console.error("Failed to delete task:", error)
    }
})

function normalizeTask(id, value) {
    if (typeof value === "string") {
        const title = value.trim()

        return title ? { id, title, completed: false, createdAt: null } : null
    }

    if (!value || typeof value !== "object" || typeof value.title !== "string") {
        return null
    }

    const title = value.title.trim()

    if (!title) {
        return null
    }

    return {
        id,
        title,
        completed: value.completed === true,
        createdAt: typeof value.createdAt === "number" ? value.createdAt : null
    }
}

function renderTasks() {
    taskListEl.textContent = ""

    if (state.tasks.length === 0) {
        const emptyStateEl = document.createElement("li")
        emptyStateEl.className = "task-list__empty"
        emptyStateEl.textContent = "No tasks here... yet."
        taskListEl.append(emptyStateEl)
        return
    }

    const fragment = document.createDocumentFragment()

    for (const task of state.tasks) {
        fragment.append(createTaskElement(task))
    }

    taskListEl.append(fragment)
}

function createTaskElement(task) {
    const taskEl = document.createElement("li")
    taskEl.className = "task"
    taskEl.dataset.taskId = task.id

    if (task.completed) {
        taskEl.classList.add("task--completed")
    }

    const checkboxEl = document.createElement("input")
    checkboxEl.className = "task__checkbox"
    checkboxEl.type = "checkbox"
    checkboxEl.checked = task.completed
    checkboxEl.dataset.action = "toggle-task"
    checkboxEl.setAttribute("aria-label", `Mark ${task.title} as ${task.completed ? "active" : "complete"}`)

    const titleEl = document.createElement("span")
    titleEl.className = "task__title"
    titleEl.textContent = task.title

    const deleteButtonEl = document.createElement("button")
    deleteButtonEl.className = "task__delete-button"
    deleteButtonEl.type = "button"
    deleteButtonEl.dataset.action = "delete-task"
    deleteButtonEl.setAttribute("aria-label", `Delete ${task.title}`)
    deleteButtonEl.textContent = "Delete"

    taskEl.append(checkboxEl, titleEl, deleteButtonEl)

    return taskEl
}

function clearTaskInput() {
    taskInputEl.value = ""
}

function setCreatingTask(isCreatingTask) {
    state.isCreatingTask = isCreatingTask
    addTaskButtonEl.disabled = isCreatingTask
    addTaskButtonEl.textContent = isCreatingTask ? "Adding..." : "Add task"
}

function clearStatus() {
    taskStatusEl.textContent = ""
    taskStatusEl.classList.remove("task-status--error")
}

function showError(message) {
    taskStatusEl.textContent = message
    taskStatusEl.classList.add("task-status--error")
}
