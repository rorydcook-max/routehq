"use client";

import { useState, type ReactNode } from "react";
import h from "../home.module.css";

export type FeatureGroup = {
  key: string;
  label: string;
  icon: ReactNode;
  items: Array<{ title: string; body: string; icon: ReactNode; soon?: string }>;
};

/**
 * Everything RoveHQ does, sorted into the parts of the job (home page, 12 Nov 2026). One group on screen at a time,
 * each tool a tile with a picture and one line, so thirty-odd tools read in seconds. Every group is in the page
 * for search engines and for anyone without scripts; only the chosen one is shown.
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
        <ul aria-labelledby={`fx-tab-${group.key}`} className={h.fxGrid} hidden={index !== active} id={`fx-panel-${group.key}`} key={group.key} role="tabpanel">
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
      ))}
    </div>
  );
}
