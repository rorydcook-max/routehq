"use client";

import { useState, type ReactNode } from "react";
import h from "../home.module.css";

export type HowStep = { key: string; title: string; body: string; bullets: string[]; visual: ReactNode };

/**
 * "How it works" as three tabs you can press (home page, 12 Nov 2026): one step on screen at a time, its picture
 * beside it, instead of three long sections to scroll through. Every step is in the page for search engines and
 * for anyone without scripts; only the chosen one is shown.
 */
export function HowTabs({ steps }: { steps: HowStep[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className={h.how}>
      <div aria-orientation="horizontal" className={h.howTabs} role="tablist">
        {steps.map((step, index) => (
          <button
            aria-controls={`how-panel-${step.key}`}
            aria-selected={index === active}
            className={`${h.howTab} ${index === active ? h.howTabOn : ""}`}
            id={`how-tab-${step.key}`}
            key={step.key}
            onClick={() => setActive(index)}
            role="tab"
            type="button"
          >
            <span aria-hidden="true" className={h.howNum}>{index + 1}</span>
            {step.title}
          </button>
        ))}
      </div>
      {steps.map((step, index) => (
        <div aria-labelledby={`how-tab-${step.key}`} className={h.howPanel} hidden={index !== active} id={`how-panel-${step.key}`} key={step.key} role="tabpanel">
          <div className={h.howText}>
            <h3 className={h.howTitle}>{step.title}</h3>
            <p className={h.howBody}>{step.body}</p>
            <ul className={h.howChecks}>
              {step.bullets.map((bullet) => (
                <li key={bullet}>
                  <span aria-hidden="true" className={h.tick}>
                    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" width="14"><path d="M5 12.5l4.500 4.500L19 7.500" /></svg>
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
          <div className={h.howVisual}>{step.visual}</div>
        </div>
      ))}
    </div>
  );
}
