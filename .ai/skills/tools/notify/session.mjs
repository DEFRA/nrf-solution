// Cookie-jar + CSRF HTTP session for driving the frontend's form routes (as a browser would).

export function fail(msg) { console.error(msg); process.exit(1) }

export async function createSession(baseUrl, startPath) {
  const cookies = new Map()
  const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: 'manual',
      ...options,
      headers: { cookie: [...cookies.values()].join('; '), ...options.headers }
    })
    for (const cookie of response.headers.getSetCookie()) {
      cookies.set(cookie.split('=')[0], cookie.split(';')[0])
    }
    return response
  }

  const start = await request(startPath)
  if (start.status !== 200) fail(`GET ${startPath} returned ${start.status}`)
  const csrfToken = (await start.text()).match(/name="csrfToken" value="([^"]+)"/)?.[1]
  if (!csrfToken) fail(`No csrfToken found on ${startPath}`)

  const postForm = async (path, fields) => {
    const response = await request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, ...fields })
    })
    if (response.status !== 303) fail(`POST ${path} returned ${response.status} ${response.headers.get('location') ?? ''}`)
    return response
  }

  const postJson = (path, json) =>
    request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(json)
    })

  return { request, postForm, postJson }
}
