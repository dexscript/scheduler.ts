"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
let scheduler = new (class {
    constructor() {
        this.servers = {};
    }
    serve(actor, methods) {
        return new Promise((resolve, reject) => {
            this.servers[actor.id] = {
                methods: methods,
                resolve: resolve,
                reject: reject
            };
        });
    }
    call(caller, callee, method_name, ...args) {
        let server = this.servers[callee.id];
        let method = server.methods[method_name];
        return method.apply(this, args);
    }
    sleep(actor, duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }
})();
class Actor {
    constructor(f, ...args) {
        this.id = uuid_1.v4();
        f.apply(this, args);
    }
}
async function A(b) {
    let me = this;
    let result = await scheduler.call(me, b, 'add_one', 1);
    console.log(result);
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
let b = new Actor(B);
new Actor(A, b);
//# sourceMappingURL=index.js.map