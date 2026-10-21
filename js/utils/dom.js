const templates = new Map();

export function loadHtml(path) {
    const key = String(path);

    if (!templates.has(key)) {
        const request = fetch(path)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Unable to load template: ${path}`);
                }

                return response.text();
            })
            .catch((error) => {
                templates.delete(key);
                throw error;
            });

        templates.set(key, request);
    }

    return templates.get(key);
}

export function cloneTemplate(root, selector) {
    const template = root.querySelector(selector);

    if (!template) {
        throw new Error(`Missing template ${selector}`);
    }

    return template.content.firstElementChild.cloneNode(true);
}

export function setSafeHref(anchor, url) {
    try {
        const parsed = new URL(url);

        if (parsed.protocol === "https:") {
            anchor.href = parsed.href;
            return;
        }
    } catch {
        // falls through to removing the href
    }

    anchor.removeAttribute("href");
}

export function debounce(callback, wait) {
    let timer = 0;

    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => callback(...args), wait);
    };
}
