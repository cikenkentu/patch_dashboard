import { cuDataRoutes } from './cu/routes.js'

/**
 * Composition root seluruh feature API. Feature baru cukup mengekspor descriptor route seperti CU,
 * lalu ditambahkan ke daftar group di bawah; server umum tidak perlu mengetahui loader domain.
 */
function createDataRouteMap(routeGroups) {
  const routeMap = new Map()

  for (const routes of routeGroups) {
    for (const descriptor of routes) {
      const { path, ...route } = descriptor
      const hasValidDescriptor = (
        typeof path === 'string'
        && path.startsWith('/api/')
        && typeof route.loader === 'function'
        && typeof route.logLabel === 'string'
        && route.logLabel.length > 0
        && typeof route.publicMessage === 'string'
        && route.publicMessage.length > 0
      )

      if (!hasValidDescriptor) {
        throw new TypeError('Descriptor route feature tidak valid.')
      }
      if (routeMap.has(path)) {
        throw new TypeError(`Route feature duplikat: ${path}`)
      }

      routeMap.set(path, Object.freeze(route))
    }
  }

  return routeMap
}

export const dataRoutes = createDataRouteMap([
  cuDataRoutes,
])
