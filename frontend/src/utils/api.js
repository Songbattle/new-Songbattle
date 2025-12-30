const api = (path) =>
  fetch(path, { credentials: 'include' })
    .then(async (r) => {
      try {
        return await r.json()
      } catch (e) {
        return {}
      }
    })
    .catch((e) => ({ error: e.message }))

export default api
