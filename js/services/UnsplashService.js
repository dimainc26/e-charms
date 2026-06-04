export class UnsplashService {
    constructor() {
        this.baseUrl = "https://api.unsplash.com";
        this.accessKey = window.APP_CONFIG?.UNSPLASH_ACCESS_KEY;

        if (!this.accessKey) {
            throw new Error("Missing Unsplash Access Key");
        }
    }

    async searchPhotos(query = "fashion model white background", perPage = 30) {
        const params = new URLSearchParams({
            query,
            per_page: String(perPage),
            orientation: "portrait",
            content_filter: "high",
        });

        const response = await fetch(`${this.baseUrl}/search/photos?${params}`, {
            headers: {
                Authorization: `Client-ID ${this.accessKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Unsplash error: ${response.status}`);
        }

        const data = await response.json();

        return data.results.map((photo) => ({
            id: photo.id,
            imageUrl: photo.urls.regular,
            thumbUrl: photo.urls.small,
            alt: photo.alt_description || photo.description || "Fashion image",
            color: photo.color,
            authorName: photo.user.name,
            authorUrl: photo.user.links.html,
            sourceUrl: photo.links.html,
        }));
    }
}