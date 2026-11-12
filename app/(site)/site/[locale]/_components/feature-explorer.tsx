"use client";

import { useState, type ReactNode } from "react";
import h from "../home.module.css";

export type FeatureGroup = {
  key: string;
  label: string;
  icon: ReactNode;
  /** The pitch for this part of the job: a headline, a line or two, and a picture of the product doing it. */
  panel: { title: string; body: string; visual: ReactNode; wide?: boolean };
  items: Array<{ title: string; body: string; icon: ReactNode; soon?: string }>;
};

/**
 * How RoveHQ works and everything in it, sorted into the parts of the job (home page, 12 Nov 2026). One part on
 * screen at a time: its pitch and a picture, then each tool as a tile with an icon and one line, so forty tools
 * read in seconds. Every part is in the page for search engines and for anyone without scripts; only the chosen
 * one is shown.
 */
export function FeatureExplorer({ groups }: { groups: FeatureGroup[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className={h.fx}>
      <div aria-orientation="horizontal" className={h.fxTabs} role="tablist">
        {groups.map((group, index) => (
          <button
            aria-controls={`fx-panel-${group.key}`}
            aria-selected={index === active}
            className={`${h.fxTab} ${index === active ? h.fxTabOn : ""}`}
            id={`fx-tab-${group.key}`}
            key={group.key}
            onClick={() => setActive(index)}
            role="tab"
            type="button"
          >
            <span aria-hidden="true" className={h.fxTabIcon}>{group.icon}</span>
            {group.label}
            <span className={h.fxCount}>{group.items.length}</span>
          </button>
        ))}
      </div>
      {groups.map((group, index) => (
        <div aria-labelledby={`fx-tab-${group.key}`} hidden={index !== active} id={`fx-panel-${group.key}`} key={group.key} role="tabpanel">
          <div className={`${h.howPanel} ${group.panel.wide ? h.fxPanelWide : ""}`}>
            <div className={h.howText}>
              <h3 className={h.howTitle}>{group.panel.title}</h3>
              <p className={h.howBody}>{group.panel.body}</p>
            </div>
            <div className={group.panel.wide ? h.fxVisualWide : h.howVisual}>{group.panel.visual}</div>
          </div>
          <ul className={h.fxGrid}>
            {group.items.map((item) => (
              <li className={h.fxItem} key={item.title}>
                <span aria-hidden="true" className={h.fxIcon}>{item.icon}</span>
                <span className={h.fxText}>
                  <strong>
                    {item.title}
                    {item.soon ? <em className={h.fxSoon}>{item.soon}</em> : null}
                  </strong>
                  <span>{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
