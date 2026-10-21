export const CATEGORIES = ["woman", "man", "teen", "kids"];
export const DEFAULT_CATEGORY = "woman";

const VIEWS = ["carousel", "cards"];

// #/shop/man?view=cards, #/favorites, #/profile. The older #favorites, #profile
// and #home forms keep working.
export function parseRoute(hash = window.location.hash) {
    const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
    const [section, category] = path.split("/").filter(Boolean);
    const view = new URLSearchParams(query).get("view");

    if (section === "favorites") {
        return { name: "favorites" };
    }

    if (section === "profile") {
        return { name: "profile" };
    }

    return {
        name: "shop",
        category: CATEGORIES.includes(category) ? category : DEFAULT_CATEGORY,
        view: VIEWS.includes(view) ? view : null,
    };
}

export function buildHash({ name = "shop", category = DEFAULT_CATEGORY, view } = {}) {
    if (name === "favorites" || name === "profile") {
        return `#/${name}`;
    }

    const query = view && view !== "carousel" ? `?view=${view}` : "";

    return `#/shop/${category}${query}`;
}
