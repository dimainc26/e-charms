import { formatCents, priceCentsOf } from "../utils/format.js";

const STORAGE_KEY = "e-charms:cart";
export const MAX_QUANTITY = 10;

const listeners = new Set();
let cache = null;

function clampQuantity(value) {
    const quantity = Math.floor(Number(value));

    return Number.isFinite(quantity) ? Math.min(Math.max(quantity, 1), MAX_QUANTITY) : 1;
}

function emit() {
    listeners.forEach((listener) => listener());
}

function read() {
    if (cache) {
        return cache;
    }

    try {
        const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

        cache = Array.isArray(items)
            ? items
                .filter((item) => item && typeof item.id === "string")
                .map((item) => ({ ...item, quantity: clampQuantity(item.quantity ?? 1) }))
            : [];
    } catch {
        cache = [];
    }

    return cache;
}

function write(items) {
    cache = items;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        // storage unavailable: the bag lives in memory for this session
    }

    emit();
}

// Another tab changed the bag
window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
        cache = null;
        emit();
    }
});

// Bag lines are { id, name, price, priceCents, imageUrl, rawUrl, color, alt, quantity }.
// Money is always handled as integer cents.
export class CartService {
    static getAll() {
        return read();
    }

    static count() {
        return read().reduce((total, item) => total + item.quantity, 0);
    }

    static subtotalCents() {
        return read().reduce((total, item) => total + priceCentsOf(item) * item.quantity, 0);
    }

    // Returns the saved line, or null when that item is already at MAX_QUANTITY.
    static add(item, quantity = 1) {
        const items = read();
        const existing = items.find((line) => line.id === item.id);

        if (!existing) {
            const line = CartService.normalize(item, quantity);

            write([...items, line]);

            return line;
        }

        if (existing.quantity >= MAX_QUANTITY) {
            return null;
        }

        const line = { ...existing, quantity: clampQuantity(existing.quantity + quantity) };

        write(items.map((current) => (current === existing ? line : current)));

        return line;
    }

    static setQuantity(id, quantity) {
        write(read().map((line) => (line.id === id ? { ...line, quantity: clampQuantity(quantity) } : line)));
    }

    // Returns { item, index } so the removal can be undone in place.
    static remove(id) {
        const items = read();
        const index = items.findIndex((line) => line.id === id);

        if (index === -1) {
            return null;
        }

        write(items.filter((_, position) => position !== index));

        return { item: items[index], index };
    }

    static insert(item, index) {
        const items = read().filter((line) => line.id !== item.id);

        items.splice(Math.min(index, items.length), 0, item);
        write(items);
    }

    static subscribe(listener) {
        listeners.add(listener);

        return () => listeners.delete(listener);
    }

    static normalize(item, quantity) {
        const priceCents = priceCentsOf(item);

        return {
            id: item.id,
            name: item.name ?? "",
            price: formatCents(priceCents),
            priceCents,
            imageUrl: item.imageUrl,
            rawUrl: item.rawUrl ?? "",
            color: item.color ?? "",
            alt: item.alt ?? item.name ?? "Bag item",
            quantity: clampQuantity(quantity),
        };
    }
}
