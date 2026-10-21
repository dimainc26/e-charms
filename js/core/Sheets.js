// Modal panels (bag, filters). One open at a time. While open: the rest of the
// page is inert (keyboard and screen readers stay inside), scrolling is locked,
// focus is moved in and restored, and the browser/Android back button closes it.
export class Sheets {
    constructor(root) {
        this.root = root;
        this.current = null;
    }

    init() {
        this.root.addEventListener("click", (event) => {
            const opener = event.target.closest("[data-sheet-open]");

            if (opener) {
                event.preventDefault();
                this.open(opener.dataset.sheetOpen, opener);
                return;
            }

            if (event.target.closest("[data-sheet-close]")) {
                event.preventDefault();
                this.close();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && this.current) {
                this.close();
            }
        });

        window.addEventListener("popstate", () => {
            if (this.current && !window.history.state?.sheet) {
                this.hide();
            }
        });

        // A reload while a sheet was open leaves its history marker behind
        if (window.history.state?.sheet) {
            window.history.replaceState(null, "");
        }
    }

    open(name, trigger) {
        const shell = this.root.querySelector(`[data-sheet="${name}"]`);

        if (!shell || this.current) {
            return;
        }

        this.current = { name, shell, trigger };
        window.history.pushState({ sheet: name }, "");

        this.root.querySelectorAll("[data-sheet-inert]").forEach((element) => {
            element.inert = true;
        });
        this.setExpanded(name, true);
        shell.classList.add("sheet-shell--open");
        shell.setAttribute("aria-hidden", "false");
        document.body.classList.add("sheet-is-open");

        const focusTarget = shell.querySelector("[data-sheet-initial-focus]")
            ?? shell.querySelector("input:checked, button, [href]");

        focusTarget?.focus({ preventScroll: true });
    }

    close() {
        if (!this.current) {
            return;
        }

        if (window.history.state?.sheet) {
            window.history.back();
        } else {
            this.hide();
        }
    }

    hide() {
        const { name, shell, trigger } = this.current;

        this.current = null;
        shell.classList.remove("sheet-shell--open");
        shell.setAttribute("aria-hidden", "true");
        document.body.classList.remove("sheet-is-open");
        this.root.querySelectorAll("[data-sheet-inert]").forEach((element) => {
            element.inert = false;
        });
        this.setExpanded(name, false);

        if (trigger?.isConnected) {
            trigger.focus({ preventScroll: true });
        }
    }

    setExpanded(name, expanded) {
        this.root.querySelectorAll(`[data-sheet-open="${name}"]`).forEach((trigger) => {
            trigger.setAttribute("aria-expanded", String(expanded));
        });
    }
}
