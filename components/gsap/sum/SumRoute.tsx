'use client';

import { useRouter } from 'next/navigation';
import { previousPageIsHere } from '@/lib/fullscreen';
import SumStore from './SumStore';

/**
 * Sum on its own page: it fills the window, and Close goes back to where the visitor came from (the GSAP
 * gallery, when the page was opened from a link). Sum is told nothing else.
 */
export default function SumRoute() {
  const router = useRouter();
  const close = () => { if (previousPageIsHere()) router.back(); else router.push('/gallery/gsap'); };
  return <main id="main-content" style={{ position: 'fixed', inset: 0 }}><SumStore onExit={close} /></main>;
}
