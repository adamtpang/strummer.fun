// Shared framer-motion variants used across pages. Keeps animation timing
// consistent so the whole product feels like one motion language.
import type { Variants, Transition } from 'framer-motion';

export const easeOutQuart: Transition['ease'] = [0.165, 0.84, 0.44, 1];

/** Container that staggers its children's `initial → animate` transitions.
 *  Children must have variants defined for `initial` and `animate` keys. */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

/** Child variant used inside a staggerContainer */
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOutQuart },
  },
};

/** A bigger, hero-ish entry (used for the vibe label) */
export const heroIn: Variants = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: easeOutQuart },
  },
};

/** Spring used for hover/tap on tappable cards */
export const cardSpring: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 22,
};
