import { loadHtml } from "../utils/dom.js";

export class ProfilePage {
    get title() {
        return "Profile · E-Charms Store";
    }

    render() {
        return loadHtml(new URL("../../templates/pages/ProfilePage.html", import.meta.url));
    }

    mount() {}

    unmount() {}
}
