import {
    connectTCP
} from "../mod.ts";

const client = await connectTCP({
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

setTimeout(() => {
    client.conn.create("X".repeat(100).replaceAll("X", () => Math.floor(Math.random()*9).toString()))
        .catch(e => console.error("C", e));

});
console.log(`Client Ready!`);
addEventListener("error", console.log);

for await (const msg of client) {
    if (msg.type === "Ping") continue;
    
    console.log("C", msg);
}