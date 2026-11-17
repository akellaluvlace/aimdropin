'use client';

import { useRouter } from 'next/navigation';
import { previousPageIsHere } from '@/lib/fullscreen';
import DatumPractice from './DatumPractice';

/**
 * Datum on its own page: it fills the window, and Close goes back to where the visitor came from (the GSAP
 * gallery, when the page was opened from a link). That is all this host does with it: the page's own call
 * to action, "Start a project", is given no handler here, so it leads nowhere.
 */
export default function DatumRoute() {
  const router = useRouter();
  const close = () => { if (previousPageIsHere()) router.back(); else router.push('/gallery/gsap'); };
  return <main id="main-content" style={{ position: 'fixed', inset: 0 }}><DatumPractice onExit={close} /></main>;
}
