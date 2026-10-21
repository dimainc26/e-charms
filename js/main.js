import { App } from "./core/App.js";

const app = document.querySelector("#app");

if (!app) {
    throw new Error("Root element #app not found");
}

new App(app).start();
