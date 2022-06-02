import {
    CreateMsg,
    ReplyMsg,
    ErrorMsg,
    BaseMsg,
    PingMsg,
    MsgConstructors as _Constructors
} from "./msg.ts";
import {
    MuxAsyncIterator
} from "./deps.ts";
import type {
    RawConn,
    BaseClientConnOpts
} from "./client.d.ts";
import config from "./config.json" assert { type: "json" };
import type {
    Algorithm,
    KeyFormat
} from "./encryption.d.ts";
import {
    VerificationPhase
} from "./encryption.ts";
import {
    createError
} from "./error.ts";
import type {
    SerializedData
} from "./utils.d.ts";


async function *gen<T>(msgs: T[]) {
    yield* msgs;
}

const textEncoder = new TextEncoder;
const textDecoder = new TextDecoder;
const { 
    ver,
    DEFAULT_BUFFER_SIZE,
    DEFAULT_SEPARATOR
} = config;

export abstract class BaseClientConn {
    list: Map<string, BaseMsg> = new Map;
    declare MsgConstructors: typeof _Constructors;
    declare bufSize: number;
    declare sep: string;
    keys?: Client["keys"];

    constructor(public conn: RawConn, opts: BaseClientConnOpts) {
        Object.assign(this, {
            MsgConstructors: _Constructors,
            bufSize: DEFAULT_BUFFER_SIZE,
            sep: DEFAULT_SEPARATOR
        }, opts);
    }
    setKeys(keys: Client["keys"]): void {
        this.keys = keys;
    }
    async send(msg: BaseMsg): Promise<void>  {
        this.list.set(msg.id, msg);
        await this.write(msg);
    }
    async create(content: any) {
        return await this.send(
            new CreateMsg({
                content
            })
        );
    }
    async reply(content: any, to: string) {
        return await this.send(
            new ReplyMsg({
                content,
                to
            })
        ) ;
    }
    async error(content: string, to?: string) {
        return await this.send(
            new ErrorMsg({
                content,
                to
            })
        );
    }
    async ping(to?: string) {
        return await this.send(
            new PingMsg({
                content: Date.now(),
                to
            })
        );
    }
    abstract read(): AsyncGenerator<BaseMsg>;
    abstract write(msg: BaseMsg): Promise<void>;
    abstract [Symbol.asyncIterator](): AsyncIterator<BaseMsg>;
};

export class TCPClientConn extends BaseClientConn {
    str = '';

    constructor(public conn: Deno.Conn, opts: BaseClientConnOpts) {
        super(conn, opts);
    }
    async write(msg: BaseMsg) {
        const { keys } = this;
        const data = msg.serialize();
        const _data = keys ? new Uint8Array(await crypto.subtle.encrypt(keys.receiver.publicKey.algorithm, keys.receiver.publicKey, data)) : data;
        const buf = textEncoder.encode(String(_data) + this.sep);
        let i = 0;

        while (true) {
            if (i >= buf.byteLength) break;

            i = await this.conn.write(buf.subarray(i));
        }
    }
    async *push(data: SerializedData) {
        const {
            list,
            MsgConstructors,
            str,
            sep,
            keys
        } = this;
        const strs = (str + textDecoder.decode(data))
            .split(sep);

        this.str = strs.pop() as string;

        for (const buf of strs.map(str => new Uint8Array(str.split(",").map(bit => parseInt(bit))))) {
            try {
                const data = keys ? new Uint8Array(await crypto.subtle.decrypt(keys.home.publicKey.algorithm, keys.home.privateKey, buf)) : buf;
                const msg = BaseMsg.deserialize(data, {
                    MsgConstructors
                }) as any;

                if (list.has(msg.to)) (list.get(msg.to) as BaseMsg).add(gen<BaseMsg>([msg]));
                if (msg.type === "Ping") await this.ping(msg.id);
            
                yield msg;
            } catch (e) {
                await this.error(e.message);
            }
        }
    }
    async *read() {
        const {
            bufSize,
            conn
        } = this;
        const buf = new Uint8Array(bufSize);
        const n = await conn.read(buf);

        if (typeof n !== "number") throw createError(403);

        yield* this.push(buf.slice(0, n));
    }
    async *[Symbol.asyncIterator]() {
        while (true) {
            for await (const msg of this.read()) yield msg;
        }
    }
};

export class Client<Conn extends BaseClientConn = BaseClientConn> extends MuxAsyncIterator<BaseMsg> {
    keys: {
        receiver: {
            publicKey: CryptoKey,
            privateKey?: CryptoKey
        },
        home: {
            publicKey: CryptoKey,
            privateKey: CryptoKey
        }
    };
    ver = ver;
    
    constructor(public conn: Conn, opts: {
        keys: Client["keys"]
    }) {
        super();
        
        this.keys = opts.keys;

        this.add(conn);
    }
};

export async function connectTCP(loc: Deno.ConnectOptions, { 
    algorithm, 
    bufSize, 
    MsgConstructors,
    keyFormat,
    sep
}: { 
    algorithm: Algorithm,
    keyFormat: KeyFormat
} & BaseClientConnOpts): Promise<Client> {
    const _opts: any = {
        keys: {
            home: await crypto.subtle.generateKey(algorithm, true, ["encrypt", "decrypt"]) as CryptoKeyPair
        }
    };
    const conn = new TCPClientConn(await Deno.connect(loc), {
        MsgConstructors: MsgConstructors || _Constructors,
        bufSize: bufSize || DEFAULT_BUFFER_SIZE,
        sep: sep || DEFAULT_SEPARATOR
    });
    let phase: VerificationPhase = VerificationPhase.ClientData;

    await conn.create({
        ver,
        publicKey: await crypto.subtle.exportKey(keyFormat, _opts.keys.home.publicKey),
        algorithm: {
            name: algorithm.name,
            hash: algorithm.hash
        },
        keyFormat
    });

    for await (const msg of conn) {
        if (msg.type === "Error") throw msg;

        switch (phase) {
            case VerificationPhase.ClientData: {
                phase = VerificationPhase.Feedback;
                _opts.keys.receiver = {
                    publicKey: await crypto.subtle.importKey(msg.content.keyFormat, msg.content.publicKey, msg.content.algorithm, true, ["encrypt"])
                };

                await conn.reply(true, msg.id);
                conn.setKeys(_opts.keys);
                    
                break;
            }
            case VerificationPhase.Feedback:
                return new Client(conn, _opts);
        }
    }

    throw createError(403);
};