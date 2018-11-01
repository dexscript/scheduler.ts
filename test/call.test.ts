import scheduler, {Actor} from "../src/scheduler"

describe("scheduler call", () => {
    it("serve before call", async () => {
        let b = new Actor(B)
        let a = new Actor(A, b)
        expect(await a.result).toEqual(2)
    });
});

async function A(b: Actor) {
    let me = this
    return await scheduler.call(me, b, 'add_one', 1)
}

async function B() {
    let me = this
    await scheduler.serve(me, {
        add_one: (val: number) => val + 1
    })
}