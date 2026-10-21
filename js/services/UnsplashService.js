import { ApiError, ApiService } from "./ApiService.js";

// The demo tier allows 50 requests/hour: keep results for the whole session
// and fall back to a stale copy if the API refuses us.
const CACHE_PREFIX = "e-charms:unsplash:";
const CACHE_TTL = 30 * 60 * 1000;
const inflight = new Map();

function readCache(key) {
    try {
        return JSON.parse(sessionStorage.getItem(CACHE_PREFIX + key));
    } catch {
        return null;
    }
}

function writeCache(key, photos) {
    try {
        sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ time: Date.now(), photos }));
    } catch {
        // storage full or unavailable: the request just won't be cached
    }
}

export class UnsplashService {
    constructor() {
        this.baseUrl = "https://api.unsplash.com";
        this.accessKey = window.APP_CONFIG?.UNSPLASH_ACCESS_KEY;

        if (!this.accessKey) {
            throw new ApiError(
                "Missing Unsplash access key. Copy js/config.example.js to js/config.js and add your key.",
                { code: "config" },
            );
        }
    }

    async searchPhotos(query = "fashion model white background", perPage = 30) {
        const key = `${query}|${perPage}`;
        const cached = readCache(key);

        if (cached && Date.now() - cached.time < CACHE_TTL) {
            return cached.photos;
        }

        if (!inflight.has(key)) {
            const request = this.fetchPhotos(query, perPage)
                .then((photos) => {
                    writeCache(key, photos);

                    return photos;
                })
                .catch((error) => {
                    if (cached) {
                        return cached.photos;
                    }

                    throw error;
                })
                .finally(() => inflight.delete(key));

            inflight.set(key, request);
        }

        return inflight.get(key);
    }

    async fetchPhotos(query, perPage) {
        const params = new URLSearchParams({
            query,
            per_page: String(perPage),
            orientation: "portrait",
            content_filter: "high",
        });

        const data = await ApiService.getJson(`${this.baseUrl}/search/photos?${params}`, {
            headers: { Authorization: `Client-ID ${this.accessKey}` },
        });

        return data.results.map((photo) => ({
            id: photo.id,
            imageUrl: photo.urls.regular,
            thumbUrl: photo.urls.small,
            rawUrl: photo.urls.raw,
            alt: photo.alt_description || photo.description || "Fashion image",
            color: photo.color,
            authorName: photo.user.name,
            authorUrl: photo.user.links.html,
            sourceUrl: photo.links.html,
        }));
    }
}
