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
        console.error(error)
    }
})
