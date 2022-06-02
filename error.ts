function createError(code: 400, data: { type: string }): Error 
function createError(code: 401, data: { error: string }): Error 
function createError(code: 402, data: { error: string }): Error 
function createError(code: 403): Error
function createError(code: 405, data: { ver: string; }): Error
function createError(code: number, data: Record<string, any> = {}): Error {
    switch (code) {
        case 400: return new Error(`${data.type} is not a valid message type`);
        case 401: return new Error(`Failed to serialize message with error: ${data.error}`);
        case 402: return new Error(`Failed to deserialize message with error: ${data.error}`);
        case 403: return new Error(`Connection is closed`);

        case 405: return new Error(`Invalid client version, server's version is: ${data.ver}`);
    }

    return new Error(`Unknown error`);
};

export {
    createError
};