const STORAGE_KEYS = {
    IS_PLAYING: "isPlaying",
    USERNAME: "username",
    VOLUME: "volume",
    SHORTCUTS: "shortcuts",
    IMAGE_MODE: "checkBox1",
    AUTO_UPDATE: "autoUpdateCheck",
    GREETING_ENABLED: "greetingEnabled",
    SEARCH_HISTORY: "searchHistory",
}

const DEFAULTS = {
    VOLUME: 0.2,
    SHORTCUTS: [
        { name: "Github", url: "https://github.com" },
        { name: "Youtube", url: "https://www.youtube.com" },
        { name: "X", url: "https://x.com" },
    ],
    UPDATE_URL:
        "https://raw.githubusercontent.com/rmj0091/Chrome-Wallpaper/refs/heads/main/manifest.json",
}

const state = {
    isPlaying: localStorage.getItem(STORAGE_KEYS.IS_PLAYING) === "true",
    volume:
        parseFloat(localStorage.getItem(STORAGE_KEYS.VOLUME)) ||
        DEFAULTS.VOLUME,
    isImageMode: localStorage.getItem(STORAGE_KEYS.IMAGE_MODE) === "true",
    isAutoUpdateEnabled:
        localStorage.getItem(STORAGE_KEYS.AUTO_UPDATE) !== "false",
    isGreetingEnabled:
        localStorage.getItem(STORAGE_KEYS.GREETING_ENABLED) !== "false",
    username: "",
    isChaBirthday: false,
    isUserBirthday: false,
}

const $ = (id) => document.getElementById(id)

function safeParseJSON(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback
    } catch {
        return fallback
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function highlightMatch(text, query) {
    if (!query) return escapeHtml(text)

    const escapedQuery = String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(escapedQuery, "gi")

    return escapeHtml(text).replace(
        regex,
        (match) => `<strong>${match}</strong>`,
    )
}

function setStorage(key, value) {
    localStorage.setItem(key, value)
}

function setStorageJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
}

async function loadConfig() {
    if (window.__configCache) return window.__configCache
    const response = await fetch("./config.json")
    window.__configCache = await response.json()
    return window.__configCache
}

function isValidUrl(value) {
    const urlRegex = /^(https?):\/\/[\w\-]+(\.[\w\-]+)+[/#?]?.*$/
    return urlRegex.test(value)
}

function fetchHistory(query) {
    return new Promise((resolve, reject) => {
        if (!chrome?.runtime?.sendMessage) {
            reject(new Error("Chrome runtime messaging is not available"))
            return
        }

        chrome.runtime.sendMessage(
            { type: "getHistory", query },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message))
                    return
                }
                resolve(response?.results || [])
            },
        )
    })
}

function fetchVersion() {
    return new Promise((resolve, reject) => {
        if (!chrome?.runtime?.sendMessage) {
            reject(new Error("Chrome runtime messaging is not available"))
            return
        }

        chrome.runtime.sendMessage({ type: "getVersion" }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
                return
            }
            resolve(response?.version || "Unknown")
        })
    })
}

function fetchLatestVersion() {
    return fetch(DEFAULTS.UPDATE_URL)
        .then((res) => res.json())
        .then((data) => data.version)
        .catch(() => null)
}

function checkUpdate() {
    if (!state.isAutoUpdateEnabled) return

    Promise.all([fetchVersion(), fetchLatestVersion()])
        .then(([current, latest]) => {
            if (!latest) {
                return
            }
            if (current !== latest) {
                showNotification(
                    `새 버전이 출시되었어요! 현재 버전: ${current}, 최신 버전: ${latest}`,
                    "info",
                    15,
                )
            }
        })
        .catch((err) => {
            showNotification("업데이트 확인 중 오류가 발생했어요.", "error")
            console.log(err)
        })
}

function getSearchHistory() {
    return safeParseJSON(localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY), [])
}

function addSearchHistory(term) {
    const value = term.trim()
    if (!value) return

    const items = getSearchHistory().filter(
        (t) => t.toLowerCase() !== value.toLowerCase(),
    )
    items.unshift(value)
    localStorage.setItem(
        STORAGE_KEYS.SEARCH_HISTORY,
        JSON.stringify(items.slice(0, 20)),
    )
}

