import { UnsplashService } from "../services/UnsplashService.js";

export class HomePage {
    constructor() {
        this.unsplashService = new UnsplashService();
    }

    async render() {
        const images = await this.unsplashService.searchPhotos(
            "woman fashion studio white background",
            8,
        );

        return `
      <section class="fashion-gallery">
        ${images
                .map(
                    (item) => `
              <article class="fashion-card">
                <img 
                  src="${item.imageUrl}" 
                  alt="${item.alt}" 
                  class="fashion-card__image"
                />

                <p class="fashion-card__credit">
                  Foto di 
                  <a href="${item.authorUrl}" target="_blank" rel="noreferrer">
                    ${item.authorName}
                  </a>
                  su
                  <a href="${item.sourceUrl}" target="_blank" rel="noreferrer">
                    Unsplash
                  </a>
                </p>
              </article>
            `,
                )
                .join("")}
      </section>
    `;
    }
}