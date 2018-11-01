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
    waiters: { [taskId: string]: Task }

    constructor() {
        this.servers = {}
        this.clients = {}
        this.waiters = {}
    }

    reset() {
        this.servers = {}
        this.clients = {}
        this.waiters = {}
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
            try {
                let returnValue = method.apply(this, client.methodArgs)
                client.resolve(returnValue)
                return Promise.resolve({
                    methodName: client.methodName,
                    methodArgs: client.methodArgs,
                    returnValue: returnValue
                })
            } catch (e) {
                client.reject(e)
                return Promise.reject(e)
            }
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

    call(callerId: string, calleeId: string, methodName: string, ...methodArgs: any[]): Promise<any> {
        let server = this.servers[calleeId]
        if (!server) {
            if (Object.keys(this.waiters).length == 0) {
                return Promise.reject('every actor is blocked')
            }
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
        delete this.servers[calleeId]
        let returnValue = method.apply(this, methodArgs)
        server.resolve({
            methodName: methodName,
            methodArgs: methodArgs,
            returnValue: returnValue
        })
        return Promise.resolve(returnValue)
    }

    sleep(taskId: string, duration: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.waiters[taskId] = {
                taskId: taskId,
                resolve: resolve,
                reject: reject
            }
            setTimeout(() => {
                delete this.waiters[taskId]
                resolve()
            }, duration)
        })
    }

    stub(callerId: string, calleeId: string): any {
        let scheduler = this;
        return new Proxy({}, {
            get: function (target, methodName: string) {
                return function (...methodArgs: any[]) {
                    return scheduler.call(callerId, calleeId, methodName, ...methodArgs)
                }
            }
        })
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