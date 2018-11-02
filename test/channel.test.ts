import scheduler, {Actor, Task} from "../src/scheduler"

beforeEach(() => {
    scheduler.reset();
});

describe("channel", () => {
    it("unbuffered channel", async () => {
        interface Producer {
            task: Task
            element: any
        }
        let channel = new Actor(async function () {
            let producers: Producer[] = []
            let consumers: Task[] = []
            while (true) {
                await scheduler.asyncServe(this, {
                    pop: (consumer: Task) => {
                        if (producers.length > 0) {
                            let producer = producers.pop()
                            consumer.resolve(producer.element)
                            producer.task.resolve(null)
                            return
                        }
                        consumers.push(consumer)
                    },
                    push: (producer: Task, element: any) => {
                        if (consumers.length > 0) {
                            let consumer = consumers.pop()
                            consumer.resolve(element)
                            producer.resolve(null)
                            return
                        }
                        producers.push({task: producer, element: element})
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
    it("bounded buffered channel", async () => {
        interface Producer {
            task: Task
            element: any
        }
        let channelSize = 2 // queue length limited to 2
        let channel = new Actor(async function () {
            let queue: any[] = []
            let producers: Producer[] = []
            let consumers: Task[] = []
            while (true) {
                await scheduler.asyncServe(this, {
                    pop: (consumer: Task) => {
                        if (queue.length == 0) {
                            // wait for element to be produced
                            consumers.push(consumer)
                            return
                        }
                        if (producers.length > 0) {
                            // there is producer want to produce more
                            let producer = producers.pop()
                            consumer.resolve(producer.element)
                            producer.task.resolve(null)
                            return
                        }
                        // take produced element
                        let element = queue.pop()
                        consumer.resolve(element)
                    },
                    push: (producer: Task, element: any) => {
                        if (queue.length == channelSize) {
                            // queue is full, can not produce now
                            producers.push({task: producer, element: element})
                            return
                        }
                        if (consumers.length > 0) {
                            // there is consumer waiting for data
                            let consumer = consumers.pop()
                            consumer.resolve(element)
                            producer.resolve(null)
                            return
                        }
                        // put the produced data into queue
                        queue.push(element)
                        producer.resolve(null)
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
                // consumer is slower than producer (200 > 100)
                // the channel will overflow
                await scheduler.sleep(this, 200)
                let element = await _channel.pop()
                console.log(`${new Date().getMilliseconds()} ${element}`)
            }
        })
        await someConsumer.result
    })
})