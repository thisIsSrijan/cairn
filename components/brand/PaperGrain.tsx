export function PaperGrain() {
  return (
    <div
      aria-hidden="true"
      className="paper-grain pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <filter id="cairn-paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter="url(#cairn-paper-grain)"
          fill="#808080"
        />
      </svg>
    </div>
  );
}
