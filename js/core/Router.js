import { parseRoute } from "./routes.js";
import { prefersReducedMotion } from "../utils/media.js";

// A page is { render(): Promise<string>, mount(view), unmount?(), update?(route): boolean, title }.
// update() lets a page absorb a route change (e.g. another category) without a remount.
export class Router {
    constructor({ view, pages, context, onNavigate }) {
        this.view = view;
        this.pages = pages;
        this.context = context;
        this.onNavigate = onNavigate;
        this.page = null;
        this.navigationId = 0;
    }

    start() {
        window.addEventListener("hashchange", () => this.navigate());

        return this.navigate();
    }

    async navigate() {
        const id = ++this.navigationId;
        const route = parseRoute();
        const Page = this.pages[route.name];

        if (this.page instanceof Page && this.page.update?.(route)) {
            this.onNavigate(route, this.page);
            return;
        }

        const page = new Page({ ...this.context, route });
        let html;

        try {
            html = await page.render();
        } catch (error) {
            if (id === this.navigationId) {
                this.showError(error);
            }

            return;
        }

        // A newer navigation started while this one was loading
        if (id !== this.navigationId) {
            return;
        }

        const isFirst = !this.page;
        const commit = () => {
            if (id !== this.navigationId) {
                return;
            }

            this.page?.unmount?.();
            this.view.innerHTML = html;
            this.page = page;
            page.mount(this.view);

            if (!isFirst) {
                window.scrollTo({ top: 0, left: 0, behavior: "instant" });
            }

            this.onNavigate(route, page);
        };

        if (!isFirst && document.startViewTransition && !prefersReducedMotion()) {
            const transition = document.startViewTransition(commit);

            // A newer navigation skips this transition: its promises reject, which is expected
            transition.ready.catch(() => {});
            await transition.updateCallbackDone.catch(() => {});
        } else {
            commit();
        }
    }

    showError(error) {
        console.error(error);

        this.page?.unmount?.();
        this.page = null;
        this.view.innerHTML = `
            <div class="state" role="alert">
                <p>Something went wrong while loading this page.</p>
                <button class="btn" type="button" data-retry-route>Try again</button>
            </div>`;
        this.view.querySelector("[data-retry-route]").addEventListener("click", () => this.navigate(), { once: true });
    }
}