function performSearch(value) {
    if (!value) return
    if (isValidUrl(value)) {
        window.location.href = value
        return
    }

    addSearchHistory(value)
    const query = encodeURIComponent(value)
    window.location.href = `https://www.google.com/search?q=${query}`
}

function renderHistorySuggestions(items, query = "") {
    if (query.length === 0) renderSearchHistoryTerms(getSearchHistory())

    const container = $("historySuggestions")
    if (!container) return

    container.innerHTML = ""
    const hasQuery = Boolean(query?.trim())
    const hasItems = Array.isArray(items) && items.length > 0

    if (!hasQuery && !hasItems) {
        container.classList.add("hidden")
        return
    }

    container.classList.remove("hidden")

    const googleSearchItem = hasQuery
        ? {
              id: "google-search",
              query,
              title: `Google에서 “${query}” 검색`,
              url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
              isSearch: true,
              lastVisitTime: Date.now(),
          }
        : null

    const historyItems = (items || [])
        .filter(Boolean)
        .sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0))

    const seenUrls = new Set()
    if (googleSearchItem) {
        seenUrls.add(googleSearchItem.url)
    }

    const list = []
    historyItems.forEach((item) => {
        const url = item.url || ""
        if (!url || seenUrls.has(url)) return
        seenUrls.add(url)
        list.push(item)
    })

    // google.com/search 도메인은 우선순위 상위로 정렬
    list.sort((a, b) => {
        const aIsGoogle = a.url?.startsWith("https://www.google.com/search")
        const bIsGoogle = b.url?.startsWith("https://www.google.com/search")
        if (aIsGoogle !== bIsGoogle) return aIsGoogle ? -1 : 1
        return (b.lastVisitTime || 0) - (a.lastVisitTime || 0)
    })

    const maxItems = 7
    list.splice(maxItems)

    const getItemIcon = (item) => {
        if (item.isSearch) return "search"
        if (item.lastVisitTime) return "history"
        return "public"
    }

    const createFavicon = (url) => {
        try {
            const hostname = new URL(url).hostname
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
        } catch {
            return ""
        }
    }

    // 구글 검색 항목은 항상 최상단에 표시
    if (googleSearchItem) {
        const entry = document.createElement("div")
        entry.className = "item"
        const titleHtml = highlightMatch(googleSearchItem.title, query)
        entry.innerHTML = `
            <span class="item-icon material-symbols-outlined">search</span>
            <div class="item-text">
                <div class="item-title">${titleHtml}</div>
            </div>
        `
        entry.addEventListener("click", () => {
            const input = $("search")
            input.value = googleSearchItem.query
            performSearch(googleSearchItem.query)
            renderHistorySuggestions([], "")
        })
        container.appendChild(entry)
    }

    list.forEach((item) => {
        const url = item.url || ""
        const title = item.title || url
        const titleHtml = highlightMatch(title, query)
        const entry = document.createElement("div")
        entry.className = "item"

        const isGoogleSearchUrl = url.startsWith(
            "https://www.google.com/search",
        )
        const faviconUrl = createFavicon(url)

        entry.innerHTML = `
            ${
                isGoogleSearchUrl
                    ? '<span class="item-icon material-symbols-outlined">history</span>'
                    : `<img class="item-icon favicon" src="${faviconUrl}" alt="" />`
            }
            <div class="item-text">
                <div class="item-title">${titleHtml}</div>
                ${isGoogleSearchUrl ? "" : `<div class="item-url">${url}</div>`}
            </div>
        `

        entry.addEventListener("click", () => {
            const input = $("search")
            input.value = url
            performSearch(url)
            renderHistorySuggestions([], "")
        })

        container.appendChild(entry)
    })
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`
}

function setImageMode(enabled) {
    const video = $("bg-video")
    const image = $("bg-image")

    state.isImageMode = Boolean(enabled)
    setStorage(STORAGE_KEYS.IMAGE_MODE, state.isImageMode)

    if (state.isImageMode) {
        video?.classList.add("hidden")
        image?.classList.remove("hidden")
        createGreeting(false)
        if (state.isPlaying) {
            showNotification(
                "완벽한 일반인 코스플레이를 위해 소리를 끄는 것도 잊지마세요!",
                "warning",
                10,
            )
        }
    } else {
        video?.classList.remove("hidden")
        image?.classList.add("hidden")
        createGreeting(true)
    }
}

function showNotification(message, variant = "default", duration = 5) {
    const container = $("notification-container")
    if (!container) return

    const colorMap = {
        default: "#fff",
        warning: "#FFEB3B",
        info: "#2196F3",
        success: "#4CAF50",
        error: "#F44336",
    }

    const color = colorMap[variant] || variant
    const notification = document.createElement("div")
    notification.className = "notification"

    notification.innerHTML = `
        <span class="status-dot" style="background-color: ${color}"></span>
        <span class="close-btn">
            <span class="material-symbols-outlined">close</span>
        </span>
        ${message}
    `

    notification
        .querySelector(".close-btn")
        ?.addEventListener("click", () => notification.remove())

    if (state.isChaBirthday || state.isUserBirthday) {
        notification.addEventListener("click", (event) => {
            if (event.target.closest(".close-btn")) return
            confetti({ particleCount: 1000, spread: 200, origin: { y: 0.5 } })
        })
    }

    container.appendChild(notification)

    if (duration !== false) {
        setTimeout(() => {
            notification.style.animation = "fadeOut 0.5s forwards"
            setTimeout(() => notification.remove(), 500)
        }, duration * 1000)
    }
}

function updateOnlineStatus() {
    showNotification(
        navigator.onLine
            ? "네트워크에 다시 연결되었어요."
            : "네트워크 연결이 끊어졌어요.",
        navigator.onLine ? "success" : "error",
    )
}

function initAudioControls() {
    const audio = $("bg-audio")
    const audioIcon = $("audioIcon")
    const volumeSlider = $("volumeSlider")
    const volumeText = $("volumeText")
    const playButton = $("toggleButton")

    if (!audio || typeof audio.play !== "function") {
        showNotification(
            "사용하시는 브라우저가 오디오 태그를 지원하지 않아요.",
            "error",
            10,
        )
        return
    }

    audio.volume = state.volume
    volumeSlider.value = state.volume
    volumeText.textContent = formatPercent(state.volume)
    audioIcon.textContent = state.isPlaying ? "volume_up" : "volume_off"

    if (state.isPlaying) {
        audio.play().catch((err) => console.error("Audio error:", err))
    }

    volumeSlider.addEventListener("input", () => {
        state.volume = parseFloat(volumeSlider.value)
        audio.volume = state.volume
        volumeText.textContent = formatPercent(state.volume)
        setStorage(STORAGE_KEYS.VOLUME, state.volume)
    })

    playButton.addEventListener("click", () => {
        if (audio.paused) {
            audio
                .play()
                .then(() => {
                    audioIcon.textContent = "volume_up"
                    state.isPlaying = true
                    setStorage(STORAGE_KEYS.IS_PLAYING, "true")
                })
                .catch((err) => console.error("Audio error:", err))
        } else {
            audio.pause()
            audioIcon.textContent = "volume_off"
            state.isPlaying = false
            setStorage(STORAGE_KEYS.IS_PLAYING, "false")
        }
    })
}

async function updateClock() {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    const seconds = String(now.getSeconds()).padStart(2, "0")

    $("time").textContent = `${hours}:${minutes}:${seconds}`
    if (hours === "00" && minutes === "00" && seconds === "00") {
        await updateDate()
    }
}

async function updateDate() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")

    const weekdays = [
        "일요일",
        "월요일",
        "화요일",
        "수요일",
        "목요일",
        "금요일",
        "토요일",
    ]

    $("date").textContent = `${year}.${month}.${day} ${weekdays[now.getDay()]}`

    const config = await loadConfig()

    const isToday = (value) => {
        if (!value) return false
        const [m, d] = value.split("/")
        return month === m && day === d
    }

    if (isToday(config.charBirthday)) {
        state.isChaBirthday = true
        showNotification("오늘은 내 생일이야. 축하해줘!", "default", false)
    }

    if (isToday(config.userBirthday)) {
        state.isUserBirthday = true
        showNotification(`${state.username}님 생일 축하해요!`, "default", false)
    }
}

async function createGreeting(show) {
    const greetingEl = $("greeting")
    if (!show || !state.isGreetingEnabled) {
        greetingEl.textContent = ""
        return
    }

    const config = await loadConfig()
    const hour = new Date().getHours()
    const list =
        hour >= 5 && hour < 12
            ? config.morning
            : hour < 18
              ? config.afternoon
              : config.evening

    const raw = list[Math.floor(Math.random() * list.length)]
    greetingEl.textContent = raw.replace("${username}", state.username)
}

function createShortcuts() {
    const container = $("shortcutContainer")
    const form = $("addShortcut")
    const nameInput = $("addName")
    const urlInput = $("addUrl")
    const closeBtn = $("closeShortcut")
    const appendBtn = $("appendShortcut")

    const stored = safeParseJSON(
        localStorage.getItem(STORAGE_KEYS.SHORTCUTS),
        DEFAULTS.SHORTCUTS,
    )

    const shortcuts = Array.isArray(stored) ? stored : [...DEFAULTS.SHORTCUTS]

    const saveShortcutData = (data) =>
        setStorageJSON(STORAGE_KEYS.SHORTCUTS, data)

    const toggleForm = (show) => {
        form.classList.toggle("flex", show)
        form.classList.toggle("none", !show)
    }

    const render = () => {
        container.innerHTML = ""

        shortcuts.forEach((link) => {
            const element = document.createElement("div")
            element.className = "link"
            element.innerHTML = `
                <a href="${link.url}" rel="noopener noreferrer" title="${link.url}" class="shortcutLink">
                    ${
                        navigator.onLine
                            ? `<img src="https://www.google.com/s2/favicons?domain=${link.url}&sz=48" />`
                            : `<img style="background-color: #fff0; border: none;" />`
                    }
                    <p>${link.name}</p>
                </a>
                <a class="removeLink" title="Delete ${link.name} shortcut" data-url="${link.url}">
                    <span class="material-symbols-outlined">close</span>
                </a>
            `
            container.appendChild(element)
        })

        const addElement = document.createElement("div")
        addElement.className = "link"
        addElement.innerHTML = `
            <a id="createShortcut" title="Add new shortcut" class="shortcutLink">
                <span class="material-symbols-outlined">add</span>
                <p>Add</p>
            </a>
        `
        container.appendChild(addElement)
    }

    const addShortcut = () => {
        const name = nameInput.value.trim()
        const url = urlInput.value.trim()

        if (!name || !url) {
            showNotification("이름과 링크를 모두 입력해주세요.", "warning")
            return
        }

        if (!isValidUrl(url)) {
            showNotification("유효한 링크를 입력해주세요.", "warning")
            return
        }

        shortcuts.push({ name, url })
        saveShortcutData(shortcuts)
        toggleForm(false)
        nameInput.value = ""
        urlInput.value = ""
        render()

        const particle = Hangul.endsWithConsonant(name) ? "이" : "가"
        showNotification(`${name}${particle} 추가되었습니다.`, "success")
    }

    const removeShortcut = (targetUrl) => {
        const index = shortcuts.findIndex((link) => link.url === targetUrl)
        if (index === -1) return
        shortcuts.splice(index, 1)
        saveShortcutData(shortcuts)
        render()
    }

    container.addEventListener("click", (event) => {
        const createBtn = event.target.closest("#createShortcut")
        if (createBtn) {
            toggleForm(true)
            return
        }

        const removeButton = event.target.closest(".removeLink")
        if (removeButton) {
            event.preventDefault()
            const targetUrl = removeButton.getAttribute("data-url")
            removeShortcut(targetUrl)
        }
    })

    closeBtn.addEventListener("click", () => toggleForm(false))
    appendBtn.addEventListener("click", addShortcut)

    render()
}

async function ensureUsername() {
    const stored = safeParseJSON(
        localStorage.getItem(STORAGE_KEYS.USERNAME),
        "",
    )
    state.username = stored || ""

    if (!state.username) {
        const input = prompt("당신의 이름을 알려주시겠어요?")
        if (input) {
            state.username = input.slice(0, 5)
            setStorageJSON(STORAGE_KEYS.USERNAME, state.username)
            showNotification(`${state.username}님 안녕하세요!`, "info")
        } else {
            const config = await loadConfig()
            state.username = config.defaultName
            setStorageJSON(STORAGE_KEYS.USERNAME, state.username)
        }
    }
}

function initSettings() {
    const settingsBtn = $("settingsButton")
    const settingsPanel = $("settingsPanel")
    const closeSettingsBtn = $("closeSettings")
    const nameInput = $("nameInput")
    const saveBtn = $("saveBtn")

    nameInput.value = state.username

    settingsBtn.addEventListener("click", () => {
        settingsPanel.classList.toggle("hidden")
    })

    closeSettingsBtn.addEventListener("click", () => {
        settingsPanel.classList.toggle("hidden")
    })

    function updateUsername(newName) {
        state.username = newName
        setStorageJSON(STORAGE_KEYS.USERNAME, newName)
        nameInput.value = newName
    }

    function handleNameUpdate() {
        const newName = nameInput.value.trim()
        if (newName === state.username) {
            showNotification("변경 전과 이름이 같아요.", "warning")
            return
        }
        if (!newName) {
            showNotification("이름을 공백할 수 없어요.", "warning")
            return
        }

        const particle = Hangul.endsWithConsonant(newName) ? "으로" : "로"
        updateUsername(newName)
        showNotification(`이름을 ${newName}${particle} 변경했어요.`, "success")
    }

    nameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleNameUpdate()
        }
    })

    saveBtn.addEventListener("click", handleNameUpdate)
}

function removeSearchHistoryTerm(term) {
    const items = getSearchHistory().filter(
        (t) => t.toLowerCase() !== term.toLowerCase(),
    )
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(items))
    return items
}

function renderSearchHistoryTerms(terms) {
    const container = $("historySuggestions")
    if (!container) return

    container.innerHTML = ""

    if (!Array.isArray(terms) || terms.length === 0) {
        container.classList.add("hidden")
        return
    }

    container.classList.remove("hidden")
    terms.slice(0, 5).forEach((term) => {
        const entry = document.createElement("div")
        entry.className = "item"
        entry.innerHTML = `
            <span class="item-icon material-symbols-outlined">history</span>
            <div class="item-text">
                <div class="item-title">${term}</div>
            </div>
            <span class="item-remove material-symbols-outlined">close</span>
        `

        entry.addEventListener("click", (e) => {
            if (e.target.closest(".item-remove")) return
            const input = $("search")
            input.value = term
            performSearch(term)
            renderHistorySuggestions([], "")
        })

        entry.querySelector(".item-remove").addEventListener("click", (e) => {
            e.stopPropagation()
            const remaining = removeSearchHistoryTerm(term)
            renderSearchHistoryTerms(remaining)
        })

        container.appendChild(entry)
    })
}

function initSearch() {
    const searchInput = $("search")
    const suggestions = $("historySuggestions")
    let debounceTimer = null

    const hideSuggestions = () => renderHistorySuggestions([], "")

    const onSearch = (value) => {
        hideSuggestions()
        performSearch(value)
    }

    searchInput.addEventListener("input", () => {
        const value = searchInput.value.trim()
        if (!value) {
            renderSearchHistoryTerms(getSearchHistory())
            return
        }

        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
            try {
                const results = await fetchHistory(value)
                renderHistorySuggestions(results, value)
            } catch {
                hideSuggestions()
            }
        }, 200)
    })

    searchInput.addEventListener("focus", () => {
        if (!searchInput.value.trim()) {
            renderSearchHistoryTerms(getSearchHistory())
        }
    })

    searchInput.addEventListener("keypress", (e) => {
        if (e.key !== "Enter") return
        const value = searchInput.value.trim()
        if (!value) return
        onSearch(value)
    })

    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            hideSuggestions()
        }
    })

    document.addEventListener("click", (e) => {
        if (
            !searchInput.contains(e.target) &&
            !suggestions.contains(e.target)
        ) {
            hideSuggestions()
        }
    })

    document.addEventListener("keydown", (e) => {
        if (e.key !== "/") return

        const active = document.activeElement
        const isTypingInInput =
            active &&
            (active.tagName === "INPUT" ||
                active.tagName === "TEXTAREA" ||
                active.isContentEditable)

        if (isTypingInInput) return

        searchInput.focus()
        e.preventDefault()
    })
}

function initGlobalClickHandlers() {
    const settingsPanel = $("settingsPanel")
    const content = $("content")
    const searchInput = $("search")
    const shortcutForm = $("addShortcut")
    const createShortcutBtn = $("createShortcut")

    document.addEventListener("click", (e) => {
        if (
            settingsPanel &&
            !settingsPanel.classList.contains("hidden") &&
            !settingsPanel.contains(e.target) &&
            !$("settingsButton").contains(e.target)
        ) {
            settingsPanel.classList.add("hidden")
        }

        if (
            shortcutForm &&
            !shortcutForm.classList.contains("none") &&
            !shortcutForm.contains(e.target) &&
            !createShortcutBtn.contains(e.target)
        ) {
            shortcutForm.classList.toggle("none")
            shortcutForm.classList.toggle("flex")
        }

        if (content && !searchInput.contains(e.target) && !state.isImageMode) {
            createGreeting(true)
        }
    })
}

function preventSelectionAndDrag() {
    document.addEventListener("dragstart", (e) => e.preventDefault())
    document.addEventListener("selectstart", (e) => e.preventDefault())
}

async function init() {
    await ensureUsername()
    initAudioControls()
    initSettings()
    initSearch()
    initGlobalClickHandlers()
    preventSelectionAndDrag()

    try {
        const v = await fetchVersion()
        const latest = await fetchLatestVersion()

        document.getElementById("version").textContent =
            `v${v} - ${latest && v !== latest ? `최신버전: v${latest}` : "최신 버전이에요!"}`
    } catch {
        document.getElementById("version").textContent = "vUnknown"
    }

    const toggle = $("toggleSwitch-1")
    if (toggle) {
        toggle.checked = state.isImageMode
        toggle.addEventListener("change", (e) => setImageMode(e.target.checked))
        setImageMode(state.isImageMode)
    }

    const updateToggle = $("toggleSwitch-update")
    if (updateToggle) {
        updateToggle.checked = state.isAutoUpdateEnabled
        updateToggle.addEventListener("change", (e) => {
            state.isAutoUpdateEnabled = e.target.checked
            setStorage(
                STORAGE_KEYS.AUTO_UPDATE,
                state.isAutoUpdateEnabled ? "true" : "false",
            )
            showNotification(
                state.isAutoUpdateEnabled
                    ? "자동 업데이트 확인을 켰어요."
                    : "자동 업데이트 확인을 껐어요.",
                "info",
                5,
            )
            if (state.isAutoUpdateEnabled) {
                checkUpdate()
            }
        })
    }

    const greetingToggle = $("toggleSwitch-greeting")
    if (greetingToggle) {
        greetingToggle.checked = state.isGreetingEnabled
        greetingToggle.addEventListener("change", (e) => {
            state.isGreetingEnabled = e.target.checked
            setStorage(
                STORAGE_KEYS.GREETING_ENABLED,
                state.isGreetingEnabled ? "true" : "false",
            )
            showNotification(
                state.isGreetingEnabled ? "대사를 켰어요." : "대사를 껐어요.",
                "info",
                5,
            )

            if (state.isGreetingEnabled) {
                createGreeting(true)
            } else {
                createGreeting(false)
            }
        })
    }

    if (state.isAutoUpdateEnabled) {
        checkUpdate()
    }

    await updateDate()
    updateClock()
    setInterval(updateClock, 1000)

    createShortcuts()

    if (!navigator.onLine) {
        showNotification("네트워크에 연결되어 있지 않아요.", "error")
    }

    window.addEventListener("online", updateOnlineStatus)
    window.addEventListener("offline", updateOnlineStatus)

    const checkJsLoad = $("checkJsLoad")
    checkJsLoad?.remove()
}

document.addEventListener("DOMContentLoaded", init)
