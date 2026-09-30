import { useReducedMotion } from "framer-motion";

export const easings = {
  // Surveyor field ledger signature easing: crisp deceleration, zero overshoot
  ledger: [0.16, 1, 0.3, 1] as const,
  // Step transition easing for stage advancements
  step: [0.2, 0, 0, 1] as const,
};

export const durations = {
  fast: 0.18,
  normal: 0.28,
  slow: 0.42,
};

export const motionVariants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: durations.fast,
        ease: easings.ledger,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: durations.fast,
        ease: easings.step,
      },
    },
  },
  slideUp: {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: durations.normal,
        ease: easings.ledger,
      },
    },
    exit: {
      opacity: 0,
      y: 8,
      transition: {
        duration: durations.fast,
        ease: easings.step,
      },
    },
  },
  sheet: {
    hidden: { y: "100%", opacity: 0.9 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: durations.normal,
        ease: easings.ledger,
      },
    },
    exit: {
      y: "100%",
      opacity: 0.9,
      transition: {
        duration: durations.fast,
        ease: easings.step,
      },
    },
  },
  stagger: (staggerDelay = 0.05) => ({
    visible: {
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  }),
};

export function useCairnReducedMotion(): boolean {
  const shouldReduce = useReducedMotion();
  return Boolean(shouldReduce);
}
