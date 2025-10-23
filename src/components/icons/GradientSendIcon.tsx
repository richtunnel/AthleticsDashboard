export function GradientSendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ display: "flex" }}>
      <defs>
        <linearGradient id="sendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#70efafc8" />
          <stop offset="50%" stopColor="#8af4f6ff" />
          <stop offset="100%" stopColor="#00BCD4" />
        </linearGradient>
      </defs>
      <path fill="url(#sendGradient)" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

export function GradientAI() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ display: "flex" }}>
      <defs>
        <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#70efafc8" />
          <stop offset="50%" stopColor="#8af4f6ff" />
          <stop offset="100%" stopColor="#00BCD4" />
        </linearGradient>
      </defs>
      <path fill="url(#aiGradient)" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}
