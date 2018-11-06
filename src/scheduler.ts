import {v4 as uuid} from 'uuid'

export interface Task {
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

    private servers: { [serverId: string]: Server }
    private asyncServers: { [serverId: string]: Server }
    private clients: { [serverId: string]: Client[] }

    constructor() {
        this.reset()
    }

    reset() {
        this.servers = {}
        this.asyncServers = {}
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

    asyncServe(serverId: string, methods: { [key: string]: Function }): Promise<void> {
        let clients = this.clients[serverId]
        while (clients && clients.length > 0) {
            let client = clients.pop()
            let method = methods[client.methodName]
            if (!method) {
                client.reject('method unknown: ' + client.methodName)
                continue
            }
            method.call(this, client, ...client.methodArgs)
            return Promise.resolve(null)
        }
        return new Promise((resolve, reject) => {
            this.asyncServers[serverId] = {
                taskId: serverId,
                resolve: resolve,
                reject: reject,
                methods: methods,
            }
        })
    }

    call(callerId: string, calleeId: string, methodName: string, ...methodArgs: any[]): Promise<any> {
        let result = this.tryCallServer(calleeId, methodName, methodArgs)
        if (result) {
            return result
        }
        result = this.tryCallAsyncServer(calleeId, methodName, methodArgs)
        if (result) {
            return result
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

    private tryCallAsyncServer(calleeId: string, methodName: string, methodArgs: any[]): Promise<any> {
        let server = this.asyncServers[calleeId]
        if (!server) {
            return null
        }
        let method = server.methods[methodName]
        if (!method) {
            return Promise.reject('method unknown: ' + methodName)
        }
        delete this.asyncServers[calleeId]
        return new Promise<any>((resolve, reject) => {
            let task: Task = {
                taskId: calleeId,
                resolve: resolve,
                reject: reject
            }
            try {
                method.call(this, task, ...methodArgs)
            } catch (e) {
                reject(e)
            }
            server.resolve(null)
        })
    }

    private tryCallServer(calleeId: string, methodName: string, methodArgs: any[]): Promise<any> {
        let server = this.servers[calleeId]
        if (!server) {
            return null
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
            setTimeout(() => {
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

    readonly id: string

    readonly result: Promise<any>

    constructor(f: Function, ...args: any[]) {
        this.id = uuid()
        this.result = f.apply(this.id, args)
    }
}