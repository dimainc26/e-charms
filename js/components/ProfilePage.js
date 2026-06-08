import { loadHtml } from "../utils/dom.js";

export class ProfilePage {
    async render() {
        const templateUrl = new URL("../../templates/pages/ProfilePage.html", import.meta.url);
        const html = await loadHtml(templateUrl);
        const container = document.createElement("div");

        container.innerHTML = html;

        return container.innerHTML;
    }

    mount() {}
}
