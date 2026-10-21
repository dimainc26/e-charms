import { loadHtml, debounce } from "../utils/dom.js";
import { FavoriteService } from "../services/FavoriteService.js";
import { buildHash, parseRoute } from "../core/routes.js";

// Chrome shared by every page: header + tab bar, search panel, bag and filter
// sheets, toast, and the <main> the router renders into.
export class Shell {
    constructor(root, { store }) {
        this.root = root;
        this.store = store;
    }

    async mount() {
        this.root.innerHTML = await loadHtml(new URL("../../templates/layout/Shell.html", import.meta.url));

        this.view = this.root.querySelector("[data-view]");
        this.categoryLinks = [...this.root.querySelectorAll("[data-category]")];
        this.navLinks = [...this.root.querySelectorAll("[data-nav]")];

        this.setupSkipLink();
        this.setupSearch();
        this.setupFavoritesBadge();
    }

    setRoute(route) {
        this.categoryLinks.forEach((link) => {
            this.setCurrent(link, route.name === "shop" && link.dataset.category === route.category);
        });

        this.navLinks.forEach((link) => {
            this.setCurrent(link, link.dataset.nav === route.name);
        });
    }

    setCurrent(link, isCurrent) {
        if (isCurrent) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    }

    setupSkipLink() {
        this.root.querySelector("[data-skip-link]").addEventListener("click", (event) => {
            event.preventDefault();
            this.view.focus();
        });
    }

    setupSearch() {
        const toggle = this.root.querySelector("[data-search-toggle]");
        const panel = this.root.querySelector("[data-search-panel]");
        const input = this.root.querySelector("[data-search-input]");
        const form = this.root.querySelector("[data-search-form]");
        const dot = this.root.querySelector("[data-search-dot]");

        const isOpen = () => panel.classList.contains("search-panel--open");

        const close = () => {
            panel.classList.remove("search-panel--open");
            toggle.setAttribute("aria-expanded", "false");
        };

        // focus() must run inside the tap handler: iOS only opens the keyboard
        // for focus calls that happen synchronously within a user gesture.
        const open = () => {
            panel.classList.add("search-panel--open");
            toggle.setAttribute("aria-expanded", "true");
            input.focus();
        };

        toggle.addEventListener("click", () => (isOpen() ? close() : open()));

        const publish = debounce(() => this.store.set({ query: input.value }), 150);

        input.addEventListener("input", publish);

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            this.store.set({ query: input.value });
            input.blur();
            close();

            if (parseRoute().name === "profile") {
                window.location.hash = buildHash({ name: "shop" });
            } else {
                this.view.querySelector(".menu, .favorites-section")?.scrollIntoView({ behavior: "smooth" });
            }
        });

        document.addEventListener("click", (event) => {
            if (isOpen() && !panel.contains(event.target) && !toggle.contains(event.target)) {
                close();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || !isOpen()) {
                return;
            }

            close();

            if (panel.contains(document.activeElement)) {
                toggle.focus();
            }
        });

        // The query can also be cleared from a page ("Clear")
        this.store.subscribe(({ query }) => {
            if (input.value !== query) {
                input.value = query;
            }

            dot.hidden = !query.trim();
        });
    }

    setupFavoritesBadge() {
        const link = this.root.querySelector('[data-nav="favorites"]');
        const badge = this.root.querySelector("[data-favorites-badge]");

        const update = () => {
            const count = FavoriteService.count();

            badge.textContent = count > 99 ? "99+" : String(count);
            badge.hidden = count === 0;
            link.setAttribute("aria-label", count ? `Favorites, ${count} item${count === 1 ? "" : "s"}` : "Favorites");
        };

        FavoriteService.subscribe(update);
        update();
    }
}
