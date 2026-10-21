export class Toast {
    constructor(element) {
        this.element = element;
        this.message = element.querySelector("[data-toast-message]");
        this.action = element.querySelector("[data-toast-action]");
        this.timer = 0;
        this.onAction = null;

        this.action.addEventListener("click", () => {
            const callback = this.onAction;

            this.hide();
            callback?.();
        });
    }

    show(message, { actionLabel, onAction, duration = 6000 } = {}) {
        window.clearTimeout(this.timer);

        this.message.textContent = message;
        this.onAction = actionLabel ? onAction : null;
        this.action.hidden = !actionLabel;
        this.action.textContent = actionLabel ?? "";
        this.element.classList.add("toast--visible");

        this.timer = window.setTimeout(() => this.hide(), duration);
    }

    hide() {
        window.clearTimeout(this.timer);
        this.element.classList.remove("toast--visible");
        this.onAction = null;
    }
}
