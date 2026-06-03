import { UnsplashService } from "../services/UnsplashService.js";
import { loadHtml } from "../utils/dom.js";

export class HomePage {
    constructor() {
        this.unsplashService = new UnsplashService();
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

        const images = await this.unsplashService.searchPhotos(
            "woman fashion studio white background",
            8,
        );

        images.forEach((item) => {
            const card = template.content.cloneNode(true);
            const image = card.querySelector("[data-image]");
            const author = card.querySelector("[data-author]");
            const source = card.querySelector("[data-source]");

            image.src = item.imageUrl;
            image.alt = item.alt;

            author.href = item.authorUrl;
            author.textContent = item.authorName;

            // source.href = item.sourceUrl;

            gallery.appendChild(card);
        });

        template.remove();

        return container.innerHTML;
    }
}
