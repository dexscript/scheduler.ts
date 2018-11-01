import scheduler, {Actor} from "../src/scheduler"

describe("scheduler call", () => {
    it("serve before call", async () => {
        let server = new Actor(async function () {
            let me = this
            await scheduler.serve(me, {
                add_one: (val: number) => val + 1
            })
        })
        let client = new Actor(async function () {
            let me = this
            return await scheduler.call(me, server, 'add_one', 1)
        })
        expect(await client.result).toEqual(2)
    });
    it("call before serve", async () => {
        let server = new Actor(async function() {
            let me = this
            await scheduler.sleep(me, 1000)
            await scheduler.serve(me, {
                add_one: (val: number) => val + 1
            })
        })
        let client = new Actor(async function(server: Actor) {
            let me = this
            return await scheduler.call(me, server, 'add_one', 1)
        })
        expect(await client.result).toEqual(2)
    })
});