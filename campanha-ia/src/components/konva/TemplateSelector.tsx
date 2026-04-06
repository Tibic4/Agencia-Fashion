"use client";

import { templateStyles } from "./templates";

interface TemplateSelectorProps {
  activeTemplate: string;
  onSelect: (id: string) => void;
}

/**
 * Horizontal scrollable template selector with brand styling.
 */
export default function TemplateSelector({ activeTemplate, onSelect }: TemplateSelectorProps) {
  return (
    <div
      className="flex items-center gap-2 mb-4 overflow-x-auto pb-1"
      role="radiogroup"
      aria-label="Estilo do template"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {templateStyles.map((tpl) => {
        const isActive = activeTemplate === tpl.id;
        return (
          <button
            key={tpl.id}
            onClick={() => onSelect(tpl.id)}
            role="radio"
            aria-checked={isActive}
            aria-label={`Template ${tpl.label}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all"
            style={{
              background: isActive ? "var(--gradient-brand)" : "var(--surface)",
              color: isActive ? "white" : "var(--muted)",
              border: isActive ? "none" : "1px solid var(--border)",
              transform: isActive ? "scale(1.05)" : "scale(1)",
            }}
          >
            <span aria-hidden="true">{tpl.icon}</span>
            {tpl.label}
          </button>
        );
      })}
    </div>
  );
}
