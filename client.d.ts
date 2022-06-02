import {
    MsgConstructors as _Constructors
} from "./msg.ts";

export interface RawConn {
    read(buf: Uint8Array): Promise<number | null>;
    write(buf: Uint8Array): Promise<number>;  
}

export interface BaseClientConnOpts {
    MsgConstructors?: typeof _Constructors,
    bufSize?: number,
    sep?: string
}