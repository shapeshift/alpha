/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
import { webcrypto } from 'crypto'
import { TextDecoder, TextEncoder } from 'util'

global.TextEncoder = TextEncoder as any
global.TextDecoder = TextDecoder as any
global.crypto = webcrypto as any
