import { createRouter } from '@tanstack/react-router'
import { NotFound } from './components/not-found'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Una sola página 404, en español, para cualquier dirección que no exista.
    defaultNotFoundComponent: NotFound,
  })
}
