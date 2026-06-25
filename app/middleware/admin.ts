export default defineNuxtRouteMiddleware(async () => {
  const adminAuth = useAdminAuthStore()
  await adminAuth.bootstrap()

  if (!adminAuth.isAuthenticated) {
    return navigateTo('/admin/login')
  }
})
