import { createRouter, createWebHistory } from 'vue-router'
const authRoute = import.meta.env.VITE_AUTH_ROUTE
const refreshRoute = import.meta.env.VITE_REFRESH_ROUTE
const logoutRoute = import.meta.env.VITE_LOGOUT_ROUTE
const invalidTokenCode = import.meta.env.VITE_INVALID_TOKEN_CODE

import AppView from '../views/AppView.vue'
import LoginView from '../views/LoginView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import SignUpView from '../views/SignUpView.vue'
import SplashView from '../views/SplashView.vue'
import VerifiedView from '../views/VerifiedView.vue'
import VerifiedChangePasswordView from '../views/VerifiedChangePasswordView.vue'
import VerifiedForgotPasswordView from '../views/VerifiedForgotPasswordView.vue'
import VerifiedDeleteProfileView from '../views/VerifiedDeleteProfileView.vue'
import WaitingForActionView from '../views/WaitingForActionView.vue'

const routes = [
    {
        path: '/',
        component: SplashView,
        name: 'SplashView',
    },
    {
        path: '/signup',
        component: SignUpView,
        name: 'SignUpView',
    },
    {
        path: '/login',
        component: LoginView,
        name: 'LoginView',
    },
    {
        path: '/forgot-password',
        component: ForgotPasswordView,
        name: 'ForgotPasswordView',
    },
    {
        path: '/auth',
        component: WaitingForActionView,
        name: 'WaitingForActionView',
    },
    {
        path: '/verify/:hash',
        component: VerifiedView,
        name: 'VerifiedView',
    },
    {
        path: '/verify-change-pass/:hash',
        component: VerifiedChangePasswordView,
        name: 'VerifiedChangePasswordView',
        meta: { requiresAuth: true },
    },
    {
        path: '/verify-forgot-pass/:hash',
        component: VerifiedForgotPasswordView,
        name: 'VerifiedForgotPasswordView',
    },
    {
        path: '/verify-delete-profile/:hash',
        component: VerifiedDeleteProfileView,
        name: 'VerifiedDeleteProfileView',
        meta: { requiresAuth: true },
    },
    {
        path: '/app',
        component: AppView,
        name: 'AppView',
        meta: { requiresAuth: true },
    },
    {
        path: '/:catchAll(.*)*',
        component: NotFoundView,
        name: 'NotFoundView',
        meta: { is404: true },
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

// TODO: Heavy refactor into smaller helper functions
router.beforeEach(async (to, from): Promise<string | undefined> => {
    const sessionToken = localStorage.getItem('appname-session-token')
    if (to.meta.requiresAuth && sessionToken) {
        const res = await fetch(authRoute, {
            method: 'GET',
            headers: { Authorization: `Bearer ${sessionToken}` },
        })
        if (res.status === 401) {
            const refreshCheck = await fetch(refreshRoute, {
                method: 'GET',
                credentials: 'include',
                headers: { ContentType: 'application/json' },
            })
            if (refreshCheck.status === 200) {
                const jsonRes = await refreshCheck.json()
                localStorage.setItem(
                    'appname-session-token',
                    jsonRes.sessionToken,
                )
            } else {
                const jsonRefreshCheck = await refreshCheck.json()
                if (
                    jsonRefreshCheck.statusCode === 500 &&
                    jsonRefreshCheck.code !== invalidTokenCode
                ) {
                    console.error(
                        'ERROR while refreshing token :=>',
                        jsonRefreshCheck,
                    )
                }
                const logOutRes = await fetch(logoutRoute, {
                    method: 'GET',
                    credentials: 'include',
                })
                const jsonLogOutRes = await logOutRes.json()
                if (
                    jsonLogOutRes.statusCode !== 200 &&
                    jsonLogOutRes.code !== invalidTokenCode
                ) {
                    console.error('ERROR while logging out :=>', jsonLogOutRes)
                }
                localStorage.removeItem('appname-session-token')
                return '/login'
            }
        }
    } else if (!to.meta.is404 && !to.meta.requiresAuth && sessionToken) {
        return '/app'
    } else if (to.meta.requiresAuth && !sessionToken) {
        // NOTE: Repetitive, hence the need for refactor
        const logOutRes = await fetch(logoutRoute, {
            method: 'GET',
            credentials: 'include',
        })
        const jsonLogOutRes = await logOutRes.json()
        if (
            jsonLogOutRes.statusCode !== 200 &&
            jsonLogOutRes.code !== invalidTokenCode
        ) {
            console.error('ERROR while logging out :=>', jsonLogOutRes)
        }
        return '/login'
    } else if (
        !to.meta.requiresAuth &&
        to.path === '/auth' &&
        from.path !== '/signup'
    ) {
        return '/'
    }
})

export { router }
