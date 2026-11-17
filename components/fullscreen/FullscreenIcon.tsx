// Four corners pointing out (open full screen) or in (leave it).
export default function FullscreenIcon({ exit = false, className = "h-3.5 w-3.5" }: { exit?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true" className={className}>
      {exit ? (
        <path d="M5.5 1.5v4h-4M10.5 1.5v4h4M10.5 14.5v-4h4M5.5 14.5v-4h-4" />
      ) : (
        <path d="M1.5 5.5v-4h4M14.5 5.5v-4h-4M14.5 10.5v4h-4M1.5 10.5v4h4" />
      )}
    </svg>
  );
}
