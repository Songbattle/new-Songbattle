const STEPS = [
  { icon: '🔍', title: 'Pick an album', text: 'Search Spotify for any album.' },
  { icon: '⚔️', title: 'Battle it out', text: 'Choose your favorite in head-to-head duels.' },
  { icon: '🏆', title: 'Share your ranking', text: 'Get your personal track ranking as an image.' },
]

function Hero() {
  return (
    <section className="hero">
      <h2 className="hero-title">
        Which track is <span className="hero-accent">your</span> favorite?
      </h2>
      <p className="hero-subtitle">
        Rank every song of an album through battle-style voting and share the result.
      </p>
      <ol className="hero-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="hero-step">
            <span className="hero-step-icon" aria-hidden="true">{s.icon}</span>
            <strong>{i + 1}. {s.title}</strong>
            <span className="hero-step-text">{s.text}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default Hero
