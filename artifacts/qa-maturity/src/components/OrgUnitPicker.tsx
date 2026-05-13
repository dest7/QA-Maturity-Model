/**
 * OrgUnitPicker — выбор узла оргструктуры (дерево подразделений).
 *
 * Используется в модальном окне создания/редактирования команды.
 * Показывает всё дерево оргструктуры с возможностью выбора узла или "без подразделения".
 *
 * Props:
 * - value: текущий выбранный orgUnitId (null = без подразделения)
 * - onChange: callback при изменении выбора
 * - disabled: отключить выбор
 */

import { useState, useEffect } from "react";
import { ChevronRight, Network, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface OrgUnitNode {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  children: OrgUnitNode[];
  teamCount: number;
}

interface OrgUnitPickerProps {
  value: number | null;
  onChange: (orgUnitId: number | null) => void;
  disabled?: boolean;
}

function OrgNodeOption({
  node,
  selected,
  onSelect,
  depth = 0,
  disabled = false,
}: {
  node: OrgUnitNode;
  selected: number | null;
  onSelect: (id: number | null) => void;
  depth?: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isSelected = selected === node.id;
  const Icon = depth === 0 ? Network : Building2;

  return (
    <div>
      <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="shrink-0 p-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            disabled={disabled}
          >
            <ChevronRight size={11} className={cn("transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(isSelected ? null : node.id)}
          disabled={disabled}
          className={cn(
            "flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-sm transition-all",
            disabled
              ? "opacity-50 cursor-not-allowed"
              : isSelected
              ? "bg-primary/15 text-primary border border-primary/30"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
          )}
        >
          <Icon size={12} className="shrink-0 opacity-60" />
          <span className="font-medium text-[12px] break-words flex-1">{node.name}</span>
        </button>
      </div>
      {open && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <OrgNodeOption key={child.id} node={child} selected={selected} onSelect={onSelect} depth={depth + 1} disabled={disabled} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgUnitPicker({ value, onChange, disabled = false }: OrgUnitPickerProps) {
  const [tree, setTree] = useState<OrgUnitNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/org-units`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setTree(data);
        setIsLoading(false);
      })
      .catch(() => {
        setTree([]);
        setIsLoading(false);
      });
  }, []);

  const handleSelect = (id: number | null) => {
    if (!disabled) {
      onChange(id);
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground/50 py-2">
        Загрузка оргструктуры...
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="text-sm text-muted-foreground/50 py-2">
        Оргструктура не настроена
      </div>
    );
  }

  return (
    <div className="border border-border/50 rounded-lg p-3 max-h-[300px] overflow-y-auto custom-scrollbar bg-background/30">
      {/* Опция "Без подразделения" */}
      <div className="mb-2 pb-2 border-b border-border/30">
        <button
          type="button"
          onClick={() => handleSelect(null)}
          disabled={disabled}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-all",
            disabled
              ? "opacity-50 cursor-not-allowed"
              : value === null
              ? "bg-primary/15 text-primary border border-primary/30"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
          )}
        >
          <Network size={12} className="shrink-0 opacity-60" />
          <span className="font-medium text-[12px]">Без подразделения</span>
        </button>
      </div>

      {/* Дерево подразделений */}
      <div className="space-y-0.5">
        {tree.map((root) => (
          <OrgNodeOption
            key={root.id}
            node={root}
            selected={value}
            onSelect={handleSelect}
            depth={0}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
