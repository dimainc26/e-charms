const STORAGE_KEY = "e-charms:favorites";

export class FavoriteService {
    static getAll() {
        try {
            const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

            if (!Array.isArray(items)) {
                return [];
            }

            return FavoriteService.sort(items);
        } catch {
            return [];
        }
    }

    static has(id) {
        return FavoriteService.getAll().some((item) => item.id === id);
    }

    static toggle(item) {
        const favorites = FavoriteService.getAll();
        const exists = favorites.some((favorite) => favorite.id === item.id);
        const nextFavorites = exists
            ? favorites.filter((favorite) => favorite.id !== item.id)
            : FavoriteService.sort([...favorites, FavoriteService.normalize(item)]);

        FavoriteService.save(nextFavorites);

        return !exists;
    }

    static save(items) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(FavoriteService.sort(items), null, 2));
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
            alt: item.alt ?? item.name ?? "Favorite item",
            authorName: item.authorName ?? "",
            authorUrl: item.authorUrl ?? "",
            sourceUrl: item.sourceUrl ?? "",
        };
    }
}
