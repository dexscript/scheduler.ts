import scheduler, {Actor, Task} from "../src/scheduler"

beforeEach(() => {
    scheduler.reset();
});

describe("asyncServe", () => {
    it("async respond", async () => {
        let server = new Actor(async function () {
            let caller: Task = null
            let val = 0
            await scheduler.asyncServe(this, {
                // asyncServe will pass the caller as first argument
                addOne: (_caller: Task, _val: number) => {
                    caller = _caller
                    val = _val + 1
                }
            })
            await scheduler.sleep(this, 100)
            caller.resolve(val)
        })
        let client = new Actor(async function () {
            return await scheduler.stub(this, server.id).addOne(1)
        })
        expect(await client.result).toEqual(2)
    });
    it("async server failure propagated to client", async () => {
        let server = new Actor(async function () {
            await scheduler.asyncServe(this, {
                addOne: (_caller: Task, _val: number) => {
                    throw 'hello'
                }
            })
        })
        let client = new Actor(async function () {
            try {
                await scheduler.stub(this, server.id).addOne(1)
            } catch (e) {
                return e
            }
        })
        expect(await client.result).toEqual('hello')
    });
})