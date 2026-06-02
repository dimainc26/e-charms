export class Component {
    constructor() {
        this.root = null;
    }

    async mount(root) {
        this.root = root;
        this.root.innerHTML = await this.render();
    }

    async update() {
        if (!this.root) return;
        this.root.innerHTML = await this.render();
    }

    render() {
        return "";
    }
}