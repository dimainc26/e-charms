import { FavoriteService } from "../services/FavoriteService.js";
import { loadHtml } from "../utils/dom.js";

export class FavoritePage {
    async render() {
        const templateUrl = new URL("../../templates/pages/FavoritePage.html", import.meta.url);
        const html = await loadHtml(templateUrl);
        const container = document.createElement("div");

        container.innerHTML = html;

        return container.innerHTML;
    }

    mount(root) {
        this.root = root;
        this.list = root.querySelector("[data-favorites-list]");
        this.empty = root.querySelector("[data-favorites-empty]");
        this.count = root.querySelector("[data-favorites-count]");

        this.renderFavorites();

        this.list?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-favorite-toggle]");

            if (!button || !this.list.contains(button)) {
                return;
            }

            const item = FavoriteService.getAll().find((favorite) => favorite.id === button.dataset.itemId);

            if (!item) {
                return;
            }

            FavoriteService.toggle(item);
            this.renderFavorites();
        });
    }

    renderFavorites() {
        const favorites = FavoriteService.getAll();

        if (this.count) {
            this.count.textContent = `${favorites.length} item${favorites.length === 1 ? "" : "s"}`;
        }

        if (!this.list || !this.empty) {
            return;
        }

        this.list.innerHTML = "";
        this.empty.hidden = favorites.length > 0;

        favorites.forEach((item) => {
            const card = document.createElement("article");
            card.className = "favorite-card";

            const imageWrap = document.createElement("div");
            imageWrap.className = "favorite-card__image-wrap";

            const image = document.createElement("img");
            image.className = "favorite-card__image";
            image.src = item.imageUrl;
            image.alt = item.alt;

            const credits = document.createElement("div");
            credits.className = "credits";

            const name = document.createElement("p");
            name.className = "card__name";
            name.textContent = item.name;

            const price = document.createElement("p");
            price.className = "price";
            price.textContent = item.price;

            const button = document.createElement("button");
            button.className = "favorite-toggle favorite-toggle--active";
            button.type = "button";
            button.dataset.favoriteToggle = "";
            button.dataset.itemId = item.id;
            button.setAttribute("aria-pressed", "true");
            button.setAttribute("aria-label", "Remove from favorites");
            button.innerHTML = '<img src="../../assets/icons/love.svg" alt="">';

            imageWrap.appendChild(image);
            credits.appendChild(name);
            credits.appendChild(price);
            credits.appendChild(button);
            card.appendChild(imageWrap);
            card.appendChild(credits);

            this.list.appendChild(card);
        });
    }
}
