import { UnsplashService } from "../services/UnsplashService.js";
import { FavoriteService } from "../services/FavoriteService.js";
import { addToBag } from "./CartSheet.js";
import { DEFAULT_FILTERS } from "../store/Store.js";
import { buildHash } from "../core/routes.js";
import { cloneTemplate, loadHtml, setSafeHref } from "../utils/dom.js";
import { applyImage, preloadImage } from "../utils/images.js";
import { MOBILE_QUERY, isMobile, prefersReducedMotion } from "../utils/media.js";
import { productFor } from "../utils/mock.js";

const CATEGORY_PROMPTS = {
    woman: "woman fashion on studio with white background",
    man: "man fashion on studio with white background",
    teen: "teen streetwear fashion on studio with white background",
    kids: "kids fashion colorful on studio with white background",
};

const CATEGORY_LABELS = { woman: "Woman", man: "Man", teen: "Teen", kids: "Kids" };

const PER_PAGE = 30;

// "sizes" hints for srcset, one per gallery mode
const SIZES = {
    slots: "28vw",
    snap: "clamp(240px, 68vw, 360px)",
    grid: "(max-width: 560px) 50vw, (max-width: 1100px) 33vw, 25vw",
};

const PRICE_FILTERS = {
    any: () => true,
    "under-50": (price) => price < 50,
    "50-100": (price) => price >= 50 && price <= 100,
    "over-100": (price) => price > 100,
};

