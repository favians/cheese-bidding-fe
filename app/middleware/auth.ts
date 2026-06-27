export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  await auth.bootstrap()

  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/', query: { redirect: to.fullPath } })
  }
})
