export const DEFAULT_FILTERS = Object.freeze({ sort: "featured", price: "any" });

// Tiny observable: a shallow-merging state container with subscribe().
export class Store {
    constructor(initial = {}) {
        this.state = { ...initial };
        this.listeners = new Set();
    }

    set(patch) {
        const changed = Object.keys(patch).some((key) => !Object.is(this.state[key], patch[key]));

        if (!changed) {
            return;
        }

        this.state = { ...this.state, ...patch };
        this.listeners.forEach((listener) => listener(this.state));
    }

    subscribe(listener) {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }
}
