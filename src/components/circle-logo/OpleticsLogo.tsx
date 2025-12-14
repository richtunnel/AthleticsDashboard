export const CircularProjectIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Outer circle */}
    <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="3" fill="none" />
    {/* Vertical line - offset to left */}
    <line x1="9.5" y1="1.5" x2="9.5" y2="22.5" stroke={color} strokeWidth="3" />
    {/* Horizontal line */}
    <line x1="1.5" y1="12" x2="22.5" y2="12" stroke={color} strokeWidth="3" />
  </svg>
);
