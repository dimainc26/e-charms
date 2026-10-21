import { formatCents } from "./format.js";

const PRODUCT_NAMES = [
    "Linen 100% shirt", "Cargo jumpsuit with pockets", "Straight-fit cropped jeans",
    "Regular flowy shirt", "Bow long jumpsuit", "V-neck knit sweater",
    "Buttoned cotton shirt", "Oversized blazer", "Ribbed tank top",
    "Wide leg trousers", "Wrap midi dress", "Cropped denim jacket",
];

// FNV-1a: stable across sessions, so a photo always gets the same name and price.
function hash(text) {
    let value = 2166136261;

    for (const char of text) {
        value ^= char.codePointAt(0);
        value = Math.imul(value, 16777619);
    }

    return value >>> 0;
}

export function productFor(photo) {
    const seed = hash(photo.id);
    const euros = 9 + (seed % 191);
    const priceCents = euros * 100 + 99;

    return {
        ...photo,
        name: PRODUCT_NAMES[(seed >>> 11) % PRODUCT_NAMES.length],
        priceValue: euros,
        priceCents,
        price: formatCents(priceCents),
    };
}
