import { FavoriteService } from "../services/FavoriteService.js";
import { cloneTemplate, loadHtml } from "../utils/dom.js";
import { applyImage } from "../utils/images.js";
import { addToBag } from "./CartSheet.js";

const GRID_SIZES = "(max-width: 560px) 50vw, (max-width: 1100px) 33vw, 25vw";

export class FavoritePage {
    constructor({ store, toast, sheets }) {
        this.store = store;
        this.toast = toast;
        this.sheets = sheets;
        this.query = store.state.query;
        this.abort = new AbortController();
    }

    get title() {
        return "Favorites · E-Charms Store";
    }

    render() {
        return loadHtml(new URL("../../templates/pages/FavoritePage.html", import.meta.url));
    }

    mount(root) {
        this.root = root;
        this.list = root.querySelector("[data-favorites-list]");
        this.empty = root.querySelector("[data-favorites-empty]");
        this.count = root.querySelector("[data-favorites-count]");
        this.emptyMessage = root.querySelector("[data-empty-message]");
        this.emptyLink = root.querySelector("[data-empty-link]");
        this.clearSearch = root.querySelector("[data-clear-search]");

        const { signal } = this.abort;

        this.list.addEventListener("click", (event) => this.onListClick(event), { signal });
        this.clearSearch.addEventListener("click", () => this.store.set({ query: "" }), { signal });

        // Saving (here, from the toast's Undo, or in another tab) re-renders the list
        this.unsubscribeFavorites = FavoriteService.subscribe(() => this.renderFavorites());
        this.unsubscribeStore = this.store.subscribe(({ query }) => {
            if (query !== this.query) {
                this.query = query;
                this.renderFavorites();
            }
        });

        this.renderFavorites();
    }

    unmount() {
        this.abort.abort();
        this.unsubscribeFavorites?.();
        this.unsubscribeStore?.();
    }

    onListClick(event) {
        const addButton = event.target.closest("[data-add-to-bag]");

        if (addButton && this.list.contains(addButton)) {
            const favorite = FavoriteService.getAll().find((item) => item.id === addButton.dataset.itemId);

            if (favorite) {
                addToBag(favorite, this);
            }

            return;
        }

        const button = event.target.closest("[data-favorite-toggle]");

        if (!button || !this.list.contains(button)) {
            return;
        }

        const item = FavoriteService.getAll().find((favorite) => favorite.id === button.dataset.itemId);

        if (!item) {
            return;
        }

        // Keep keyboard focus in the list once the tile disappears
        const buttons = [...this.list.querySelectorAll("[data-favorite-toggle]")];
        const index = buttons.indexOf(button);
        const neighbourId = (buttons[index + 1] ?? buttons[index - 1])?.dataset.itemId;

        FavoriteService.remove(item.id);

        const next = neighbourId && this.list.querySelector(`[data-item-id="${CSS.escape(neighbourId)}"]`);

        (next || this.root).focus({ preventScroll: true });

        this.toast.show("Removed from favorites", {
            actionLabel: "Undo",
            onAction: () => FavoriteService.add(item),
        });
    }

    renderFavorites() {
        const all = FavoriteService.getAll();
        const query = this.query.trim();
        const favorites = query
            ? all.filter((item) => `${item.name} ${item.alt}`.toLowerCase().includes(query.toLowerCase()))
            : all;

        this.count.textContent = query
            ? `${favorites.length} of ${all.length} items`
            : `${all.length} item${all.length === 1 ? "" : "s"}`;

        this.empty.hidden = favorites.length > 0;
        this.emptyMessage.textContent = all.length === 0 ? "No favorites yet." : `No favorites match “${query}”.`;
        this.emptyLink.hidden = all.length > 0;
        this.clearSearch.hidden = all.length === 0;

        const fragment = document.createDocumentFragment();

        favorites.forEach((item, index) => {
            const tile = cloneTemplate(this.root, "[data-favorite-card]");
            const button = tile.querySelector("[data-favorite-toggle]");

            tile.querySelector("[data-media]").style.backgroundColor = item.color || "";
            tile.querySelector("[data-name]").textContent = item.name;
            tile.querySelector("[data-price]").textContent = item.price;
            applyImage(tile.querySelector("[data-image]"), item, GRID_SIZES, { eager: index < 4 });

            button.dataset.itemId = item.id;
            button.setAttribute("aria-label", `Remove ${item.name} from favorites`);

            const addButton = tile.querySelector("[data-add-to-bag]");

            addButton.dataset.itemId = item.id;
            addButton.setAttribute("aria-label", `Add ${item.name} to bag`);

            fragment.append(tile);
        });

        this.list.replaceChildren(fragment);
    }
}
