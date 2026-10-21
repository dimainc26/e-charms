import { CartService, MAX_QUANTITY } from "../services/CartService.js";
import { cloneTemplate } from "../utils/dom.js";
import { formatCents, priceCentsOf } from "../utils/format.js";
import { applyImage } from "../utils/images.js";

// Shared by every "Add to bag" button
export function addToBag(item, { toast, sheets }) {
    const line = CartService.add(item);

    if (!line) {
        toast.show(`You can add up to ${MAX_QUANTITY} of each item.`);
        return;
    }

    toast.show(line.quantity > 1 ? `Quantity updated: ${line.quantity} in bag` : "Added to bag", {
        actionLabel: "View bag",
        onAction: () => sheets.open("cart", document.querySelector('[data-sheet-open="cart"]')),
    });
}

// The bag sheet and the badge on the Bag button, kept in sync with CartService.
export class CartSheet {
    constructor(root, { toast }) {
        this.root = root;
        this.toast = toast;
        this.count = 0;
    }

    mount() {
        this.trigger = this.root.querySelector('[data-sheet-open="cart"]');
        this.badge = this.root.querySelector("[data-cart-badge]");
        this.body = this.root.querySelector("[data-cart-body]");
        this.footer = this.root.querySelector("[data-cart-footer]");
        this.countLabel = this.root.querySelector("[data-cart-count]");
        this.subtotal = this.root.querySelector("[data-cart-subtotal]");
        this.status = this.root.querySelector("[data-cart-status]");

        this.body.addEventListener("click", (event) => this.onBodyClick(event));
        this.root.querySelector("[data-cart-checkout]").addEventListener("click", () => {
            this.toast.show("Checkout isn't available in this demo yet.");
        });

        CartService.subscribe(() => this.render());
        this.render();
    }

    onBodyClick(event) {
        const row = event.target.closest("[data-item-id]");

        if (!row) {
            return;
        }

        const items = CartService.getAll();
        const item = items.find((line) => line.id === row.dataset.itemId);

        if (!item) {
            return;
        }

        const stepper = event.target.closest("[data-qty]");

        if (stepper) {
            // aria-disabled (not disabled) keeps keyboard focus on the button at the limit
            if (stepper.getAttribute("aria-disabled") === "true") {
                return;
            }

            const quantity = item.quantity + Number(stepper.dataset.qty);

            CartService.setQuantity(item.id, quantity);
            this.status.textContent = `${item.name}: quantity ${quantity}`;
            return;
        }

        if (event.target.closest("[data-remove]")) {
            this.removeItem(item, items);
        }
    }

    removeItem(item, items) {
        const index = items.indexOf(item);
        const neighbour = items[index + 1] ?? items[index - 1];
        const removed = CartService.remove(item.id);

        // The row is gone: keep keyboard focus inside the sheet
        const next = neighbour && this.body.querySelector(`[data-item-id="${CSS.escape(neighbour.id)}"] [data-remove]`);

        (next || this.body.querySelector("[data-sheet-close]"))?.focus({ preventScroll: true });

        this.toast.show("Removed from bag", {
            actionLabel: "Undo",
            onAction: () => CartService.insert(removed.item, removed.index),
        });
    }

    render() {
        const items = CartService.getAll();
        const count = CartService.count();
        const focused = this.captureFocus();

        this.updateBadge(count);
        this.countLabel.textContent = count ? `(${count})` : "";
        this.footer.hidden = items.length === 0;
        this.body.classList.toggle("sheet__body--list", items.length > 0);
        this.subtotal.textContent = formatCents(CartService.subtotalCents());

        if (items.length === 0) {
            this.body.replaceChildren(this.buildEmpty());
        } else {
            const list = document.createElement("ul");

            list.className = "cart-list";
            list.append(...items.map((item) => this.buildRow(item)));
            this.body.replaceChildren(list);
        }

        this.restoreFocus(focused);
    }

    updateBadge(count) {
        this.badge.textContent = count > 99 ? "99+" : String(count);
        this.badge.hidden = count === 0;
        this.trigger.setAttribute("aria-label", count ? `Shopping bag, ${count} item${count === 1 ? "" : "s"}` : "Shopping bag");

        if (count > this.count) {
            this.badge.classList.remove("nav-badge--bump");
            void this.badge.offsetWidth;
            this.badge.classList.add("nav-badge--bump");
        }

        this.count = count;
    }

    buildEmpty() {
        const fragment = document.createDocumentFragment();
        const message = document.createElement("p");
        const button = document.createElement("button");

        message.className = "sheet__empty";
        message.textContent = "Your bag is empty.";
        button.className = "btn btn--ghost";
        button.type = "button";
        button.textContent = "Continue shopping";
        button.dataset.sheetClose = "";
        fragment.append(message, button);

        return fragment;
    }

    buildRow(item) {
        const row = cloneTemplate(this.root, "[data-cart-item]");
        const unit = priceCentsOf(item);
        const atMin = item.quantity <= 1;
        const atMax = item.quantity >= MAX_QUANTITY;

        row.dataset.itemId = item.id;
        row.querySelector("[data-media]").style.backgroundColor = item.color || "";
        applyImage(row.querySelector("[data-image]"), item, "72px", { eager: true });
        row.querySelector("[data-name]").textContent = item.name;
        row.querySelector("[data-price]").textContent = formatCents(unit);
        row.querySelector("[data-quantity]").textContent = String(item.quantity);
        row.querySelector("[data-line-total]").textContent = formatCents(unit * item.quantity);

        row.querySelector(".qty").setAttribute("aria-label", `Quantity of ${item.name}`);

        const minus = row.querySelector('[data-qty="-1"]');
        const plus = row.querySelector('[data-qty="1"]');

        minus.setAttribute("aria-label", `Decrease quantity of ${item.name}`);
        minus.setAttribute("aria-disabled", String(atMin));
        plus.setAttribute("aria-label", `Increase quantity of ${item.name}`);
        plus.setAttribute("aria-disabled", String(atMax));
        row.querySelector("[data-remove]").setAttribute("aria-label", `Remove ${item.name} from bag`);

        return row;
    }

    // A re-render replaces the buttons: put focus back on the one that was used
    captureFocus() {
        const active = document.activeElement;
        const row = active?.closest?.("[data-item-id]");

        if (!row || !this.body.contains(active)) {
            return null;
        }

        const action = active.dataset.qty ?? (active.hasAttribute("data-remove") ? "remove" : null);

        return action ? { id: row.dataset.itemId, action } : null;
    }

    restoreFocus(target) {
        if (!target) {
            return;
        }

        const row = this.body.querySelector(`[data-item-id="${CSS.escape(target.id)}"]`);
        const selector = target.action === "remove" ? "[data-remove]" : `[data-qty="${target.action}"]`;

        row?.querySelector(selector)?.focus({ preventScroll: true });
    }
}
