import scheduler, {Actor, Task} from "../src/scheduler"

beforeEach(() => {
    scheduler.reset();
});

describe("channel", () => {
    it("unbounded buffered channel", async () => {
        let channel = new Actor(async function () {
            let queue: any[] = []
            let consumers: Task[] = []
            while (true) {
                await scheduler.asyncServe(this, {
                    pop: (consumer: Task) => {
                        if (queue.length == 0) {
                            consumers.push(consumer)
                            return
                        }
                        let element = queue.pop()
                        consumer.resolve(element)
                    },
                    push: (producer: Task, element: any) => {
                        producer.resolve(null)
                        if (consumers.length == 0) {
                            queue.push(element)
                            return
                        }
                        let consumer = consumers.pop()
                        consumer.resolve(element)
                    }
                })
            }
        })
        let someProducer = new Actor(async function () {
            let _channel = scheduler.stub(this, channel.id)
            for (let i = 0; i < 5; i++) {
                await _channel.push(i)
                await scheduler.sleep(this, 100)
            }
        })
        let someConsumer = new Actor(async function () {
            let _channel = scheduler.stub(this, channel.id)
            for (let i = 0; i < 5; i++) {
                let element = await _channel.pop()
                console.log(`${new Date().getMilliseconds()} ${element}`)
            }
        })
        await someConsumer.result
    })
})