const api = (path) =>
  fetch(path, { credentials: 'include' })
    .then(async (r) => {
      // Check for rate limit (429)
      if (r.status === 429) {
        // Trigger rate limit notification
        window.dispatchEvent(new CustomEvent('spotify-rate-limit', {
          detail: { message: 'Spotify rate limit reached. Please try again later.' }
        }))
        throw new Error('Rate limit exceeded')
      }
      
      try {
        return await r.json()
      } catch (e) {
        return {}
      }
    })
    .catch((e) => ({ error: e.message }))

export default api
