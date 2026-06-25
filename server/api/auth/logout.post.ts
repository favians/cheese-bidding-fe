export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  deleteCookie(event, config.authCookieName, { path: '/' })

  return {
    data: { status: true },
    pagination: null,
    error: { status: false, msg: '', code: 0 }
  }
})
