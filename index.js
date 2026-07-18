import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js"
import { getDatabase, ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js"

const appSettings = {
    databaseURL: "https://compras-e2b70-default-rtdb.europe-west1.firebasedatabase.app"
}

const app = initializeApp(appSettings)
const database = getDatabase(app)
const tasksInDB = ref(database, "tasks")

const taskFormEl = document.getElementById("task-form")
const taskInputEl = document.getElementById("task-input")
const taskListEl = document.getElementById("task-list")

taskFormEl.addEventListener("submit", function(event) {
    event.preventDefault()

    const taskTitle = taskInputEl.value.trim()

    if (!taskTitle) {
        return
    }

    push(tasksInDB, taskTitle)

    clearTaskInput()
})

onValue(tasksInDB, function(snapshot) {
    if (snapshot.exists()) {
        const tasks = Object.entries(snapshot.val())

        clearTaskList()

        for (const task of tasks) {
            appendTaskToList(task)
        }
    } else {
        taskListEl.textContent = "No tasks here... yet."
    }
})

function clearTaskList() {
    taskListEl.textContent = ""
}

function clearTaskInput() {
    taskInputEl.value = ""
}

function appendTaskToList(task) {
    const [taskID, taskTitle] = task
    const taskEl = document.createElement("li")

    taskEl.textContent = taskTitle

    taskEl.addEventListener("dblclick", function() {
        const taskInDB = ref(database, `tasks/${taskID}`)

        remove(taskInDB)
    })

    taskListEl.append(taskEl)
}
