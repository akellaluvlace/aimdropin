'use client';

import { useRouter } from 'next/navigation';
import { previousPageIsHere } from '@/lib/fullscreen';
import MeridianSite from './MeridianSite';

/**
 * Meridian on its own page: it fills the window, and Close goes back to where the visitor came from (the
 * GSAP gallery, when the page was opened from a link). Its own call to action, "Book a demo", is given no
 * handler here, so it leads nowhere.
 */
export default function MeridianRoute() {
  const router = useRouter();
  const close = () => { if (previousPageIsHere()) router.back(); else router.push('/gallery/gsap'); };
  return <main id="main-content" style={{ position: 'fixed', inset: 0 }}><MeridianSite onExit={close} /></main>;
}
