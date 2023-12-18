import { ALL } from 'dns'
import type {
    FastifyInstance,
    FastifyPluginOptions,
    FastifyReply,
    FastifyRequest,
    HookHandlerDoneFunction,
} from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
// import { z } from 'zod'
//
type BodyReq = {
    email: string
    loginPassword: string
}

/*
type SignUpRes = {
    ok: boolean
    msg?: string
    email?: string
    error?: string
}
*/
export default (
    fastify: FastifyInstance,
    options: FastifyPluginOptions,
    done: HookHandlerDoneFunction,
) => {
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        /*
        schema: {
            body: z.object({
                email: z.string(),
                password: z.string(),
            }),
            response: {
                200: z.object({
                    ok: z.boolean(),
                    msg: z.string().optional(),
                    email: z.string().optional(),
                    error: z.string().optional(),
                }),
                400: z.object({
                    ok: z.boolean(),
                    error: z.string(),
                }),
            },
        },
        */
        handler: async (
            request: FastifyRequest<{ Body: BodyReq }>,
            reply: FastifyReply,
            // ): Promise<SignUpRes> => {
        ) => {
            const { knex, bcrypt } = fastify
            const { email, loginPassword } = request.body
            try {
                const { password } = await knex('users')
                    .select('password')
                    .where('email', email)
                    .first()
                const passwordHashesmatch = await bcrypt
                    .compare(loginPassword, password)
                    .then(match => match)
                    .catch(err => console.error(err.message))
                console.log('passwordHashesmatch :=>', passwordHashesmatch)
            } catch (err) {
                console.error('ERROR :=>', err)
            }
        },
    })
    done()
}
