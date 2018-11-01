import scheduler, {Actor} from "../src/scheduler"

beforeEach(() => {
    scheduler.reset();
});

describe("scheduler call", () => {
    it("serve before call", async () => {
        let server = new Actor(async function () {
            await scheduler.serve(this, {
                addOne: (val: number) => val + 1
            })
        })
        let client = new Actor(async function () {
            return await scheduler.stub(this, server.id).addOne(1)
        })
        expect(await client.result).toEqual(2)
    });
    it("call before serve", async () => {
        let server = new Actor(async function () {
            await scheduler.sleep(this, 100)
            await scheduler.serve(this, {
                addOne: (val: number) => val + 1
            })
        })
        let client = new Actor(async function () {
            return await scheduler.stub(this, server.id).addOne(1)
        })
        expect(await client.result).toEqual(2)
    })
    it("call not existing method after serve", async () => {
        let server = new Actor(async function () {
            await scheduler.serve(this, {})
        })
        let client = new Actor(async function () {
            return await scheduler.stub(this, server.id).addOne(1)
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
            await scheduler.sleep(this, 100)
            await scheduler.serve(this, {})
        })
        let client = new Actor(async function () {
            return await scheduler.stub(this, server.id).addOne(1)
        })
        try {
            await client.result
            fail()
        } catch (e) {
            expect(e).not.toBeNull()
        }
    })
});