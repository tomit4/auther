"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fp = __importStar(require("fastify-plugin"));
const authPlugin = async (fastify, options, next) => {
    try {
        if (!fastify.authenticate) {
            fastify.decorate('authenticate', async (request, reply) => {
                try {
                    await request.jwtVerify();
                }
                catch (err) {
                    if (err instanceof Error)
                        return reply
                            .code(401)
                            .send({ ok: false, message: err.message });
                }
            });
        }
        next();
    }
    catch (err) {
        if (err instanceof Error)
            next(err);
    }
};
const fastifyAuth = fp.default(authPlugin, {
    name: 'fastify-jwt-authenticate',
});
exports.default = fastifyAuth;
