import test from 'ava'
import { stub } from 'sinon'
import Fastify from 'fastify'
import type {
    FastifyInstance,
    FastifyPluginOptions,
    FastifyReply,
    FastifyRequest,
    HookHandlerDoneFunction,
} from 'fastify'
import registerPlugins from '../../test-utils/auth-utils'
import sendEmail from '../../lib/utils/send-email'
import hasher from '../../lib/utils/hasher'
import { validateInputs } from '../../lib/utils/schema-validators'

// NOTE: Uncomment the following line if you want to use the test email
const actuallySendEmail = false

type BodyReq = {
    email: string
    password: string
}

type SignUpRes = {
    ok: boolean
    message?: string
    error?: string
}

const mock = {
    ok: true,
    message: `Your Email Was Successfully Sent to ${process.env.TEST_EMAIL}!`,
}

const fastify: FastifyInstance = Fastify()

// TODO: We'll need to implement sinon in order to stub the DB and redis calls...
const registerRoute = async (fastify: FastifyInstance) => {
    const newRoute = async (
        fastify: FastifyInstance,
        options: FastifyPluginOptions,
        done: HookHandlerDoneFunction,
    ) => {
        fastify.route({
            method: 'POST',
            url: '/signup',
            handler: async (
                request: FastifyRequest,
                reply: FastifyReply,
            ): Promise<SignUpRes> => {
                const body: BodyReq = {
                    email: process.env.TEST_EMAIL as string,
                    password: process.env.TEST_PASSWORD as string,
                }
                const { email, password } = body
                const { userService } = fastify
                const hashedEmail = hasher(email)
                const hashedPassword = await userService.hashPassword(password)
                try {
                    validateInputs(email, password)
                    stub(userService, 'grabUserByEmail').resolves(null)
                    stub(userService, 'isUserInCacheExpired').resolves(true)
                    stub(
                        userService,
                        'setUserEmailAndPasswordInCache',
                    ).resolves()
                    const userAlreadyInDb =
                        await userService.grabUserByEmail(hashedEmail)
                    const userAlreadyInCache =
                        await userService.isUserInCacheExpired(hashedEmail)
                    let emailSent
                    if (actuallySendEmail) {
                        emailSent = await sendEmail(
                            email as string,
                            `verify/${hashedEmail}` as string,
                            process.env
                                .BREVO_SIGNUP_TEMPLATE_ID as unknown as number,
                        )
                    } else emailSent = { wasSuccessfull: true }
                    if (userAlreadyInDb && !userAlreadyInDb.is_deleted)
                        throw new Error(
                            'You have already signed up, please log in.',
                        )
                    if (!userAlreadyInCache)
                        throw new Error(
                            'You have already submitted your email, please check your inbox.',
                        )
                    if (!emailSent?.wasSuccessfull) {
                        fastify.log.error(
                            'Error occurred while sending email, are your Brevo credentials up to date? :=>',
                        )
                        throw new Error(
                            'An error occurred while sending email, please contact support.',
                        )
                    }
                    await userService.setUserEmailAndPasswordInCache(
                        hashedEmail,
                        email,
                        hashedPassword,
                    )
                    reply
                        .code(200)
                        .setCookie('appname-hash', hashedEmail, {
                            path: '/verify',
                            maxAge: 60 * 60,
                        })
                        .send({
                            ok: true,
                            message: `Your Email Was Successfully Sent to ${email}!`,
                        })
                } catch (err) {
                    if (err instanceof Error) {
                        fastify.log.error('ERROR :=>', err.message)
                        reply.code(500).send({
                            ok: false,
                            message: err.message,
                        })
                    }
                }
                return reply
            },
        })
        done()
    }
    fastify.register(newRoute)
}

test('signs up user for first time and sends transac email', async t => {
    t.plan(3)
    await registerPlugins(fastify)
    await registerRoute(fastify)
    await fastify.listen()
    await fastify.ready()

    const response = await fastify.inject({
        method: 'POST',
        url: '/signup',
    })

    if (!actuallySendEmail) t.log('Actual email functionality not tested')

    t.is(response.statusCode, 200)
    t.is(response.headers['content-type'], 'application/json; charset=utf-8')
    t.is(response.payload, JSON.stringify(mock))
    await fastify.close()
})
