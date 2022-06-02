import {
    serialize,
    deserialize,
    genID
} from "./utils.ts";
import type {
    SerializedData
} from "./utils.d.ts";
import {
    createError
} from "./error.ts";
import {
    MuxAsyncIterator
} from "./deps.ts";
import type {
    MsgConstructor
} from "./msg.d.ts";

export abstract class BaseMsg extends MuxAsyncIterator<BaseMsg> {
    abstract type: string;
    abstract content: any;
    id: string = genID();

    static deserialize(data: SerializedData, opts = {
        MsgConstructors
    }): BaseMsg {
        const deserialized = deserialize(data);
        const Constructor = opts.MsgConstructors[deserialized.type];
        
        if (Constructor) return new Constructor(deserialized);

        throw createError(400, { type: deserialized.type });
    }
    serialize() {
        const {
            id,
            content,
            type
        } = this;

        return serialize({
            id,
            content,
            type
        });
    }
};

export class CreateMsg extends BaseMsg {
    type: "Create" = "Create";
    declare content: any;

    constructor(opts: {
        content: any;
    }) {
        super();
        Object.assign(this, opts);
    }
};

export class ReplyMsg extends BaseMsg {
    type: "Reply" = "Reply";
    declare to: string;
    declare content: any;

    constructor(opts: {
        content: any;
        to: string;
    }) {
        super();
        Object.assign(this, opts);
    }
    serialize() {
        const {
            id,
            content,
            type,
            to
        } = this;

        return serialize({
            id,
            content,
            type,
            to
        });
    }
};

export class ErrorMsg extends BaseMsg {
    type: "Error" = "Error";
    declare to?: string;
    declare content: string;

    constructor(opts: {
        content: string;
        to?: string;
    }) {
        super();
        Object.assign(this, opts);
    }
    serialize() {
        const {
            id,
            content,
            type,
            to
        } = this;

        return serialize({
            id,
            content,
            type,
            to
        });
    }
};

export class PingMsg extends BaseMsg {
    type: "Ping" = "Ping";
    declare content: number;
    declare to?: string;

    constructor(opts: {
        content: number;
        to?: string;
    }) {
        super();
        Object.assign(this, opts);
    }
    serialize() {
        const {
            id,
            content,
            type,
            to
        } = this;

        return serialize({
            id,
            content,
            type,
            to
        });
    }
};
export const MsgConstructors: Record<string, MsgConstructor> = {
    Create: CreateMsg,
    Ping: PingMsg,
    Reply: ReplyMsg,
    Error: ErrorMsg
};