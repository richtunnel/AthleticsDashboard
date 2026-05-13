export const CircularProjectIcon = ({ size = 20, color = "currentColor", useGradient = false, outerStrokeWidth = 2.15 }) => {
  const gradientId = "opletics-footer-gradient";

  // Use the gradient for the big outer circle
  const outerStroke = useGradient ? `url(#${gradientId})` : color;
  // Use the LIME color (#a8eb12) for the inner group so it never disappears
  const innerStroke = useGradient ? "#008ea3" : color;

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <svg width={size + 8} height={size + 8} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1b2044" />
            <stop offset="25%" stopColor="#00558a" />
            <stop offset="50%" stopColor="#008ea3" />
            <stop offset="75%" stopColor="#00c37a" />
            <stop offset="100%" stopColor="#a8eb12" />
          </linearGradient>
        </defs>

        {/* Outer Ring */}
        <circle cx="16" cy="16" r="15" stroke={outerStroke} strokeWidth={outerStrokeWidth} fill="none" />

        {/* Inner Group - Explicitly using the light color */}
        <g transform="translate(4, 4)">
          <circle cx="12" cy="12" r="10.5" stroke={innerStroke} strokeWidth="3" fill="none" />
          <line x1="9.5" y1="1.5" x2="9.5" y2="22.5" stroke={innerStroke} strokeWidth="3" />
          <line x1="1.5" y1="12" x2="22.5" y2="12" stroke={innerStroke} strokeWidth="3" />
        </g>
      </svg>
    </div>
  );
};
