import {v4 as uuid} from 'uuid'

interface Task {
    taskId: string
    resolve: Resolve
    reject: Reject
}

type Resolve = (obj: any) => void
type Reject = (obj: any) => void

interface Server extends Task {
    methods: { [key: string]: Function }
}

interface ServeResult {
    methodName: string
    methodArgs: any[]
    returnValue: any
}

interface Client extends Task {
    methodName: string
    methodArgs: any[]
}

let scheduler = new (class {

    servers: { [serverId: string]: Server }
    clients: { [serverId: string]: Client[] }

    constructor() {
        this.servers = {}
        this.clients = {}
    }

    serve(serverId: string, methods: { [key: string]: Function }): Promise<ServeResult> {
        let clients = this.clients[serverId]
        while (clients && clients.length > 0) {
            let client = clients.pop()
            let method = methods[client.methodName]
            if (!method) {
                client.reject('method unknown: ' + client.methodName)
                continue
            }
            let returnValue = method.apply(this, client.methodArgs)
            client.resolve(returnValue)
            return Promise.resolve({
                methodName: client.methodName,
                methodArgs: client.methodArgs,
                returnValue: returnValue
            })
        }
        return new Promise((resolve, reject) => {
            this.servers[serverId] = {
                taskId: serverId,
                resolve: resolve,
                reject: reject,
                methods: methods,
            }
        })
    }

    call(callerId: string, calleeId: string, methodName: string, ...methodArgs: any[]) {
        let server = this.servers[calleeId]
        if (!server) {
            return new Promise((resolve, reject) => {
                let clients = this.clients[calleeId] = this.clients[calleeId] || []
                clients.push({
                    taskId: callerId,
                    resolve: resolve,
                    reject: reject,
                    methodName: methodName,
                    methodArgs: methodArgs,
                })
            })
        }
        let method = server.methods[methodName]
        if (!method) {
            return Promise.reject('method unknown: ' + methodName)
        }
        let returnValue = method.apply(this, methodArgs)
        server.resolve({
            methodName: methodName,
            methodArgs: methodArgs,
            returnValue: returnValue
        })
        return Promise.resolve(returnValue)
    }

    sleep(actor: Actor, duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration))
    }

    reset() {
        this.servers = {}
        this.clients = {}
    }
})()

export default scheduler

export class Actor {

    id: string

    result: Promise<any>

    constructor(f: Function, ...args: any[]) {
        this.id = uuid()
        this.result = f.apply(this.id, args)
    }
}