
import { HomePage } from "./components/HomePage.js";

const app = document.querySelector("#app");

if (!app) {
    throw new Error("Root element #app not found");
}

const page = new HomePage();

app.innerHTML = await page.render();
page.mount(app);
