import scheduler, {Actor} from "../src/scheduler"

beforeEach(() => {
    scheduler.reset();
});

describe("saga", () => {
    it("1pc - one phase commit", async () => {
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
    it("2pc - two phase commit", async () => {
        let wallet = async function (initAmount: number) {
            let amount = initAmount // dollar
            let stagingAmount = 0
            while (true) {
                await scheduler.serve(this, {
                    stage: (val: number) => {
                        if (val > 0) {
                            stagingAmount += val
                            return true
                        }
                        let newAmount = amount + val
                        if (newAmount < 0) {
                            return false
                        }
                        amount = newAmount
                        stagingAmount -= val
                        return true
                    },
                    commit: (val: number) => {
                        if (val > 0) {
                            stagingAmount -= val
                            amount += val
                            return
                        }
                        stagingAmount += val
                    },
                    abort: (val: number) => {
                        if (val > 0) {
                            stagingAmount -= val
                            return
                        }
                        stagingAmount += val
                        amount -= val
                    },
                    getAmount: () => {
                        return amount
                    }
                })
            }
        }
        let wallet1 = new Actor(wallet, 500)
        let wallet2 = new Actor(wallet, 300)
        let transfer = async function (fromWalletId: string, toWalletId: string, val: number) {
            let fromWallet = scheduler.stub(this, fromWalletId)
            let toWallet = scheduler.stub(this, toWalletId)
            if (!await fromWallet.stage(-val)) {
                return false
            }
            if (!await toWallet.stage(val)) {
                fromWallet.abort(-val)
                return false
            }
            await fromWallet.commit(-val)
            await toWallet.commit(val)
            return true
        }
        let transaction1 = new Actor(transfer, wallet1.id, wallet2.id, 300)
        expect(await transaction1.result).toEqual(true)
        expect(await scheduler.stub('', wallet1.id).getAmount()).toEqual(200)
        expect(await scheduler.stub('', wallet2.id).getAmount()).toEqual(600)
    });
})