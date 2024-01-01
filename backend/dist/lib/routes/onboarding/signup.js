"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const password_1 = require("../../schemas/password");
const send_email_1 = __importDefault(require("../../utils/send-email"));
const hasher_1 = __importDefault(require("../../utils/hasher"));
exports.default = (fastify, options, done) => {
    fastify.withTypeProvider().route({
        method: 'POST',
        url: '/signup',
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 300000, // 5 minutes
            },
        },
        schema: {
            body: zod_1.z.object({
                email: zod_1.z.string(),
                password: zod_1.z.string(),
            }),
            response: {
                200: zod_1.z.object({
                    ok: zod_1.z.boolean(),
                    message: zod_1.z.string(),
                }),
                500: zod_1.z.object({
                    ok: zod_1.z.boolean(),
                    message: zod_1.z.string(),
                }),
            },
        },
        handler: async (request, reply) => {
            const { email, password } = request.body;
            const { redis, knex, bcrypt, userService } = fastify;
            // NOTE: Just a simple test for our eventual refactor
            userService.test();
            const hashedEmail = (0, hasher_1.default)(email);
            const hashedPassword = await bcrypt.hash(password);
            // TODO: replicate zod checks on front end
            const emailSchema = zod_1.z.string().email();
            const passwordSchema = zod_1.z.string().regex(password_1.passwordSchemaRegex, {
                message: password_1.passwordSchemaErrMsg,
            });
            try {
                const zParsedEmail = emailSchema.safeParse(email);
                const zParsedPassword = passwordSchema.safeParse(password);
                const userAlreadyInDb = await knex('users')
                    .where('email', hashedEmail)
                    .first();
                const userAlreadyInCache = (await redis.get(`${hashedEmail}-email`)) ||
                    (await redis.get(`${hashedEmail}-password`));
                const emailSent = await (0, send_email_1.default)(email, `verify/${hashedEmail}`, process.env.BREVO_SIGNUP_TEMPLATE_ID);
                if (!zParsedEmail.success) {
                    const { error } = zParsedEmail;
                    throw new Error(error.issues[0].message);
                }
                if (!zParsedPassword.success) {
                    const { error } = zParsedPassword;
                    throw new Error(error.issues[0].message);
                }
                if (userAlreadyInDb && !userAlreadyInDb.is_deleted)
                    throw new Error('You have already signed up, please log in.');
                if (userAlreadyInCache)
                    throw new Error('You have already submitted your email, please check your inbox.');
                if (!emailSent.wasSuccessfull) {
                    fastify.log.error('Error occurred while sending email, are your Brevo credentials up to date? :=>', emailSent.error);
                    throw new Error('An error occurred while sending email, please contact support.');
                }
                if (userAlreadyInDb === null || userAlreadyInDb === void 0 ? void 0 : userAlreadyInDb.is_deleted) {
                    await knex('users').where('email', hashedEmail).update({
                        password: hashedPassword,
                        is_deleted: false,
                    });
                }
                // TODO: reset expiration to a .env variable
                await redis.set(`${hashedEmail}-email`, email, 'EX', 60);
                await redis.set(`${hashedEmail}-password`, hashedPassword, 'EX', 60);
                reply
                    .code(200)
                    .setCookie('appname-hash', hashedEmail, {
                    path: '/verify',
                    maxAge: 60 * 60,
                })
                    .send({
                    ok: true,
                    message: `Your Email Was Successfully Sent to ${email}!`,
                });
            }
            catch (err) {
                if (err instanceof Error) {
                    fastify.log.error('ERROR :=>', err.message);
                    reply.code(500).send({
                        ok: false,
                        message: err.message,
                    });
                }
            }
            return reply;
        },
    });
    done();
};
