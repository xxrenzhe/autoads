export default async function request({ url, method = 'get', params, data, headers = {} }) {
  const m = method.toUpperCase()
  let qs = ''
  if (params && typeof params === 'object') {
    const sp = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') sp.append(k, String(v)) })
    const s = sp.toString()
    if (s) qs = `?${s}`
  }
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('admin_token') : ''
  const auth = token ? { Authorization: `Bearer ${token}` } : {}
  const opts = { method: m, headers: { 'Content-Type': 'application/json', ...auth, ...headers } }
  if (!['GET','HEAD'].includes(m)) opts.body = data !== undefined ? JSON.stringify(data) : undefined
  const res = await fetch(`${url}${qs}`, opts)
  try {
    const json = await res.json()
    return json
  } catch (e) {
    return { code: res.ok ? 0 : res.status, message: res.statusText, data: null }
  }
}

