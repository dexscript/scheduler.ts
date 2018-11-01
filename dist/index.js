"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
console.log(uuid_1.v4());
let scheduler = new (class {
    constructor() {
    }
    serve(actor, methods) {
        return new Promise(resolve => resolve());
    }
    sleep(actor, duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }
})();
class Actor {
    constructor(f) {
    }
}
async function A(b) {
    let me = this;
}
async function B() {
    let me = this;
    await scheduler.serve(me, {
        add_one: (val) => val + 1
    });
    await scheduler.sleep(me, 1000);
    await scheduler.serve(me, {
        sub_one: (val) => val - 1
    });
}
B();
//# sourceMappingURL=index.js.map