const WIDTHS = [320, 480, 640, 800, 1080];
const FALLBACK_WIDTH = 640;

function resize(rawUrl, width) {
    try {
        const url = new URL(rawUrl);

        url.searchParams.set("w", String(width));
        url.searchParams.set("q", "75");
        url.searchParams.set("fit", "max");
        url.searchParams.set("fm", "jpg");
        url.searchParams.set("auto", "format");

        return url.toString();
    } catch {
        return rawUrl;
    }
}

function buildSrcset(rawUrl) {
    return WIDTHS.map((width) => `${resize(rawUrl, width)} ${width}w`).join(", ");
}

// Items saved before rawUrl existed only carry imageUrl: those keep a single source.
export function applyImage(img, item, sizes, { eager = false, priority = false } = {}) {
    const key = `${item.id}|${sizes}`;

    img.alt = item.alt ?? "";
    img.loading = eager ? "eager" : "lazy";
    img.fetchPriority = priority ? "high" : "auto";

    if (img.dataset.imageKey === key) {
        return;
    }

    img.dataset.imageKey = key;

    if (item.rawUrl) {
        img.sizes = sizes;
        img.srcset = buildSrcset(item.rawUrl);
        img.src = resize(item.rawUrl, FALLBACK_WIDTH);
    } else {
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        img.src = item.imageUrl;
    }
}

export function preloadImage(item, sizes) {
    applyImage(new Image(), item, sizes, { eager: true });
}
