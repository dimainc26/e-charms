const STORAGE_KEY = "e-charms:favorites";
const listeners = new Set();
let cache = null;

function emit() {
    listeners.forEach((listener) => listener());
}

// Another tab changed the favorites
window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
        cache = null;
        emit();
    }
});

export class FavoriteService {
    static getAll() {
        if (cache) {
            return cache;
        }

        try {
            const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

            cache = Array.isArray(items) ? FavoriteService.sort(items) : [];
        } catch {
            cache = [];
        }

        return cache;
    }

    static has(id) {
        return FavoriteService.getAll().some((item) => item.id === id);
    }

    static count() {
        return FavoriteService.getAll().length;
    }

    static add(item) {
        if (FavoriteService.has(item.id)) {
            return;
        }

        FavoriteService.save([...FavoriteService.getAll(), FavoriteService.normalize(item)]);
    }

    static remove(id) {
        FavoriteService.save(FavoriteService.getAll().filter((favorite) => favorite.id !== id));
    }

    static toggle(item) {
        const exists = FavoriteService.has(item.id);

        if (exists) {
            FavoriteService.remove(item.id);
        } else {
            FavoriteService.add(item);
        }

        return !exists;
    }

    static save(items) {
        cache = FavoriteService.sort(items);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cache, null, 2));
        } catch {
            // storage unavailable: favorites live in memory for this session
        }

        emit();
    }

    // Calls listener whenever favorites change, here or in another tab.
    static subscribe(listener) {
        listeners.add(listener);

        return () => listeners.delete(listener);
    }

    static sort(items) {
        return [...items].sort((a, b) => {
            const nameSort = (a.name || "").localeCompare(b.name || "", "en", { sensitivity: "base" });

            return nameSort || (a.id || "").localeCompare(b.id || "");
        });
    }

    static normalize(item) {
        return {
            id: item.id,
            name: item.name ?? "",
            price: item.price ?? "",
            imageUrl: item.imageUrl,
            thumbUrl: item.thumbUrl ?? item.imageUrl,
            rawUrl: item.rawUrl ?? "",
            color: item.color ?? "",
            alt: item.alt ?? item.name ?? "Favorite item",
            authorName: item.authorName ?? "",
            authorUrl: item.authorUrl ?? "",
            sourceUrl: item.sourceUrl ?? "",
        };
    }
}
