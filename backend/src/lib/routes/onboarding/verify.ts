import type {
    FastifyInstance,
    FastifyPluginOptions,
    FastifyReply,
    FastifyRequest,
    HookHandlerDoneFunction,
} from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

type BodyReq = {
    hashedEmail: string
}
type VerifyRes = {
    ok: boolean
    msg?: string
    error?: string
    sessionToken?: string
}

export default (
    fastify: FastifyInstance,
    options: FastifyPluginOptions,
    done: HookHandlerDoneFunction,
) => {
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/verify',
        schema: {
            body: z.object({
                hashedEmail: z.string(),
            }),
            response: {
                200: z.object({
                    ok: z.boolean(),
                    msg: z.string(),
                    sessionToken: z.string(),
                }),
                500: z.object({
                    ok: z.boolean(),
                    error: z.string(),
                }),
            },
        },
        handler: async (
            request: FastifyRequest<{ Body: BodyReq }>,
            reply: FastifyReply,
        ): Promise<VerifyRes> => {
            const { hashedEmail } = request.body
            const { redis, knex, jwt } = fastify
            try {
                const redisCacheExpired =
                    (await redis.ttl(`${hashedEmail}-email`)) < 0 ||
                    (await redis.ttl(`${hashedEmail}-password`)) < 0
                const emailFromRedis = await redis.get(`${hashedEmail}-email`)
                const hashedPasswordFromRedis = await redis.get(
                    `${hashedEmail}-password`,
                )
                const userAlreadyInDb = await knex('users')
                    .where('email', emailFromRedis)
                    .first()
                if (redisCacheExpired)
                    throw new Error(
                        'Sorry, but you took too long to answer your email, please sign up again.',
                    )
                if (!emailFromRedis || !hashedPasswordFromRedis)
                    throw new Error(
                        'No data found by that email address, please sign up again.',
                    )
                if (userAlreadyInDb && !userAlreadyInDb.is_deleted)
                    throw new Error(
                        'You have already signed up, please log in.',
                    )
                if (userAlreadyInDb?.is_deleted) {
                    await knex('users').where('email', hashedEmail).update({
                        password: hashedPasswordFromRedis,
                        is_deleted: false,
                    })
                } else {
                    await knex
                        .insert({
                            email: hashedEmail,
                            password: hashedPasswordFromRedis,
                            is_deleted: false,
                        })
                        .into('users')
                }
                const email = (await redis.get(
                    `${hashedEmail}-email`,
                )) as string
                await redis.set(`${hashedEmail}-email`, email, 'EX', 180)
                await redis.del(`${hashedEmail}-password`)
            } catch (err) {
                if (err instanceof Error) {
                    fastify.log.error('ERROR :=>', err.message)
                    return reply.code(500).send({
                        ok: false,
                        error: err.message,
                    })
                }
            }
            const sessionToken = jwt.sign(
                { email: hashedEmail },
                { expiresIn: process.env.JWT_SESSION_EXP as string },
            )
            const refreshToken = jwt.sign(
                { email: hashedEmail },
                { expiresIn: process.env.JWT_REFRESH_EXP as string },
            )
            // TODO: reset expiration to a .env variable
            await redis.set(
                `${hashedEmail}-refresh-token`,
                refreshToken as string,
                'EX',
                180,
            )
            return reply
                .code(200)
                .clearCookie('appname-hash', { path: '/verify' })
                .setCookie('appname-refresh-token', refreshToken, {
                    secure: true,
                    httpOnly: true,
                    sameSite: true,
                })
                .send({
                    ok: true,
                    msg: 'Your email has been verified, redirecting you to the app...',
                    sessionToken: sessionToken,
                })
        },
    })
    done()
}
