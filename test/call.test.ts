import scheduler, {Actor} from "../src/scheduler"

beforeEach(() => {
    scheduler.reset();
});

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
            return await scheduler.call(me, server.id, 'add_one', 1)
        })
        expect(await client.result).toEqual(2)
    });
    it("call before serve", async () => {
        let server = new Actor(async function () {
            let me = this
            await scheduler.sleep(me, 100)
            await scheduler.serve(me, {
                add_one: (val: number) => val + 1
            })
        })
        let client = new Actor(async function () {
            let me = this
            return await scheduler.call(me, server.id, 'add_one', 1)
        })
        expect(await client.result).toEqual(2)
    })
    it("call not existing method after serve", async () => {
        let server = new Actor(async function () {
            let me = this
            await scheduler.serve(me, {})
        })
        let client = new Actor(async function () {
            let me = this
            return await scheduler.call(me, server.id, 'add_one', 1)
        })
        try {
            await client.result
            fail()
        } catch (e) {
            expect(e).not.toBeNull()
        }
    })
    it("call not existing method before serve", async () => {
        let server = new Actor(async function () {
            let me = this
            await scheduler.sleep(me, 100)
            await scheduler.serve(me, {})
        })
        let client = new Actor(async function () {
            let me = this
            return await scheduler.call(me, server.id, 'add_one', 1)
        })
        try {
            await client.result
            fail()
        } catch (e) {
            expect(e).not.toBeNull()
        }
    })
});