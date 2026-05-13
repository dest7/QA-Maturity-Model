/**
 * AnalyticsPage — расширенная аналитика с вкладками.
 * Доступна только для ролей manager и admin.
 *
 * Вкладки:
 *   1. Команды — метрики зрелости команд (распределение, критичность, динамика)
 *   2. Навыки — метрики развития навыков (время перехода)
 *   3. Инструмент — метрики использования QMM (адоптация, статусы)
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRoute } from "wouter";
import { BarChart2, Users, Target, ClipboardCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OrgUnitPicker, type OrgUnitNode } from "@/components/OrgUnitPicker";
import { TeamsMetricsTab } from "./metrics/TeamsMetricsTab";
import { SkillsMetricsTab } from "./metrics/SkillsMetricsTab";
import { ToolMetricsTab } from "./metrics/ToolMetricsTab";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AnalyticsPage() {
  const [match, params] = useRoute("/analytics/:tab");

  // Определяем активную вкладку из URL или используем значение по умолчанию
  const activeTab = params?.tab ?? "teams";

  // Состояние для выбора оргструктуры
  const [orgTree, setOrgTree] = useState<OrgUnitNode[]>([]);
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<number | null>(null);
  const [selectedOrgUnitName, setSelectedOrgUnitName] = useState<string | null>(null);

  // Загрузка дерева оргструктуры
  useEffect(() => {
    fetch(`${BASE}/api/org-units`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : [])
      .then(setOrgTree)
      .catch(() => setOrgTree([]));
  }, []);

  // Обработчик выбора подразделения
  const handleOrgUnitSelect = (id: number | null, name: string | null) => {
    setSelectedOrgUnitId(id);
    setSelectedOrgUnitName(name);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1800px] mx-auto pb-20"
    >
      {/* Заголовок */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <BarChart2 size={20} />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight font-display">Analytics</h1>
          </div>
          <OrgUnitPicker
            orgTree={orgTree}
            selectedId={selectedOrgUnitId}
            selectedName={selectedOrgUnitName}
            onSelect={handleOrgUnitSelect}
          />
        </div>
        <p className="text-muted-foreground text-lg">Расширенные метрики и аналитика</p>
      </div>

      {/* Вкладки */}
      <Tabs value={activeTab} className="w-full">
        {/* Переключатель вкладок */}
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <a href={`${BASE}/analytics/teams`} className="contents">
            <TabsTrigger value="teams" className="flex items-center gap-2 data-[state=active]:font-bold">
              <Users size={16} />
              <span>Команды</span>
            </TabsTrigger>
          </a>
          <a href={`${BASE}/analytics/skills`} className="contents">
            <TabsTrigger value="skills" className="flex items-center gap-2 data-[state=active]:font-bold">
              <Target size={16} />
              <span>Навыки</span>
            </TabsTrigger>
          </a>
          <a href={`${BASE}/analytics/tool`} className="contents">
            <TabsTrigger value="tool" className="flex items-center gap-2 data-[state=active]:font-bold">
              <ClipboardCheck size={16} />
              <span>Инструмент</span>
            </TabsTrigger>
          </a>
        </TabsList>

        {/* Контент вкладок */}
        <TabsContent value="teams" className="mt-0">
          <TeamsMetricsTab orgUnitId={selectedOrgUnitId} />
        </TabsContent>

        <TabsContent value="skills" className="mt-0">
          <SkillsMetricsTab orgUnitId={selectedOrgUnitId} />
        </TabsContent>

        <TabsContent value="tool" className="mt-0">
          <ToolMetricsTab orgUnitId={selectedOrgUnitId} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
