import {
    listenTCP
} from "../mod.ts";

const serv = listenTCP({
    port: 3000
}, {
    algorithm: {
        name: "RSA-OAEP",
        hash: "SHA-256",
        modulusLength: 4096,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01])
    },
    keyFormat: "jwk"
});

console.log(`Server Ready!`);
addEventListener("error", console.log);

for await (const client of serv) {
    console.log(`A new client connected`);

    (async () => {
        for await (const msg of client) {
            if (msg.type === "Ping") continue;

            console.log("S", msg);
        }
    })()
        .catch(console.log);
}