const SORTERS = {
    featured: null,
    "price-asc": (a, b) => a.priceValue - b.priceValue,
    "price-desc": (a, b) => b.priceValue - a.priceValue,
    name: (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
};

function describeError(error) {
    if (error.code === "config") {
        return error.message;
    }

    if (error.status === 403 || error.status === 429) {
        return "The photo service is busy right now. Please try again in a little while.";
    }

    if (error.status === 401) {
        return "The photo service rejected the access key.";
    }

    if (navigator.onLine === false) {
        return "You seem to be offline. Check your connection and try again.";
    }

    return "We couldn't load the collection. Please try again.";
}

function markActive(card, isActive) {
    card.classList.toggle("card--active", isActive);

    if (isActive) {
        card.setAttribute("aria-current", "true");
    } else {
        card.removeAttribute("aria-current");
    }
}

export class HomePage {
    constructor({ route, store, sheets, toast }) {
        this.store = store;
        this.sheets = sheets;
        this.toast = toast;

        this.category = route.category;
        this.view = route.view ?? "carousel";
        this.query = store.state.query;
        this.filters = store.state.filters;

        this.allItems = [];
        this.items = [];
        this.itemsById = new Map();
        this.status = "loading";
        this.errorMessage = "";
        this.loadToken = 0;

        this.centerSlot = 3;
        this.visibleCount = 7;
        this.activeIndex = this.centerSlot;
        this.animationDuration = 420;
        this.isAnimating = false;
        this.animationTimer = 0;
        this.animationFrame = 0;

        this.abort = new AbortController();
    }

    get title() {
        return `${CATEGORY_LABELS[this.category]} · E-Charms Store`;
    }

    render() {
        return loadHtml(new URL("../../templates/pages/HomePage.html", import.meta.url));
    }

    mount(root) {
        this.root = root;
        this.carousel = root.querySelector("[data-carousel]");
        this.gallery = root.querySelector("[data-gallery]");
        this.prevButton = root.querySelector("[data-carousel-prev]");
        this.nextButton = root.querySelector("[data-carousel-next]");
        this.emptyEl = root.querySelector("[data-empty]");
        this.errorEl = root.querySelector("[data-error]");
        this.errorMessageEl = root.querySelector("[data-error-message]");
        this.statusEl = root.querySelector("[data-status]");
        this.statusTextEl = root.querySelector("[data-status-text]");
        this.filterBadge = root.querySelector("[data-filter-badge]");
        this.filterForm = document.querySelector("[data-filter-form]");

        const { signal } = this.abort;

        root.querySelectorAll("[data-view-mode]").forEach((button) => {
            button.addEventListener("click", () => this.setView(button.dataset.viewMode), { signal });
        });

        this.prevButton.addEventListener("click", () => this.moveCarousel(-1), { signal });
        this.nextButton.addEventListener("click", () => this.moveCarousel(1), { signal });
        this.gallery.addEventListener("click", (event) => this.onGalleryClick(event), { signal });

        root.addEventListener("click", (event) => {
            if (event.target.closest("[data-clear-filters]")) {
                this.clearFilters();
            } else if (event.target.closest("[data-retry]")) {
                this.load();
            }
        }, { signal });

        this.bindSwipe(signal);
        this.bindKeyboard(signal);
        this.bindFilterForm(signal);

        window.matchMedia(MOBILE_QUERY).addEventListener("change", () => {
            if (this.status === "ready" && this.items.length > 0) {
                this.renderGallery();
            }
        }, { signal });

        this.unsubscribeStore = this.store.subscribe((state) => this.onStore(state));
        this.unsubscribeFavorites = FavoriteService.subscribe(() => this.syncFavoriteButtons());

        this.syncViewButtons();
        this.syncFilterForm();
        this.load();
    }

    unmount() {
        this.loadToken += 1;
        this.cancelAnimation();
        this.observer?.disconnect();
        this.abort.abort();
        this.unsubscribeStore?.();
        this.unsubscribeFavorites?.();
    }

    // The router calls this for #/shop/... changes: keep the page, change what it shows.
    update(route) {
        if (route.name !== "shop") {
            return false;
        }

        const viewChanged = Boolean(route.view) && route.view !== this.view;

        if (viewChanged) {
            this.view = route.view;
            this.syncViewButtons();
        }

        if (route.category !== this.category) {
            this.category = route.category;
            this.load();
        } else if (viewChanged && this.status === "ready" && this.items.length > 0) {
            this.renderGallery();
        }

        this.syncUrl();

        return true;
    }

    // ------------------------------------------------------------------
    // Data
    // ------------------------------------------------------------------

    async load() {
        const token = ++this.loadToken;

        this.status = "loading";
        this.errorMessage = "";
        this.allItems = [];
        this.items = [];
        this.renderState();

        try {
            const photos = await new UnsplashService().searchPhotos(CATEGORY_PROMPTS[this.category], PER_PAGE);

            if (token !== this.loadToken) {
                return;
            }

            this.allItems = photos.map(productFor);
            this.itemsById = new Map(this.allItems.map((item) => [item.id, item]));
            this.status = "ready";
        } catch (error) {
            if (token !== this.loadToken) {
                return;
            }

            this.status = "error";
            this.errorMessage = describeError(error);
        }

        this.applyFilters();
    }

    applyFilters() {
        const query = this.query.trim().toLowerCase();
        const matchesPrice = PRICE_FILTERS[this.filters.price] ?? PRICE_FILTERS.any;
        const sorter = SORTERS[this.filters.sort];

        const items = this.allItems.filter((item) => (
            matchesPrice(item.priceValue)
            && (!query || `${item.name} ${item.alt}`.toLowerCase().includes(query))
        ));

        this.items = sorter ? items.sort(sorter) : items;
        this.activeIndex = this.getMode() === "slots"
            ? Math.min(this.centerSlot, Math.max(this.items.length - 1, 0))
            : 0;

        this.renderState();
    }

    onStore(state) {
        if (state.query === this.query && state.filters === this.filters) {
            return;
        }

        this.query = state.query;
        this.filters = state.filters;
        this.syncFilterForm();

        if (this.status === "ready") {
            this.applyFilters();
        }
    }

    clearFilters() {
        this.store.set({ query: "", filters: DEFAULT_FILTERS });
    }

    // ------------------------------------------------------------------
    // View state
    // ------------------------------------------------------------------

    getMode() {
        if (this.view === "cards") {
            return "grid";
        }

        const tooFewForSlots = this.status === "ready" && this.items.length < this.visibleCount;

        return isMobile() || tooFewForSlots ? "snap" : "slots";
    }

    setView(view) {
        if (view === this.view) {
            return;
        }

        this.view = view;
        this.syncViewButtons();
        this.syncUrl();

        if (this.status === "ready" && this.items.length > 0) {
            this.renderGallery();
        }
    }

    syncViewButtons() {
        this.root.querySelectorAll("[data-view-mode]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.viewMode === this.view));
        });
    }

    syncUrl() {
        const hash = buildHash({ name: "shop", category: this.category, view: this.view });

        if (window.location.hash !== hash) {
            window.history.replaceState(window.history.state, "", hash);
        }
    }

    syncFilterForm() {
        const form = this.filterForm;

        if (form) {
            form.elements.namedItem("sort").value = this.filters.sort;
            form.elements.namedItem("price").value = this.filters.price;
        }

        this.updateFilterSummary();
    }

    updateFilterSummary() {
        const activeCount = Number(this.filters.sort !== DEFAULT_FILTERS.sort)
            + Number(this.filters.price !== DEFAULT_FILTERS.price);

        this.filterBadge.textContent = String(activeCount);
        this.filterBadge.hidden = activeCount === 0;

        const submit = this.filterForm?.querySelector("[data-filter-submit]");

        if (submit) {
            const count = this.items.length;

            submit.textContent = this.status === "ready"
                ? `Show ${count} item${count === 1 ? "" : "s"}`
                : "Show results";
        }
    }

    updateStatus() {
        const ready = this.status === "ready";
        const query = this.query.trim();
        const isFiltered = Boolean(query)
            || this.filters.sort !== DEFAULT_FILTERS.sort
            || this.filters.price !== DEFAULT_FILTERS.price;

        this.statusEl.hidden = !(ready && isFiltered);

        if (ready && isFiltered) {
            this.statusTextEl.textContent = `${this.items.length} of ${this.allItems.length} items${query ? ` · “${query}”` : ""}`;
        }

        this.updateFilterSummary();
    }

    renderState() {
        const isEmpty = this.status === "ready" && this.items.length === 0;

        this.errorEl.hidden = this.status !== "error";
        this.errorMessageEl.textContent = this.errorMessage;
        this.emptyEl.hidden = !isEmpty;
        this.carousel.hidden = this.status === "error" || isEmpty;
        this.updateStatus();

        if (!this.carousel.hidden) {
            this.renderGallery();
        }
    }

    // ------------------------------------------------------------------
    // Gallery rendering
    // ------------------------------------------------------------------

    renderGallery() {
        const mode = this.getMode();

        this.cancelAnimation();
        this.observer?.disconnect();
        this.observer = null;

        this.gallery.dataset.mode = mode;
        this.gallery.classList.remove("gallery--no-transition");
        this.gallery.style.removeProperty("--carousel-shift");
        this.gallery.setAttribute("aria-busy", String(this.status === "loading"));
        this.carousel.classList.toggle("carousel--grid", mode === "grid");
        this.gallery.replaceChildren();

        if (this.status === "loading") {
            this.renderSkeleton(mode);
        } else if (mode === "grid") {
            this.renderGrid();
        } else if (mode === "snap") {
            this.renderSnap();
        } else {
            this.renderSlots();
        }

        this.updateNavState();
    }

    renderSkeleton(mode) {
        const count = { grid: 8, snap: 3, slots: this.visibleCount }[mode];
        const fragment = document.createDocumentFragment();

        for (let index = 0; index < count; index += 1) {
            const element = document.createElement("article");
            const isActive = index === (mode === "slots" ? this.centerSlot : 0);

            element.setAttribute("aria-hidden", "true");
            element.className = mode === "grid" ? "tile" : "card";
            element.classList.toggle("card--active", mode !== "grid" && isActive);
            element.innerHTML = `
                <div class="${mode === "grid" ? "tile__media" : "card-box"} skeleton"></div>
                <div class="credits">
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line skeleton-line--short"></div>
                </div>`;
            fragment.append(element);
        }

        this.gallery.append(fragment);
    }

    renderSlots() {
        for (let slot = 0; slot < this.visibleCount; slot += 1) {
            const card = cloneTemplate(this.root, "[data-fashion-card]");

            this.gallery.append(card);
            this.updateCard(card, slot);
        }

        this.preloadNeighbours();
    }

    renderSnap() {
        const fragment = document.createDocumentFragment();

        this.activeIndex = Math.min(this.activeIndex, this.items.length - 1);

        this.items.forEach((item, index) => {
            const card = cloneTemplate(this.root, "[data-fashion-card]");

            this.fillCard(card, item, index, "snap", {
                eager: Math.abs(index - this.activeIndex) <= 1,
                priority: index === this.activeIndex,
            });
            markActive(card, index === this.activeIndex);
            fragment.append(card);
        });

        this.gallery.append(fragment);
        this.scrollToIndex(this.activeIndex, { instant: true });

        // The card crossing the middle of the track is the active one
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    this.setSnapActive(Number(entry.target.dataset.itemIndex));
                }
            });
        }, { root: this.gallery, rootMargin: "0px -45% 0px -45%", threshold: 0 });

        this.gallery.querySelectorAll(".card").forEach((card) => this.observer.observe(card));
    }

    renderGrid() {
        const fragment = document.createDocumentFragment();

        this.items.forEach((item, index) => {
            const tile = cloneTemplate(this.root, "[data-grid-card]");

            this.fillCard(tile, item, index, "grid", { eager: index < 4 });
            fragment.append(tile);
        });

        this.gallery.append(fragment);
    }

    fillCard(card, item, index, mode, { eager = true, priority = false } = {}) {
        card.dataset.itemIndex = String(index);
        card.querySelector("[data-media]").style.backgroundColor = item.color || "";
        card.querySelector("[data-name]").textContent = item.name;
        card.querySelector("[data-price]").textContent = item.price;
        applyImage(card.querySelector("[data-image]"), item, SIZES[mode], { eager, priority });

        const author = card.querySelector("[data-author]");

        if (author) {
            author.textContent = item.authorName;
            setSafeHref(author, item.authorUrl);
        }

        this.updateFavoriteButton(card.querySelector("[data-favorite-toggle]"), item);

        const addButton = card.querySelector("[data-add-to-bag]");

        addButton.dataset.itemId = item.id;
        addButton.setAttribute("aria-label", `Add ${item.name} to bag`);
    }

    updateCard(card, slot) {
        const itemIndex = this.getWrappedIndex(this.activeIndex + slot - this.centerSlot);
        const isActive = slot === this.centerSlot;

        this.fillCard(card, this.items[itemIndex], itemIndex, "slots", { priority: isActive });
        markActive(card, isActive);
    }

    updateVisibleCards() {
        this.gallery.querySelectorAll(".card").forEach((card, slot) => this.updateCard(card, slot));
        this.preloadNeighbours();
    }

    // Cards entering from the edges would pop in: fetch them one move ahead
    preloadNeighbours() {
        [-5, -4, 4, 5].forEach((offset) => {
            const item = this.items[this.getWrappedIndex(this.activeIndex + offset)];

            if (item) {
                preloadImage(item, SIZES.slots);
            }
        });
    }

    getWrappedIndex(index) {
        const { length } = this.items;

        return ((index % length) + length) % length;
    }

    // ------------------------------------------------------------------
    // Interaction
    // ------------------------------------------------------------------

    onGalleryClick(event) {
        if (this.status !== "ready") {
            return;
        }

        const favoriteButton = event.target.closest("[data-favorite-toggle]");

        if (favoriteButton) {
            event.preventDefault();
            this.toggleFavorite(favoriteButton);
            return;
        }

        const addButton = event.target.closest("[data-add-to-bag]");

        if (addButton) {
            const item = this.itemsById.get(addButton.dataset.itemId);

            if (item) {
                addToBag(item, this);
            }

            return;
        }

        // The photographer link opens normally
        const card = event.target.closest(".card");

        if (!card || event.target.closest("a")) {
            return;
        }

        if (this.gallery.dataset.mode === "slots") {
            const slot = [...this.gallery.querySelectorAll(".card")].indexOf(card);

            if (slot !== -1) {
                this.animateToSlot(slot);
            }
        } else {
            this.scrollToIndex(Number(card.dataset.itemIndex));
        }
    }

    // Swipe for touch screens that still get the desktop slots (tablet landscape)
    bindSwipe(signal) {
        let start = null;

        this.carousel.addEventListener("pointerdown", (event) => {
            const isTouch = event.pointerType !== "mouse";

            start = isTouch && this.gallery.dataset.mode === "slots" ? { x: event.clientX, y: event.clientY } : null;
        }, { signal });

        this.carousel.addEventListener("pointerup", (event) => {
            if (!start) {
                return;
            }

            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;

            start = null;

            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                this.moveCarousel(dx < 0 ? 1 : -1);
            }
        }, { signal });

        this.carousel.addEventListener("pointercancel", () => {
            start = null;
        }, { signal });
    }

    bindKeyboard(signal) {
        document.addEventListener("keydown", (event) => {
            const isArrow = event.key === "ArrowLeft" || event.key === "ArrowRight";

            if (!isArrow || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }

            if (event.target.closest?.("input, textarea, select, [contenteditable]")) {
                return;
            }

            if (document.body.classList.contains("sheet-is-open") || this.getMode() === "grid") {
                return;
            }

            this.moveCarousel(event.key === "ArrowRight" ? 1 : -1);
        }, { signal });
    }

    bindFilterForm(signal) {
        const form = this.filterForm;

        form.addEventListener("change", () => {
            const data = new FormData(form);

            this.store.set({ filters: { sort: data.get("sort"), price: data.get("price") } });
        }, { signal });

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            this.sheets.close();
        }, { signal });

        form.querySelector("[data-filter-reset]").addEventListener("click", () => {
            this.store.set({ filters: DEFAULT_FILTERS });
        }, { signal });
    }

    moveCarousel(direction) {
        if (this.status !== "ready" || this.items.length === 0) {
            return;
        }

        const step = Math.sign(direction);

        if (this.gallery.dataset.mode === "slots") {
            this.animateToSlot(this.centerSlot + step);
        } else if (this.gallery.dataset.mode === "snap") {
            this.scrollToIndex(Math.min(Math.max(this.activeIndex + step, 0), this.items.length - 1));
        }
    }

    // Snap mode: the browser scrolls, we only follow
    scrollToIndex(index, { instant = false } = {}) {
        const card = this.gallery.querySelector(`.card[data-item-index="${index}"]`);

        if (!card) {
            return;
        }

        const left = card.offsetLeft - (this.gallery.clientWidth - card.offsetWidth) / 2;

        this.gallery.scrollTo({
            left: Math.max(0, left),
            behavior: instant || prefersReducedMotion() ? "auto" : "smooth",
        });
    }

    setSnapActive(index) {
        if (index === this.activeIndex && this.gallery.querySelector(".card--active")?.dataset.itemIndex === String(index)) {
            return;
        }

        this.activeIndex = index;
        this.gallery.querySelectorAll(".card").forEach((card) => {
            markActive(card, Number(card.dataset.itemIndex) === index);
        });
        this.updateNavState();
    }

    updateNavState() {
        const isSnap = this.gallery.dataset.mode === "snap" && this.status === "ready";

        this.prevButton.disabled = isSnap && this.activeIndex <= 0;
        this.nextButton.disabled = isSnap && this.activeIndex >= this.items.length - 1;
    }

    // Slots mode: measure where the target card will sit once it grows, then
    // slide the track by that amount while the class change animates.
    animateToSlot(targetSlot) {
        if (this.status !== "ready" || this.items.length === 0 || this.isAnimating || targetSlot === this.centerSlot) {
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

        const duration = prefersReducedMotion() ? 0 : this.animationDuration;

        this.isAnimating = true;
        this.gallery.classList.add("gallery--no-transition");
        this.gallery.style.setProperty("--carousel-shift", "0px");
        this.setActiveSlot(this.centerSlot);

        const centerPosition = this.getCardCenter(centerCard);

        this.setActiveSlot(targetSlot);
        const targetPosition = this.getCardCenter(targetCard);
        const shift = centerPosition - targetPosition;

        this.setActiveSlot(this.centerSlot);
        void this.gallery.offsetHeight;
        this.gallery.classList.remove("gallery--no-transition");

        this.animationFrame = requestAnimationFrame(() => {
            this.setActiveSlot(targetSlot);
            this.gallery.style.setProperty("--carousel-shift", `${shift}px`);
        });

        this.animationTimer = window.setTimeout(() => {
            this.activeIndex = targetIndex;
            this.gallery.classList.add("gallery--no-transition");
            this.gallery.style.setProperty("--carousel-shift", "0px");
            this.updateVisibleCards();
            void this.gallery.offsetHeight;

            this.animationFrame = requestAnimationFrame(() => {
                this.gallery.classList.remove("gallery--no-transition");
                this.isAnimating = false;
            });
        }, duration);
    }

    cancelAnimation() {
        window.clearTimeout(this.animationTimer);
        cancelAnimationFrame(this.animationFrame);
        this.isAnimating = false;
    }

    setActiveSlot(activeSlot) {
        this.gallery.querySelectorAll(".card").forEach((card, slot) => markActive(card, slot === activeSlot));
    }

    getCardCenter(card) {
        const rect = card.getBoundingClientRect();

        return rect.left + rect.width / 2;
    }

    // ------------------------------------------------------------------
    // Favorites
    // ------------------------------------------------------------------

    updateFavoriteButton(button, item) {
        if (!button) {
            return;
        }

        const isFavorite = FavoriteService.has(item.id);

        button.dataset.itemId = item.id;
        button.classList.toggle("favorite-toggle--active", isFavorite);
        button.setAttribute("aria-pressed", String(isFavorite));
        button.setAttribute("aria-label", `Favorite: ${item.name}`);
    }

    syncFavoriteButtons() {
        this.gallery.querySelectorAll("[data-favorite-toggle]").forEach((button) => {
            const item = this.itemsById.get(button.dataset.itemId);

            if (item) {
                this.updateFavoriteButton(button, item);
            }
        });
    }

    toggleFavorite(button) {
        const item = this.itemsById.get(button.dataset.itemId);

        if (!item) {
            return;
        }

        // Saving notifies subscribers, which refreshes every button for this item
        const isFavorite = FavoriteService.toggle(item);

        if (isFavorite) {
            button.classList.add("favorite-toggle--pop");
            button.addEventListener("animationend", () => button.classList.remove("favorite-toggle--pop"), { once: true });
        }
    }
}
