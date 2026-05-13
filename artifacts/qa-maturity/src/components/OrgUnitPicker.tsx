/**
 * OrgUnitPicker — компонент выбора организационной единицы.
 * Используется на страницах Metrics и Analytics для фильтрации данных по подразделению.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronRight, Network, Building2, X } from "lucide-react";

export interface OrgUnitNode {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  children: OrgUnitNode[];
  teamCount: number;
}

/**
 * Helper function to find a node by ID in the org tree
 */
function findNodeById(nodes: OrgUnitNode[], id: number | null): OrgUnitNode | null {
  if (!id) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function OrgNodeOption({
  node,
  selected,
  onSelect,
  depth = 0,
}: {
  node: OrgUnitNode;
  selected: number | null;
  onSelect: (id: number | null, name: string | null) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isSelected = selected === node.id;
  const Icon = depth === 0 ? Network : Building2;

  return (
    <div>
      <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 14}px` }}>
        {node.children.length > 0 ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="shrink-0 p-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
            <ChevronRight size={11} className={cn("transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : node.id, isSelected ? null : node.name); }}
          className={cn(
            "flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-sm transition-all",
            isSelected
              ? "bg-primary/15 text-primary border border-primary/30"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
          )}
        >
          <Icon size={12} className="shrink-0 opacity-60" />
          <span className="font-medium text-[12px] break-words flex-1">{node.name}</span>
          <span className="ml-auto text-[10px] text-muted-foreground/40 font-mono shrink-0">{node.teamCount}</span>
        </button>
      </div>
      {open && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <OrgNodeOption key={child.id} node={child} selected={selected} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OrgUnitPickerProps {
  orgTree?: OrgUnitNode[];
  selectedId: number | null;
  selectedName?: string | null;
  onSelect: (id: number | null, name: string | null) => void;
  /** Базовый URL для API (опционально, используется если orgTree не передан) */
  baseUrl?: string;
  /** Контролируемое состояние dropdown (опционально) */
  open?: boolean;
  /** Callback изменения состояния dropdown (опционально) */
  onOpenChange?: (open: boolean) => void;
}

export function OrgUnitPicker({
  orgTree: externalOrgTree,
  selectedId,
  selectedName: externalSelectedName,
  onSelect,
  baseUrl,
  open: externalOpen,
  onOpenChange
}: OrgUnitPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalOrgTree, setInternalOrgTree] = useState<OrgUnitNode[] | undefined>(externalOrgTree);
  const [internalSelectedName, setInternalSelectedName] = useState<string | null>(null);

  // Используем контролируемое состояние, если передано
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange ? onOpenChange : setInternalOpen;

  // Загружаем orgTree, если не передан извне
  useEffect(() => {
    if (externalOrgTree) {
      setInternalOrgTree(externalOrgTree);
      return;
    }

    // Автозагрузка из API
    const base = baseUrl ?? import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/org-units`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : [])
      .then(setInternalOrgTree)
      .catch(() => setInternalOrgTree([]));
  }, [externalOrgTree, baseUrl]);

  // Автозаполнение selectedName при загрузке дерева
  useEffect(() => {
    if (externalSelectedName !== undefined) {
      setInternalSelectedName(externalSelectedName ?? null);
    } else if (selectedId && internalOrgTree) {
      const node = findNodeById(internalOrgTree, selectedId);
      if (node) {
        setInternalSelectedName(node.name);
      }
    }
  }, [selectedId, internalOrgTree, externalSelectedName]);

  const displaySelectedName = externalSelectedName !== undefined ? externalSelectedName : internalSelectedName;

  return (
    <div className="relative" onPointerDownCapture={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
          selectedId
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-card/40 border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
        )}
      >
        <Network size={14} />
        <span className="max-w-[200px] break-words">{displaySelectedName ?? "Все подразделения"}</span>
        {selectedId && (
          <X
            size={13}
            className="shrink-0 opacity-60 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onSelect(null, null); setOpen(false); }}
          />
        )}
        <ChevronRight size={13} className={cn("shrink-0 transition-transform", open && "rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1.5 left-0 z-50 w-72 bg-card border border-border/60 rounded-2xl shadow-2xl shadow-black/30 p-2 max-h-80 overflow-y-auto custom-scrollbar"
            onPointerDownCapture={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(null, null); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm mb-1 transition-all",
                !selectedId ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Network size={13} />
              <span className="font-medium">Все подразделения</span>
            </button>
            <div className="border-t border-border/30 my-1.5" />
            {internalOrgTree && internalOrgTree.length > 0 && internalOrgTree.map((root) => (
              <OrgNodeOption
                key={root.id}
                node={root}
                selected={selectedId}
                onSelect={(id, name) => { onSelect(id, name); }}
                depth={0}
              />
            ))}
            {!internalOrgTree || internalOrgTree.length === 0 ? (
              <div className="py-3 text-center text-sm text-muted-foreground/60">
                {internalOrgTree === undefined ? "Загрузка..." : "Организационная структура не загружена"}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
