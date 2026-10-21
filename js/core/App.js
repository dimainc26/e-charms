import { Shell } from "../components/Shell.js";
import { Toast } from "../components/Toast.js";
import { CartSheet } from "../components/CartSheet.js";
import { HomePage } from "../components/HomePage.js";
import { FavoritePage } from "../components/FavoritePage.js";
import { ProfilePage } from "../components/ProfilePage.js";
import { Store, DEFAULT_FILTERS } from "../store/Store.js";
import { Router } from "./Router.js";
import { Sheets } from "./Sheets.js";

const DEFAULT_TITLE = "E-Charms Store";

export class App {
    constructor(root) {
        this.root = root;
    }

    async start() {
        const store = new Store({ query: "", filters: DEFAULT_FILTERS });
        const shell = new Shell(this.root, { store });

        try {
            await shell.mount();
        } catch (error) {
            console.error(error);
            this.root.textContent = "We couldn't load the store. Please refresh the page.";
            return;
        }

        const sheets = new Sheets(this.root);
        const toast = new Toast(this.root.querySelector("[data-toast]"));

        sheets.init();
        new CartSheet(this.root, { toast }).mount();

        const router = new Router({
            view: shell.view,
            pages: { shop: HomePage, favorites: FavoritePage, profile: ProfilePage },
            context: { store, sheets, toast },
            onNavigate: (route, page) => {
                shell.setRoute(route);
                document.title = page.title ?? DEFAULT_TITLE;
            },
        });

        await router.start();
    }
}
