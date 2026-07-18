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
const themeToggleEl = document.getElementById("theme-toggle")

const themeStorageKey = "momentum-theme"
const lucideIconNodes = {
    check: [
        ["path", { d: "M20 6 9 17l-5-5" }]
    ],
    square: [
        ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }]
    ],
    squareCheckBig: [
        ["path", { d: "M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344" }],
        ["path", { d: "m9 11 3 3L22 4.5" }]
    ],
    trash2: [
        ["path", { d: "M3 6h18" }],
        ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
        ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }],
        ["line", { x1: "10", x2: "10", y1: "11", y2: "17" }],
        ["line", { x1: "14", x2: "14", y1: "11", y2: "17" }]
    ]
}

const state = {
    tasks: [],
    isCreatingTask: false,
    isLoadingTasks: true
}

renderTasks()
updateThemeToggle()

requestAnimationFrame(function() {
    document.documentElement.classList.add("theme-ready")
})

themeToggleEl.addEventListener("click", function() {
    const nextTheme = getCurrentTheme() === "light" ? "dark" : "light"

    document.documentElement.dataset.theme = nextTheme
    updateThemeToggle()

    try {
        localStorage.setItem(themeStorageKey, nextTheme)
    } catch (error) {
        console.warn("Theme preference could not be saved.", error)
    }
})

taskInputEl.addEventListener("invalid", function(event) {
    event.preventDefault()
    showError("Please enter a task.")
    taskInputEl.focus()
})

taskFormEl.addEventListener("submit", async function(event) {
    event.preventDefault()

    const taskTitle = taskInputEl.value.trim()

    if (state.isCreatingTask) {
        return
    }

    if (!taskTitle) {
        showError("Please enter a task.")
        taskInputEl.focus()
        return
    }

    clearStatus()
    setCreatingTask(true)

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

    state.isLoadingTasks = false
    renderTasks()
}, function(error) {
    state.isLoadingTasks = false
    taskListEl.textContent = ""
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

function getCurrentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light"
}

function updateThemeToggle() {
    const nextTheme = getCurrentTheme() === "light" ? "dark" : "light"

    themeToggleEl.setAttribute("aria-label", `Switch to ${nextTheme} mode`)
    themeToggleEl.title = `Switch to ${nextTheme} mode`
}

function renderTasks() {
    taskListEl.textContent = ""

    if (state.isLoadingTasks) {
        taskListEl.append(createLoadingStateElement())
        return
    }

    if (state.tasks.length === 0) {
        taskListEl.append(createEmptyStateElement())
        return
    }

    const fragment = document.createDocumentFragment()

    for (const task of state.tasks) {
        fragment.append(createTaskElement(task))
    }

    taskListEl.append(fragment)
}

function createLoadingStateElement() {
    const loadingStateEl = document.createElement("li")
    loadingStateEl.className = "task-list__loading"
    loadingStateEl.setAttribute("role", "status")

    const spinnerEl = document.createElement("span")
    spinnerEl.className = "task-list__loading-spinner"
    spinnerEl.setAttribute("aria-hidden", "true")

    const messageEl = document.createElement("span")
    messageEl.textContent = "Loading tasks..."

    loadingStateEl.append(spinnerEl, messageEl)

    return loadingStateEl
}

function createEmptyStateElement() {
    const emptyStateEl = document.createElement("li")
    emptyStateEl.className = "task-list__empty"
    emptyStateEl.setAttribute("role", "status")

    const iconEl = document.createElement("span")
    iconEl.className = "task-list__empty-icon"
    iconEl.setAttribute("aria-hidden", "true")

    const checkIconEl = createLucideIcon("check")
    iconEl.append(checkIconEl)

    const titleEl = document.createElement("h2")
    titleEl.className = "task-list__empty-title"
    titleEl.textContent = "No tasks yet"

    const messageEl = document.createElement("p")
    messageEl.className = "task-list__empty-message"
    messageEl.textContent = "Add your first task above to get started."

    emptyStateEl.append(iconEl, titleEl, messageEl)

    return emptyStateEl
}

function createTaskElement(task) {
    const taskEl = document.createElement("li")
    taskEl.className = "task"
    taskEl.dataset.taskId = task.id

    if (task.completed) {
        taskEl.classList.add("task--completed")
    }

    const checkboxControlEl = document.createElement("span")
    checkboxControlEl.className = "task__checkbox-control"

    const checkboxEl = document.createElement("input")
    checkboxEl.className = "task__checkbox"
    checkboxEl.type = "checkbox"
    checkboxEl.checked = task.completed
    checkboxEl.dataset.action = "toggle-task"
    checkboxEl.setAttribute("aria-label", `Mark ${task.title} as ${task.completed ? "active" : "complete"}`)

    const uncheckedIconEl = createLucideIcon(
        "square",
        "task__checkbox-icon task__checkbox-icon--unchecked"
    )
    const checkedIconEl = createLucideIcon(
        "squareCheckBig",
        "task__checkbox-icon task__checkbox-icon--checked"
    )

    checkboxControlEl.append(checkboxEl, uncheckedIconEl, checkedIconEl)

    const titleEl = document.createElement("span")
    titleEl.className = "task__title"
    titleEl.textContent = task.title

    const deleteButtonEl = document.createElement("button")
    deleteButtonEl.className = "task__delete-button"
    deleteButtonEl.type = "button"
    deleteButtonEl.dataset.action = "delete-task"
    deleteButtonEl.setAttribute("aria-label", "Delete task")

    const deleteIconEl = createLucideIcon("trash2", "task__delete-icon")
    deleteButtonEl.append(deleteIconEl)

    taskEl.append(checkboxControlEl, titleEl, deleteButtonEl)

    return taskEl
}

function createLucideIcon(iconName, className = "") {
    const iconEl = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    iconEl.setAttribute("class", `lucide ${className}`.trim())
    iconEl.setAttribute("viewBox", "0 0 24 24")
    iconEl.setAttribute("aria-hidden", "true")

    for (const [elementName, attributes] of lucideIconNodes[iconName]) {
        const iconNodeEl = document.createElementNS("http://www.w3.org/2000/svg", elementName)

        for (const [attributeName, value] of Object.entries(attributes)) {
            iconNodeEl.setAttribute(attributeName, value)
        }

        iconEl.append(iconNodeEl)
    }

    return iconEl
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
