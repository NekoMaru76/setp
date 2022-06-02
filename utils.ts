import type {
    DeserializedData,
    SerializedData
} from "./utils.d.ts";
import {
    createError
} from "./error.ts";
import {
    BSON
} from "./deps.ts";

const textEncoder = new TextEncoder;
const textDecoder = new TextDecoder;

export function serialize(data: DeserializedData): SerializedData {
    try {
        return new Uint8Array(BSON.serialize(data));
    } catch (e) {
        throw createError(401, {
            error: e.message || String(e)
        });
    }
};

export function deserialize(data: SerializedData): DeserializedData {
    try {
        return BSON.deserialize(data);
    } catch (e) {
        throw createError(402, {
            error: e.message || String(e)
        });
    }
};

export function genID() {
    return crypto.randomUUID();
};