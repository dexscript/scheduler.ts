import {v4 as uuid} from 'uuid'

type Server = {
    methods: { [key: string]: Function }
    resolve: Resolve
    reject: Reject
}
type Resolve = (obj: any) => void
type Reject = (obj: any) => void

let scheduler = new (class {

    servers: { [key: string]: Server }

    constructor() {
        this.servers = {}
    }

    serve(actor: Actor, methods: { [key: string]: Function }) {
        return new Promise((resolve, reject) => {
            this.servers[actor.id] = {
                methods: methods,
                resolve: resolve,
                reject: reject
            }
        })
    }

    call(caller: Actor, callee: Actor, method_name: string, ...args: any[]) {
        let server = this.servers[callee.id]
        let method = server.methods[method_name]
        return method.apply(this, args)
    }

    sleep(actor: Actor, duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration))
    }
})()

class Actor {

    id: string

    constructor(f: Function, ...args: any[]) {
        this.id = uuid()
        f.apply(this, args)
    }
}


async function A(b: Actor) {
    let me = this
    let result = await scheduler.call(me, b, 'add_one', 1)
    console.log(result)
}

async function B() {
    let me = this
    await scheduler.serve(me, {
        add_one: (val: number) => val + 1
    })
    await scheduler.sleep(me, 1000)
    await scheduler.serve(me, {
        sub_one: (val: number) => val - 1
    })
}

let b = new Actor(B)
new Actor(A, b)