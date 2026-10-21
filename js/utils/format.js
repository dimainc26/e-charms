export function formatCents(cents) {
    return `€ ${(cents / 100).toFixed(2)}`;
}

// Prices travel as strings ("€ 75.99") in older saved items: read them back as cents.
export function priceCentsOf(item) {
    if (Number.isFinite(item.priceCents)) {
        return item.priceCents;
    }

    const value = parseFloat(String(item.price ?? "").replace(/[^0-9.]/g, ""));

    return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
