'use client';
import { useEffect } from 'react';

// Fades sections in as they enter the viewport. Does nothing for reduced motion.
export function Reveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  // Show the nav CTA only once the hero is out of view, so it does not repeat the hero buttons.
  useEffect(() => {
    const hero = document.getElementById('top');
    const root = document.querySelector('.lp');
    if (!hero || !root || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([en]) => root.classList.toggle('is-past-hero', !en.isIntersecting), { threshold: 0, rootMargin: '-80px 0px 0px 0px' });
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return null;
}
