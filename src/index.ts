import { v4 as uuid } from 'uuid'

console.log(uuid())

let scheduler = new (class {
    constructor() {

    }
    serve(actor: Actor, methods: {[key: string]: any}) {
        return new Promise(resolve => resolve())
    }
    sleep(actor: Actor, duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration))
    }
})()

class Actor{
    constructor(f: any) {
    }
}


async function A(b: Actor) {
    let me = this;
}

async function B() {
    let me = this;
    await scheduler.serve(me, {
        add_one: (val: number) => val + 1
    })
    await scheduler.sleep(me, 1000)
    await scheduler.serve(me, {
        sub_one: (val: number) => val - 1
    })
}

B()