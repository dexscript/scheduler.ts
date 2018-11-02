import scheduler, {Actor} from "../src/scheduler"

beforeEach(() => {
    scheduler.reset();
});

describe("contention", () => {
    it("two transactions want to charge same wallet", async () => {
        let wallet = new Actor(async function () {
            let amount = 500 // dollar
            while (true) {
                await scheduler.serve(this, {
                    charge: (val: number) => {
                        let newAmount = amount - val
                        if (newAmount < 0) {
                            return false
                        }
                        amount = newAmount
                        return true
                    }
                })
            }
        })
        let transaction1 = new Actor(async function () {
            return await scheduler.stub(this, wallet.id).charge(300)
        })
        let transaction2 = new Actor(async function () {
            await scheduler.sleep(this, 100)
            return await scheduler.stub(this, wallet.id).charge(300)
        })
        expect(await transaction1.result).toEqual(true)
        expect(await transaction2.result).toEqual(false)
    });
})