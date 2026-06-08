
import { HomePage } from "./components/HomePage.js";
import { FavoritePage } from "./components/FavoritePage.js";
import { ProfilePage } from "./components/ProfilePage.js";

const app = document.querySelector("#app");

if (!app) {
    throw new Error("Root element #app not found");
}

function getCartElements() {
    const shell = app.querySelector("[data-cart-shell]");
    const toggles = app.querySelectorAll("[data-cart-toggle]");

    return { shell, toggles };
}

function openCart() {
    const { shell, toggles } = getCartElements();

    if (!shell) return;

    shell.classList.add("cart-shell--open");
    shell.setAttribute("aria-hidden", "false");
    document.body.classList.add("cart-is-open");
    toggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "true"));
}

function closeCart() {
    const { shell, toggles } = getCartElements();

    if (!shell) return;

    shell.classList.remove("cart-shell--open");
    shell.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cart-is-open");
    toggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
}

app.addEventListener("click", (event) => {
    const cartToggle = event.target.closest("[data-cart-toggle]");
    const cartClose = event.target.closest("[data-cart-close]");

    if (cartToggle && app.contains(cartToggle)) {
        event.preventDefault();
        openCart();
        return;
    }

    if (cartClose && app.contains(cartClose)) {
        event.preventDefault();
        closeCart();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeCart();
    }
});

async function renderRoute() {
    const routes = {
        "#favorites": FavoritePage,
        "#profile": ProfilePage,
    };
    const Page = routes[window.location.hash] ?? HomePage;
    const page = new Page();

    app.innerHTML = await page.render();
    page.mount(app);
}

window.addEventListener("hashchange", renderRoute);

await renderRoute();
