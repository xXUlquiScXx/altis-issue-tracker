import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { SESSION_MAX_AGE_SECONDS } from './session'

const COOKIE_NAME = 'session'

export function setSessionCookie(token: string) {
  setCookie(COOKIE_NAME, token, {
    httpOnly: true, // JavaScript del navegador no puede leerla
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export function clearSessionCookie() {
  deleteCookie(COOKIE_NAME, { path: '/' })
}

export function readSessionCookie() {
  return getCookie(COOKIE_NAME)
}
