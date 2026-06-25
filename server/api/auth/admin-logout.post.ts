// Admin logout: clear the admin httpOnly cookie.
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  deleteCookie(event, config.adminAuthCookieName, { path: '/' })
  return { data: { status: true }, pagination: null, error: { status: false, msg: '', code: 0 } }
})
