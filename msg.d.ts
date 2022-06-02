import type {
    BaseMsg
} from "./msg.ts";

export type MsgConstructor = new(...args: any[]) => BaseMsg