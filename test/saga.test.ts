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
    it("1pc - idempotence", async () => {
        let wallet = new Actor(async function () {
            let amount = 500 // dollar
            let historicalActions = []
            while (true) {
                await scheduler.serve(this, {
                    charge: (txId: string, val: number) => {
                        for (let action of historicalActions) {
                            if (action.txId === txId) {
                                return true // idempotent
                            }
                        }
                        let newAmount = amount - val
                        if (newAmount < 0) {
                            return false
                        }
                        historicalActions.push(
                            {txId: txId, val: val})
                        amount = newAmount
                        return true
                    }
                })
            }
        })
        let transaction1 = new Actor(async function () {
            let actorId = this;
            // charge twice
            await scheduler.stub(actorId, wallet.id).charge(actorId, 300)
            let _wallet = scheduler.stub(actorId, wallet.id)
            return await _wallet.charge(actorId, 300)
        })
        let transaction2 = new Actor(async function () {
            let actorId = this;
            await scheduler.sleep(actorId, 100)
            let _wallet = scheduler.stub(actorId, wallet.id)
            return await _wallet.charge(actorId, 300)
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
        let transfer = async function (
            fromWalletId: string, toWalletId: string, val: number) {

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
    it("composable 2pc", async () => {
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
        let walletTx = async function (walletId: string, val: number) {
            let wallet = scheduler.stub(this, walletId)
            let result = await scheduler.serve(this, {
                stage: () => {
                    return wallet.stage(val)
                }
            })
            if (!result.returnValue) {
                return
            }
            return await scheduler.serve(this, {
                commit: () => {
                    return wallet.commit(val)
                },
                abort: () => {
                    return wallet.abort(val)
                }
            })
        }
        let saga = async function (...txIds: string[]) {
            let transactions: any[] = []
            for (let txId of txIds) {
                transactions.push(scheduler.stub(this, txId))
            }
            let staged: any[] = []
            for (let tx of transactions) {
                if (!await tx.stage()) {
                    for (let abortTx of staged) {
                        await abortTx.abort()
                    }
                    return false
                }
                staged.push(tx)
            }
            for (let tx of staged) {
                await tx.commit()
            }
            return true
        }
        let wallet1 = new Actor(wallet, 500)
        let wallet2 = new Actor(wallet, 300)
        let wallet1TransferOut = new Actor(walletTx, wallet1.id, -300)
        let wallet2TransferIn = new Actor(walletTx, wallet2.id, 300)
        let transfer = new Actor(saga, wallet1TransferOut.id, wallet2TransferIn.id)
        expect(await transfer.result).toEqual(true)
        expect(await scheduler.stub('', wallet1.id).getAmount()).toEqual(200)
        expect(await scheduler.stub('', wallet2.id).getAmount()).toEqual(600)
    })
    it("aggregated payment", async () => {
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
        let coupon = async function () {
            let used = false
            let staged = false
            while (true) {
                await scheduler.serve(this, {
                    stage: () => {
                        if (used || staged) {
                            return false
                        }
                        staged = true
                        return true
                    },
                    commit: () => {
                        used = true
                        staged = false
                        return true
                    },
                    abort: () => {
                        staged = false
                        return true
                    },
                    isUsed: () => {
                        return used
                    }
                })
            }
        }
        let walletTx = async function (walletId: string, val: number) {
            let wallet = scheduler.stub(this, walletId)
            let result = await scheduler.serve(this, {
                stage: () => {
                    return wallet.stage(val)
                }
            })
            if (!result.returnValue) {
                return
            }
            return await scheduler.serve(this, {
                commit: () => {
                    return wallet.commit(val)
                },
                abort: () => {
                    return wallet.abort(val)
                }
            })
        }
        let saga = async function (...txIds: string[]) {
            let transactions: any[] = []
            for (let txId of txIds) {
                transactions.push(scheduler.stub(this, txId))
            }
            let staged: any[] = []
            for (let tx of transactions) {
                if (!await tx.stage()) {
                    for (let abortTx of staged) {
                        await abortTx.abort()
                    }
                    return false
                }
                staged.push(tx)
            }
            for (let tx of staged) {
                await tx.commit()
            }
            return true
        }
        let wallet1 = new Actor(wallet, 500)
        let wallet2 = new Actor(wallet, 300)
        let wallet1TransferOut = new Actor(walletTx, wallet1.id, -600)
        let wallet2TransferIn = new Actor(walletTx, wallet2.id, 600)
        let couponUse = new Actor(coupon)
        let transfer = new Actor(saga, couponUse.id, wallet1TransferOut.id, wallet2TransferIn.id)
        expect(await transfer.result).toEqual(false)
        expect(await scheduler.stub('', wallet1.id).getAmount()).toEqual(500)
        expect(await scheduler.stub('', wallet2.id).getAmount()).toEqual(300)
        // coupon use has been rolled back
        expect(await scheduler.stub('', couponUse.id).isUsed()).toEqual(false)
    })
})