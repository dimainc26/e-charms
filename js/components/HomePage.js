import { UnsplashService } from "../services/UnsplashService.js";
import { loadHtml } from "../utils/dom.js";

const CATEGORY_PROMPTS = {
    woman: "woman fashion on studio with white background",
    man: "man fashion on studio with white background",
    teen: "teen streetwear fashion on studio with white background",
    kids: "kids fashion colorful on studio with white background",
};

const PRODUCT_NAMES = [
    "Linen 100% shirt", "Cargo jumpsuit with pockets", "Straight-fit cropped jeans",
    "Regular flowy shirt", "Bow long jumpsuit", "V-neck knit sweater",
    "Buttoned cotton shirt", "Oversized blazer", "Ribbed tank top",
    "Wide leg trousers", "Wrap midi dress", "Cropped denim jacket",
];

export class HomePage {
    constructor() {
        this.unsplashService = new UnsplashService();
        this.images = [];
        this.activeIndex = 3;
        this.visibleCount = 7;
        this.centerSlot = 3;
        this.animationDuration = 420;
        this.isAnimating = false;
    }

    getRandomPrice(min = 9, max = 199) {
        return `€ ${Math.floor(Math.random() * (max - min + 1) + min)}.99`;
    }

    async render() {
        const templateUrl = new URL("../../templates/pages/HomePage.html", import.meta.url);
        const html = await loadHtml(templateUrl);
        const container = document.createElement("div");
        container.innerHTML = html;

        const gallery = container.querySelector("[data-gallery]");
        const template = container.querySelector("[data-fashion-card]");

        if (!gallery || !template) {
            throw new Error("HomePage template is missing required gallery elements");
        }

        this.images = await this.unsplashService.searchPhotos(
            "woman fashion on studio with white background",
            30,
        );
        console.log("Immagini ricevute:", this.images.length);

        this.images = this.images.map((img) => ({
            ...img,
            price: this.getRandomPrice(),
            name: PRODUCT_NAMES[Math.floor(Math.random() * PRODUCT_NAMES.length)],
        }));

        this.activeIndex = Math.min(this.centerSlot, this.images.length - 1);

        for (let slot = 0; slot < this.visibleCount; slot += 1) {
            const card = template.content.cloneNode(true);
            this.updateCard(card, slot);

            gallery.appendChild(card);
        }

        template.remove();

        return container.innerHTML;
    }

