import scheduler, {Actor, Task} from "../src/scheduler"

beforeEach(() => {
    scheduler.reset();
});

describe("mutex", () => {
    it("mutex maintains a list of waiters", async () => {
        let mutex = new Actor(async function () {
            let locked = false
            let waiters: Task[] = []
            while (true) {
                await scheduler.asyncServe(this, {
                    lock: (task: Task) => {
                        if (locked) {
                            waiters.push(task)
                            return
                        }
                        locked = true
                        task.resolve(null)
                    },
                    unlock: () => {
                        if (waiters.length == 0) {
                            locked = false
                            return
                        }
                        let task = waiters.pop()
                        task.resolve(null)
                    }
                })
            }
        })
        let transaction1 = new Actor(async function () {
            let _mutex = scheduler.stub(this, mutex.id)
            await _mutex.lock()
            try {
                console.log('transaction 1 enter')
                await scheduler.sleep(this, 100)
                console.log('transaction 1 exit')
            } finally {
                await _mutex.unlock()
            }
        })
        let transaction2 = new Actor(async function () {
            let _mutex = scheduler.stub(this, mutex.id)
            await _mutex.lock()
            try {
                console.log('transaction 2 enter')
                await scheduler.sleep(this, 200)
                console.log('transaction 2 exit')
            } finally {
                await _mutex.unlock()
            }
        })
        let transaction3 = new Actor(async function () {
            let _mutex = scheduler.stub(this, mutex.id)
            await _mutex.lock()
            try {
                console.log('transaction 3 enter')
                await scheduler.sleep(this, 300)
                console.log('transaction 3 exit')
            } finally {
                await _mutex.unlock()
            }
        })
        await transaction3.result
    });
})