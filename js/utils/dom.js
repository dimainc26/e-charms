export async function loadHtml(path) {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Unable to load template: ${path}`);
    }

    return response.text();
}
