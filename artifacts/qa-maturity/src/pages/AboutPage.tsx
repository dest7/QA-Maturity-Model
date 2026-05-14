/**
 * Страница About — информация о проекте QA-Maturity-Model
 */

import { Link } from "wouter";
import { motion } from "framer-motion";
import { Target, ArrowLeft, GitBranch, BarChart3, Users, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

const FEATURES = [
  {
    icon: Users,
    title: "Оценка команд",
    description: "Комплексная оценка зрелости команд по 15 навыкам модели QA",
  },
  {
    icon: BarChart3,
    title: "Метрики и аналитика",
    description: "Детальные метрики по командам, навыкам и использованию инструмента",
  },
  {
    icon: GitBranch,
    title: "Оргструктура",
    description: "Иерархическое представление команд по управлениям и отделам",
  },
  {
    icon: Clock,
    title: "История изменений",
    description: "Отслеживание динамики развития навыков во времени",
  },
];

const LEVELS = [
  {
    level: 0,
    name: "Начальный",
    color: "bg-slate-500",
    description: "Команда только начинает свой путь развития",
  },
  {
    level: 1,
    name: "Развитие",
    color: "bg-amber-500",
    description: "Активная работа над развитием навыков",
  },
  {
    level: 2,
    name: "Эффективность",
    color: "bg-blue-500",
    description: "Стабильная работа с предсказуемыми результатами",
  },
  {
    level: 3,
    name: "Оптимизация",
    color: "bg-emerald-500",
    description: "Непрерывное улучшение и оптимизация процессов",
  },
];

export function AboutPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-background p-8"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Заголовок с версией */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <button className="p-2 rounded-lg hover:bg-accent transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary"
            )}>
              <Target size={24} />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground">
                QA Maturity Model
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted border">
                  v{APP_VERSION}
                </span>
                <span className="text-xs text-muted-foreground">
                  Сборка от {new Date().toLocaleDateString("ru-RU")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Описание проекта */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="font-display font-bold text-lg mb-4">О проекте</h2>
          <p className="text-foreground/80 leading-relaxed">
            <strong>QA-Maturity-Model</strong> — инструмент для оценки и развития зрелости команд разработки.
            Модель помогает командам определить текущий уровень развития навыков, поставить цели и отслеживать прогресс.
          </p>
          <p className="text-foreground/80 leading-relaxed mt-4">
            Инструмент предоставляет аналитику по всем командам организации, выявляет сильные и слабые стороны,
            а также показывает динамику развития во времени.
          </p>
        </section>

        {/* Возможности */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="font-display font-bold text-lg mb-6">Возможности</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex items-start gap-3 p-4 rounded-xl bg-sidebar-accent/30 border border-border/50"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Уровни зрелости */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="font-display font-bold text-lg mb-6">Уровни зрелости</h2>
          <div className="space-y-3">
            {LEVELS.map((lvl) => (
              <div
                key={lvl.level}
                className="flex items-center gap-4 p-4 rounded-xl bg-sidebar-accent/30 border border-border/50"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-lg",
                  lvl.color
                )}>
                  {lvl.level}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">{lvl.name}</h3>
                  <p className="text-xs text-muted-foreground">{lvl.description}</p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-muted-foreground/50" />
              </div>
            ))}
          </div>
        </section>

        {/* Техническая информация */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="font-display font-bold text-lg mb-4">Техническая информация</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-border/30">
              <span className="text-muted-foreground">Версия</span>
              <span className="font-mono">{APP_VERSION}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/30">
              <span className="text-muted-foreground">Автор</span>
              <span className="font-medium text-foreground">Edward Adjei</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/30">
              <span className="text-muted-foreground">Дата сборки</span>
              <span>{new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Среда</span>
              <span className="font-mono">{import.meta.env.MODE || "production"}</span>
            </div>
          </div>
        </section>

        {/* Футер */}
        <div className="text-center pt-8 pb-4">
          <p className="text-xs text-muted-foreground">
            QA-Maturity-Model © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
