/** Registers node-loader.mjs hooks. Used via `node --import ./scripts/register-loader.mjs …`. */
import { register } from 'node:module';

register('./node-loader.mjs', import.meta.url);
