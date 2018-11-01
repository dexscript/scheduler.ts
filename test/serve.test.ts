import scheduler, {Actor} from "../src/scheduler"

beforeEach(() => {
    scheduler.reset();
});

describe("serve", () => {
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
    it("serve is one time", async () => {
        let server = new Actor(async function () {
            await scheduler.serve(this, {
                addOne: (val: number) => val + 1
            })
        })
        let client = new Actor(async function () {
            let stub = scheduler.stub(this, server.id)
            await stub.addOne(1)
            return await stub.addOne(1)
        })
        try {
            await client.result
            fail()
        } catch (e) {
            expect(e).not.toBeNull()
        }
    });
    it("call can choose method", async () => {
        let server = new Actor(async function () {
            while (true) {
                await scheduler.serve(this, {
                    addOne: (val: number) => val + 1,
                    subOne: (val: number) => val - 1
                })
            }
        })
        let client = new Actor(async function () {
            let stub = scheduler.stub(this, server.id)
            let result = await stub.addOne(1)
            result += await stub.subOne(1)
            return result
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
    it("call should propagate exception", async () => {
        let server = new Actor(async function () {
            try {
                await scheduler.sleep(this, 100)
                await scheduler.serve(this, {
                    addOne: (val: number) => {
                        throw val + 1
                    }
                })
            } catch (e) {
            }
        })
        let client = new Actor(async function () {
            try {
                await scheduler.stub(this, server.id).addOne(1)
            } catch (e) {
                return e
            }
        })
        expect(await client.result).toEqual(2)
    })
});