    mount(root) {
        this.root = root;
        this.gallery = root.querySelector("[data-gallery]");
        this.setupSearchPanel(root);

        root.querySelectorAll(".disposition a").forEach((btn) => {
            btn.addEventListener("click", (event) => {
                event.preventDefault();
                root.querySelectorAll(".disposition a").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                const isCards = btn.classList.contains("cards");
                root.querySelector(".carousel__button--prev").style.display = isCards ? "none" : "";
                root.querySelector(".carousel__button--next").style.display = isCards ? "none" : "";
                this.gallery.classList.toggle("grid", isCards);

                if (isCards) {
                    this.renderGrid();
                } else {
                    this.renderCarousel();
                }
            });
        });

        root.querySelector("[data-carousel-prev]")?.addEventListener("click", () => {
            this.moveCarousel(-1);
        });

        root.querySelector("[data-carousel-next]")?.addEventListener("click", () => {
            this.moveCarousel(1);
        });

        this.gallery?.addEventListener("click", (event) => {
            const card = event.target.closest(".card");

            if (!card || !this.gallery.contains(card)) {
                return;
            }

            const itemIndex = Number(card.dataset.itemIndex);
            const cards = [...this.gallery.querySelectorAll(".card")];
            const slot = cards.indexOf(card);

            if (!Number.isNaN(itemIndex) && slot !== -1) {
                this.animateToSlot(slot);
            }
        });

        root.querySelectorAll("[data-category]").forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                const category = link.dataset.category;
                this.switchCategory(category);
            });
        });

        document.addEventListener("keydown", (event) => {
            const isCarousel = this.root?.querySelector(".carousell")?.classList.contains("active");
            if (!isCarousel) return;

            if (event.key === "ArrowLeft") this.moveCarousel(-1);
            if (event.key === "ArrowRight") this.moveCarousel(1);
        });

    }

    setupSearchPanel(root) {
        const searchToggle = root.querySelector("[data-search-toggle]");
        const searchPanel = root.querySelector("[data-search-panel]");
        const searchInput = root.querySelector("[data-search-input]");
        const searchForm = root.querySelector("[data-search-form]");

        if (!searchToggle || !searchPanel || !searchInput || !searchForm) {
            return;
        }

        const closeSearch = () => {
            searchPanel.classList.remove("search-panel--open");
            searchToggle.setAttribute("aria-expanded", "false");
        };

        const openSearch = () => {
            searchPanel.classList.add("search-panel--open");
            searchToggle.setAttribute("aria-expanded", "true");
            window.setTimeout(() => searchInput.focus(), 120);
        };

        searchToggle.addEventListener("click", (event) => {
            event.preventDefault();

            if (searchPanel.classList.contains("search-panel--open")) {
                closeSearch();
            } else {
                openSearch();
            }
        });

        searchForm.addEventListener("submit", (event) => {
            event.preventDefault();
        });

        document.addEventListener("click", (event) => {
            if (
                !searchPanel.classList.contains("search-panel--open")
                || searchPanel.contains(event.target)
                || searchToggle.contains(event.target)
            ) {
                return;
            }

            closeSearch();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeSearch();
            }
        });
    }

    moveCarousel(direction) {
        if (this.images.length === 0 || this.isAnimating) {
            return;
        }

        const nextSlot = this.centerSlot + Math.sign(direction);

        this.animateToSlot(nextSlot);
    }

    updateVisibleCards() {
        const cards = this.gallery?.querySelectorAll(".card") ?? [];

        cards.forEach((card, slot) => {
            this.updateCard(card, slot);
        });
    }

    updateCard(cardNode, slot) {
        const card = cardNode instanceof DocumentFragment
            ? cardNode.querySelector(".card")
            : cardNode;

        if (!card || this.images.length === 0) {
            return;
        }

        const itemIndex = this.getWrappedIndex(this.activeIndex + slot - this.centerSlot);
        const item = this.images[itemIndex];
        const image = card.querySelector("[data-image]");
        const author = card.querySelector("[data-author]");
        const isActive = slot === this.centerSlot;

        card.dataset.itemIndex = String(itemIndex);
        card.classList.toggle("card--active", isActive);
        card.setAttribute("aria-current", isActive ? "true" : "false");

        image.src = item.imageUrl;
        image.alt = item.alt;

        author.href = item.authorUrl;
        author.textContent = item.authorName;

        const price = card.querySelector(".price");
        if (price) price.textContent = this.getRandomPrice();

        const name = card.querySelector("[data-name]");
        if (name) name.textContent = item.name ?? "";
    }

    animateToSlot(targetSlot) {
        if (!this.gallery || this.images.length === 0 || this.isAnimating) {
            return;
        }

        if (targetSlot === this.centerSlot) {
            return;
        }

        const cards = [...this.gallery.querySelectorAll(".card")];
        const targetCard = cards[targetSlot];
        const centerCard = cards[this.centerSlot];

        if (!targetCard || !centerCard) {
            return;
        }

        const targetIndex = Number(targetCard.dataset.itemIndex);

        if (Number.isNaN(targetIndex)) {
            return;
        }

        this.isAnimating = true;
        this.gallery.classList.add("gallery--no-transition");
        this.gallery.style.setProperty("--carousel-shift", "0px");
        this.setActiveSlot(this.centerSlot);

        const centerPosition = this.getCardCenter(centerCard);

        this.setActiveSlot(targetSlot);
        const targetPosition = this.getCardCenter(targetCard);
        const shift = centerPosition - targetPosition;

        this.setActiveSlot(this.centerSlot);
        this.gallery.offsetHeight;
        this.gallery.classList.remove("gallery--no-transition");

        requestAnimationFrame(() => {
            this.setActiveSlot(targetSlot);
            this.gallery.style.setProperty("--carousel-shift", `${shift}px`);
        });

        window.setTimeout(() => {
            this.activeIndex = targetIndex;
            this.gallery.classList.add("gallery--no-transition");
            this.gallery.style.setProperty("--carousel-shift", "0px");
            this.updateVisibleCards();
            this.gallery.offsetHeight;

            requestAnimationFrame(() => {
                this.gallery.classList.remove("gallery--no-transition");
                this.isAnimating = false;
            });
        }, this.animationDuration);
    }

    setActiveSlot(activeSlot) {
        const cards = this.gallery?.querySelectorAll(".card") ?? [];

        cards.forEach((card, slot) => {
            const isActive = slot === activeSlot;

            card.classList.toggle("card--active", isActive);
            card.setAttribute("aria-current", isActive ? "true" : "false");
        });
    }

    getCardCenter(card) {
        const rect = card.getBoundingClientRect();

        return rect.left + rect.width / 2;
    }

    getWrappedIndex(index) {
        return ((index % this.images.length) + this.images.length) % this.images.length;
    }

    async switchCategory(category) {
        if (this.isAnimating) return;

        const prompt = CATEGORY_PROMPTS[category];
        if (!prompt) return;

        // aggiorna stato active sulla nav
        this.root.querySelectorAll("[data-category]").forEach((link) => {
            link.classList.toggle("active", link.dataset.category === category);
        });

        this.isAnimating = true;

        try {
            this.images = await this.unsplashService.searchPhotos(prompt, 30);
            this.images = this.images.map((img) => ({
                ...img,
                price: this.getRandomPrice(),
                name: PRODUCT_NAMES[Math.floor(Math.random() * PRODUCT_NAMES.length)],
            }));

            this.activeIndex = this.centerSlot;
            this.updateVisibleCards();
        } finally {
            this.isAnimating = false;
        }
    }


    renderGrid() {
        if (!this.gallery || this.images.length === 0) return;

        this.gallery.innerHTML = "";

        this.images.forEach((item, index) => {
            const card = document.createElement("article");
            card.className = "cardx";
            card.dataset.itemIndex = String(index);

            const box = document.createElement("div");
            box.className = "grid-box";


            const img = document.createElement("img");
            img.className = "image-grid";
            img.src = item.imageUrl;
            img.alt = item.alt;

            const credits = document.createElement("div");
            credits.className = "credits";

            const name = document.createElement("p");
            name.className = "card__name";
            name.textContent = item.name ?? "";

            const price = document.createElement("p");
            price.className = "price";
            price.textContent = item.price ?? this.getRandomPrice();

            box.appendChild(img);
            credits.appendChild(name);
            credits.appendChild(price);
            card.appendChild(box);
            card.appendChild(credits);
            this.gallery.appendChild(card);
        });
    }

    renderCarousel() {
        if (!this.gallery) return;

        this.gallery.innerHTML = "";
        this.gallery.style.removeProperty("--carousel-shift");

        for (let slot = 0; slot < this.visibleCount; slot += 1) {
            const card = document.createElement("article");
            card.className = "card";
            card.innerHTML = `
            <div class="card-box">
                <img class="card__image" data-image />
            </div>
            <div class="credits">
                <p class="card__credit">
                    <a data-author target="_blank" rel="noreferrer"></a>
                </p>
                <p class="card__name" data-name></p>
                <p class="price"></p>
            </div>
        `;
            this.gallery.appendChild(card);
            this.updateCard(card, slot);
        }
    }
}
