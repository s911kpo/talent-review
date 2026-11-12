import logo from '../assets/molex-logo.png';

/**
 * The official Molex logo, supplied by Tim on 2026-11-12 (transparent version of that file, colour unchanged).
 * Use this everywhere the brand appears; never redraw or recolour it.
 */
export function MolexLogo({ className = 'h-6 w-auto' }: { className?: string }) {
  return <img src={logo} alt="Molex" className={className} draggable={false} />;
}
