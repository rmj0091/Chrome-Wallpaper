document.addEventListener("DOMContentLoaded", () => {
    try {
        setTimeout(() => {
            const checkJsLoad = document.getElementById("checkJsLoad")
            const time = document.getElementById("time")
            const date = document.getElementById("date")
            const greeting = document.getElementById("greeting")

            if (checkJsLoad) {
                showNotification("자바스크립트 로드에 실패했어요.", "r", false)
            }
            if (time.innerText === "")
                showNotification("시간 로드에 실패했어요.", "r", false)
            if (date.innerText === "")
                showNotification("날짜 로드에 실패했어요.", "r", false)
            if (greeting.innerText === "")
                showNotification("대사 로드에 실패했어요.", "r", false)
        }, 1000)
    } catch (error) {
        console.log(error)
    }
})

async function showNotification(msg, data = "w", time = 5, type) {
    let text = ""
    let color = ""
    const container = document.getElementById("notification-container")

    const notification = document.createElement("div")
    notification.className = "notification"
    if (data === "w") {
        color = "background-color: #fff;"
    }
    if (data === "y") {
        color = "background-color: #FFEB3B;"
    } else if (data === "b") {
        color = "background-color: #2196F3;"
    } else if (data === "g") {
        color = "background-color: #4CAF50;"
    } else if (data === "r") {
        color = "background-color: #F44336;"
    } else {
        text = data
    }
    if (type) {
        if (type === "birthDay") {
        }
    }

    const statusDot = `<span class="status-dot" style="${color}">${text}</span>`

    notification.innerHTML = `
        ${statusDot}
        <span class="close-btn">
            <span class="material-symbols-outlined">close</span>
        </span>
        ${msg}
    `

    notification
        .querySelector(".close-btn")
        .addEventListener("click", function () {
            notification.remove()
        })

    container.appendChild(notification)
    if (isChaBirthday || isUserBirthday) {
        notification.addEventListener("click", (e) => {
            if (e.target.closest(".close-btn")) return
            confetti({
                particleCount: 1000,
                spread: 200,
                origin: { y: 0.5 },
            })
        })
    }

    if (time !== false) {
        setTimeout(() => {
            notification.style.animation = "fadeOut 0.5s forwards"
            setTimeout(() => {
                notification.remove()
            }, 500)
        }, time * 1000)
    }
}
