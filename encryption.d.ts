export type Algorithm = RsaHashedKeyGenParams
export type KeyFormat = "jwk"
export interface EncryptOpts { 
    publicKey: CryptoKey, 
    algorithm: Algorithm 
}