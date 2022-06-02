import type {
    RawConn
} from "./client.d.ts"
import {
    MsgConstructors as _Constructors
} from "./msg.ts"
import type {
    Algorithm,
    KeyFormat
} from "./encryption.d.ts"

export interface RawListener {
    accept(): Promise<RawConn>
}
export interface BaseServerListenerOpts {
    MsgConstructors?: typeof _Constructors,
    algorithm: Algorithm,
    keyFormat: KeyFormat
}