import {
    Client,
    BaseClientConn,
    TCPClientConn
} from "./client.ts";
import {
    MuxAsyncIterator
} from "./deps.ts";
import type {
    RawListener,
    BaseServerListenerOpts
} from "./server.d.ts";
import {
    MsgConstructors as _Constructors
} from "./msg.ts";
import {
    VerificationPhase
} from "./encryption.ts";
import type {
    Algorithm,
    KeyFormat
} from "./encryption.d.ts";
import config from "./config.json" assert { type: "json" }
import {
    createError
} from "./error.ts";

const {
    ver
} = config;

export abstract class BaseServerListener<ClientConn extends BaseClientConn = BaseClientConn> {
    declare MsgConstructors: typeof _Constructors;
    declare algorithm: Algorithm;
    declare keyFormat: KeyFormat;
    
    constructor(public listener: RawListener, opts: BaseServerListenerOpts) {
        Object.assign(this, {
            MsgConstructors: _Constructors
        }, opts);
    }
    abstract [Symbol.asyncIterator](): AsyncIterator<Client>;
    abstract accept(): Promise<Client<ClientConn>>;
    async processConn(conn: ClientConn): Promise<Client<ClientConn> | void> {
        const { algorithm, keyFormat } = this;
        const opts: any = {
            keys: {
                home: await crypto.subtle.generateKey(algorithm, true, ["encrypt", "decrypt"])
            }
        };
        const exportedPublicKey = await crypto.subtle.exportKey(keyFormat, opts.keys.home.publicKey);
        let phase: VerificationPhase = VerificationPhase.ClientData;

        for await (const msg of conn) {
            if (msg.type === "Error") throw msg;

            switch (phase) {
                case VerificationPhase.ClientData: {
                    if (msg.content.ver !== ver) {
                        const err = createError(405, { ver });

                        await conn.error(err.message, msg.id);
                        return;
                    }

                    phase = VerificationPhase.Feedback;
                    opts.keys.receiver = {
                        publicKey: await crypto.subtle.importKey(msg.content.keyFormat, msg.content.publicKey, msg.content.algorithm, true, ["encrypt"])
                    };

                    await conn.reply({
                        publicKey: exportedPublicKey,
                        keyFormat,
                        algorithm: {
                            name: algorithm.name,
                            hash: algorithm.hash
                        }
                    }, msg.id);

                    break;
                }
                case VerificationPhase.Feedback: {
                    conn.setKeys(opts.keys);
                    await conn.ping(msg.id);
                    return new Client<ClientConn>(conn, opts);
                }
            }
        }

        throw createError(403);
    }
};

export class TCPServerListener extends BaseServerListener<TCPClientConn> {
    constructor(public listener: Deno.Listener, opts: BaseServerListenerOpts) {
        super(listener, opts);
    }
    async accept(): Promise<Client<TCPClientConn>> {
        const conn = new TCPClientConn(await this.listener.accept(), this.MsgConstructors);
        const client = await this.processConn(conn);

        if (!client) return this.accept();

        return client;
    }
    async *[Symbol.asyncIterator]() {
        while (true) {
            yield await this.accept();
        }
    }
};

export class TCPServer extends MuxAsyncIterator<Client<TCPClientConn>> {
    constructor(public listener: TCPServerListener) {
        super();
        this.add(this.listener);
    }
};

export function listenTCP(loc: Omit<Deno.ListenOptions, "transport">, opts: BaseServerListenerOpts) {
    return new TCPServer(new TCPServerListener(Deno.listen(loc), opts));
};