export class ApiError extends Error {
    // code: "config" | "http" | "network" | "timeout"
    constructor(message, { code = "http", status = 0 } = {}) {
        super(message);
        this.name = "ApiError";
        this.code = code;
        this.status = status;
    }
}

export class ApiService {
    static async getJson(url, { headers, timeout = 10000 } = {}) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, { headers, signal: controller.signal });

            if (!response.ok) {
                throw new ApiError(`Request failed: ${response.status}`, { code: "http", status: response.status });
            }

            return await response.json();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }

            if (error.name === "AbortError") {
                throw new ApiError("Request timed out", { code: "timeout" });
            }

            throw new ApiError("Network error", { code: "network" });
        } finally {
            window.clearTimeout(timer);
        }
    }
}
