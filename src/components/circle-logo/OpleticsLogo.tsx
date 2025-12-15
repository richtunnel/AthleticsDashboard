export const CircularProjectIcon = ({ size = 20, color = "currentColor" }) => (
  <div style={{ display: "flex", alignItems: "center" }}>
    <svg width={size + 8} height={size + 8} viewBox="0 0 32 32" fill="none">
      {/* Outer border circle */}
      <circle cx="16" cy="16" r="15" stroke={color} strokeWidth="2" fill="none" />

      {/* Inner icon group - scaled and centered */}
      <g transform="translate(4, 4)">
        {/* Outer circle */}
        <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="3" fill="none" />
        {/* Vertical line - offset to left */}
        <line x1="9.5" y1="1.5" x2="9.5" y2="22.5" stroke={color} strokeWidth="3" />
        {/* Horizontal line */}
        <line x1="1.5" y1="12" x2="22.5" y2="12" stroke={color} strokeWidth="3" />
      </g>
    </svg>
  </div>
);
