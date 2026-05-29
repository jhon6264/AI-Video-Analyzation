"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate } from "animejs";

type EmptyMode = "wordmark" | "robot";

const WORDMARK_LINES = [
  "    _    _                     ",
  "   / \\  | | __ ___      _____ ",
  "  / _ \\ | |/ _` \\ \\ /\\ / / __|",
  " / ___ \\| | (_| |\\ V  V /\\__ \\",
  "/_/   \\_\\_|\\__,_| \\_/\\_/ |___/",
  "",
  " _                         ",
  "| |    __ _  __ _  ___    ",
  "| |   / _` |/ _` |/ _ \\   ",
  "| |__| (_| | (_| |  __/   ",
  "|_____\\__,_|\\__, |\\___|   ",
  "            |___/         ",
];

const ROBOT_FACE = String.raw` .----------------.
 |                |
 |                |
 '----------------'`;

export default function CliEmptyState() {
  const [mode, setMode] = useState<EmptyMode>("wordmark");
  const modeRef = useRef<EmptyMode>("wordmark");
  const shellRef = useRef<HTMLDivElement>(null);
  const leftPupilRef = useRef<HTMLSpanElement>(null);
  const rightPupilRef = useRef<HTMLSpanElement>(null);

  const getRows = useCallback(
    () =>
      Array.from(
        shellRef.current?.querySelectorAll<HTMLElement>("[data-cli-row]") ?? [],
      ),
    [],
  );

  const setPupilOffset = useCallback((x: number, y: number) => {
    const transform = `translate(${x}px, ${y}px)`;

    if (leftPupilRef.current) {
      leftPupilRef.current.style.transform = transform;
    }

    if (rightPupilRef.current) {
      rightPupilRef.current.style.transform = transform;
    }
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    const interval = window.setInterval(() => {
      const rows = getRows();

      animate(rows, {
        opacity: [1, 0],
        scaleX: [1, 0.18],
        translateY: (_target: unknown, index: number) =>
          index % 2 === 0 ? -10 : 10,
        duration: 360,
        ease: "inCubic",
        onComplete: () => {
          const nextMode = modeRef.current === "wordmark" ? "robot" : "wordmark";

          modeRef.current = nextMode;
          setMode(nextMode);

          window.requestAnimationFrame(() => {
            animate(getRows(), {
              opacity: [0, 1],
              scaleX: [0.18, 1],
              translateY: [0, 0],
              delay: (_target: unknown, index: number) => index * 28,
              duration: 420,
              ease: "outCubic",
            });
          });
        },
      });
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [getRows]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const rows = getRows();

    if (prefersReducedMotion || !rows.length) {
      return;
    }

    const animation = animate(rows, {
      translateY: [
        { to: -1, duration: 1400 },
        { to: 1, duration: 1400 },
      ],
      delay: (_target: unknown, index: number) => index * 70,
      loop: true,
      alternate: true,
      ease: "inOutSine",
    });

    return () => {
      animation.revert();
    };
  }, [getRows, mode]);

  useEffect(() => {
    const shell = shellRef.current;

    if (!shell) {
      return;
    }

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (coarsePointer || prefersReducedMotion) {
      setPupilOffset(0, 0);
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = shell.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = clamp((event.clientX - centerX) / (rect.width / 2), -1, 1);
      const y = clamp((event.clientY - centerY) / (rect.height / 2), -1, 1);

      setPupilOffset(x * 5, y * 3);
    };

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [setPupilOffset]);

  return (
    <div className="w-full max-w-full text-center" ref={shellRef}>
      {mode === "wordmark" ? (
        <pre
          aria-label="Alaws Lage"
          className="mx-auto max-w-full overflow-hidden whitespace-pre font-display-mono text-[clamp(0.47rem,2.15vw,1.22rem)] font-semibold leading-[1.05] tracking-normal text-zinc-100"
        >
          {WORDMARK_LINES.map((line, index) => (
            <span
              className="block origin-center"
              data-cli-row
              key={`${line}-${index}`}
            >
              {line || " "}
            </span>
          ))}
        </pre>
      ) : (
        <div
          aria-label="Robot face"
          className="relative mx-auto w-fit max-w-full overflow-hidden font-display-mono text-[clamp(0.95rem,5.4vw,2rem)] font-semibold leading-[1.05] text-zinc-100"
        >
          <pre aria-hidden="true" className="whitespace-pre">
            {ROBOT_FACE.split("\n").map((line, index) => (
              <span
                className="block origin-center"
                data-cli-row
                key={`${line}-${index}`}
              >
                {line}
              </span>
            ))}
          </pre>
          <span className="pointer-events-none absolute left-[28%] top-[41%] grid h-[0.8em] w-[1.35em] place-items-center rounded-sm border border-zinc-500 bg-black">
            <span
              className="h-[0.28em] w-[0.28em] rounded-full bg-zinc-100 transition-transform duration-75"
              ref={leftPupilRef}
            />
          </span>
          <span className="pointer-events-none absolute right-[28%] top-[41%] grid h-[0.8em] w-[1.35em] place-items-center rounded-sm border border-zinc-500 bg-black">
            <span
              className="h-[0.28em] w-[0.28em] rounded-full bg-zinc-100 transition-transform duration-75"
              ref={rightPupilRef}
            />
          </span>
        </div>
      )}
      <p className="mt-4 text-sm text-zinc-500">Ask anything</p>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
