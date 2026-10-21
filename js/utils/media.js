// Same breakpoint as the 900px media queries in css/
export const MOBILE_QUERY = "(max-width: 900px)";

export function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
}

export function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
