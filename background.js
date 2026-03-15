chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "getHistory") return

    chrome.history.search(
        {
            text: message.query || "",
            startTime: 0,
            maxResults: 100,
        },
        (results) => {
            const seen = new Set()
            const uniqueResults = []
            for (const item of results || []) {
                if (!item?.url) continue
                if (seen.has(item.url)) continue
                seen.add(item.url)
                uniqueResults.push(item)
            }
            sendResponse({ results: uniqueResults })
        },
    )

    return true
})
