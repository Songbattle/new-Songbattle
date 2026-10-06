const api = (path) =>
  fetch(path, { credentials: 'include' })
    .then(async (r) => {
      // Check for rate limit (429)
      if (r.status === 429) {
        // Distinguish our own server-side limit from a Spotify rate limit
        let body = {}
        try {
          body = await r.json()
        } catch (e) {
          /* ignore */
        }
        const detail =
          body && body.source === 'server'
            ? {
                messageKey: 'rateLimit.server',
                params: { seconds: body.retryAfter || Number(r.headers.get('Retry-After')) || 60 },
              }
            : { messageKey: 'rateLimit.spotify' }
        window.dispatchEvent(new CustomEvent('spotify-rate-limit', { detail }))
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
