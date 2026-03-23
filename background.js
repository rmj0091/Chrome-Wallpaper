chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "getHistory") {
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
    } else if (message?.type === "getVersion") {
        const manifest = chrome.runtime.getManifest()

        sendResponse({ version: manifest.version })
        return true
    } else if (message?.type === "searchBookmarks") {
        searchBookmarks(message.query || "").then((results) => {
            sendResponse({ results })
        })

        return true
    }
})

async function getAllBookmarks() {
    const tree = await chrome.bookmarks.getTree()
    const result = []

    function traverse(nodes) {
        for (const node of nodes) {
            if (node.url) result.push(node)
            if (node.children) traverse(node.children)
        }
    }

    traverse(tree)
    return result
}

async function searchBookmarks(query) {
    const bookmarks = await getAllBookmarks()

    const q = query.toLowerCase()

    return bookmarks.filter(
        (b) =>
            (b.title && b.title.toLowerCase().includes(q)) ||
            (b.url && b.url.toLowerCase().includes(q)),
    )
}
