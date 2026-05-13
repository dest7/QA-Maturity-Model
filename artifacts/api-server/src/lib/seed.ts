/**
 * Автоматический seed базы данных.
 *
 * seedIfEmpty()           — заполняет skills если таблица пуста
 * seedOrgStructureIfEmpty()— создаёт org_units + 30 команд если org_units пуст
 * seedUsersIfEmpty()      — создаёт 5 тестовых пользователей если таблица пуста
 *
 * Все функции идемпотентны: повторный вызов ничего не дублирует.
 */

import bcrypt from "bcryptjs";
import {
  db,
  skillsTable,
  teamsTable,
  teamSkillLevelsTable,
  usersTable,
  orgUnitsTable,
  teamSkillSnapshotsTable,
  teamSkillHistoryTable,
} from "@workspace/db";
import { isNull, eq, and, gte, lte } from "drizzle-orm";

// ─── Справочник навыков (15 штук) ────────────────────────────────────────────

const SKILLS = [
  {
    name: "Test Planning",
    description: "Ability to create structured test plans aligned with project goals",
    category: "Test Strategy",
    levelDescriptions: [
      "No formal test planning. Tests are written ad hoc without structure.",
      "Basic test plans exist for major features. Planning is informal and inconsistent.",
      "Standardized test plans with clear scope, objectives, and entry/exit criteria.",
      "Risk-based adaptive planning with continuous updates and stakeholder involvement.",
    ],
    levelRequirements: [
      "Нет формального процесса планирования тестирования.",
      "Составляются базовые тест-планы для ключевых фич. Определены цели тестирования.",
      "Тест-план содержит: область охвата, цели, критерии входа/выхода, расписание, риски. Процесс стандартизирован.",
      "Тест-планирование основано на анализе рисков. Планы обновляются итеративно. Все заинтересованные стороны вовлечены.",
    ],
    levelArtifacts: [
      "Отсутствуют какие-либо документы планирования.",
      "Неформальный тест-план или таблица задач для крупных релизов.",
      "Формальный тест-план (IEEE 829 или аналог), трекер прогресса тестирования.",
      "Адаптивный тест-план с историей версий, журнал рисков, протоколы встреч по планированию.",
    ],
    levelRecommendations: [
      "Создайте шаблон тест-плана. Начните с 1-2 обязательных разделов: цель и область охвата.",
      "Добавьте критерии входа/выхода и оценку рисков. Проводите ревью плана с командой.",
      "Внедрите риск-ориентированный подход: приоритизируйте тесты по вероятности и влиянию дефектов.",
      "Уровень оптимизирован. Автоматизируйте сбор метрик и интегрируйте план в систему управления проектами.",
    ],
  },
  {
    name: "Risk-Based Testing",
    description: "Prioritization of testing activities based on risk analysis",
    category: "Test Strategy",
    levelDescriptions: [
      "No risk analysis. All areas tested equally or by gut feeling.",
      "Informal risk identification. Some prioritization based on experience.",
      "Documented risk-based test approach with formal risk matrix.",
      "Continuous risk reassessment integrated into sprint and release planning.",
    ],
    levelRequirements: [
      "Отсутствует анализ рисков. Тесты выполняются без приоритизации.",
      "Риски идентифицируются неформально, на основе опыта команды.",
      "Ведётся формальная матрица рисков. Тест-приоритеты документированы и обоснованы.",
      "Риски пересматриваются на каждом спринте/релизе. Метрики рисков влияют на планирование.",
    ],
    levelArtifacts: [
      "Нет артефактов, связанных с рисками.",
      "Неформальный список рисков (таблица или список задач).",
      "Матрица рисков (вероятность × влияние), трассировка тест-кейсов к рискам.",
      "Динамическая матрица рисков, история переоценки рисков, дашборд рисков.",
    ],
    levelRecommendations: [
      "Начните с простой таблицы рисков: перечислите основные модули и оцените вероятность дефектов.",
      "Формализуйте матрицу рисков (2×2 или 3×3). Свяжите тест-кейсы с конкретными рисками.",
      "Автоматически пересматривайте риски при изменениях требований. Интегрируйте в спринт-планирование.",
      "Уровень оптимизирован. Используйте предиктивную аналитику и исторические данные о дефектах.",
    ],
  },
  {
    name: "Test Coverage Analysis",
    description: "Measurement and tracking of test coverage across requirements",
    category: "Test Strategy",
    levelDescriptions: [
      "No coverage tracking. Unknown what is tested.",
      "Basic coverage tracking by requirements. Manual and incomplete.",
      "Requirements traceability matrix maintained. Coverage gaps identified.",
      "Multi-dimensional coverage (code, requirements, risk) tracked with tooling.",
    ],
    levelRequirements: [
      "Нет отслеживания покрытия. Неизвестно, что протестировано.",
      "Базовое ручное отслеживание покрытия требований. Неполное.",
      "RTM (матрица трассировки требований) актуальна. Пробелы в покрытии выявляются.",
      "Покрытие отслеживается по нескольким измерениям: код, требования, риски. Используются инструменты.",
    ],
    levelArtifacts: [
      "Нет документов о покрытии.",
      "Таблица соответствия требований и тест-кейсов (частичная).",
      "Актуальная RTM, отчёты о покрытии, лог пробелов в покрытии.",
      "Автоматизированные дашборды покрытия (код + требования + риски), интеграция с CI.",
    ],
    levelRecommendations: [
      "Создайте простую таблицу: требование → тест-кейс. Хотя бы для критичных функций.",
      "Автоматизируйте сбор данных о покрытии. Выявляйте и документируйте пробелы.",
      "Добавьте покрытие кода (code coverage) в CI-пайплайн. Объедините с покрытием требований.",
      "Уровень оптимизирован. Используйте mutation testing для оценки качества тестов.",
    ],
  },
  {
    name: "Test Case Design",
    description: "Systematic creation of test cases using proven design techniques",
    category: "Test Design",
    levelDescriptions: [
      "Test cases written without formal techniques. High duplication and gaps.",
      "Some design techniques used (equivalence partitioning) inconsistently.",
      "Standard techniques (BVA, EP, decision tables) applied consistently.",
      "Optimal test suites using model-based testing and combinatorial techniques.",
    ],
    levelRequirements: [
      "Тест-кейсы написаны без применения формальных техник. Много дублирования и пробелов.",
      "Некоторые техники (разбиение на классы эквивалентности) используются непоследовательно.",
      "Стандартные техники (BVA, EP, таблицы решений) применяются систематически.",
      "Оптимальные тест-наборы на основе MBT и комбинаторных техник. Минимум избыточности.",
    ],
    levelArtifacts: [
      "Неструктурированные тест-кейсы без обоснования выбора.",
      "Часть тест-кейсов с указанием применённой техники.",
      "Тест-кейсы с обоснованием техники, матрица решений, таблицы граничных значений.",
      "Модели тестирования (FSM, таблицы переходов), отчёты о покрытии комбинаций, pairwise-таблицы.",
    ],
    levelRecommendations: [
      "Начните с разбиения на классы эквивалентности для ключевых полей ввода.",
      "Добавьте анализ граничных значений (BVA). Применяйте таблицы решений для сложной логики.",
      "Внедрите pairwise testing для многопараметрических конфигураций. Рассмотрите MBT.",
      "Уровень оптимизирован. Автоматически генерируйте тест-кейсы из моделей.",
    ],
  },
  {
    name: "Exploratory Testing",
    description: "Structured exploratory testing to uncover unexpected defects",
    category: "Test Design",
    levelDescriptions: [
      "No exploratory testing. Only scripted tests executed.",
      "Unstructured exploration by experienced testers. No documentation.",
      "Session-based exploratory testing with charters and debrief notes.",
      "Systematic exploration integrated into process with lessons learned feedback.",
    ],
    levelRequirements: [
      "Исследовательское тестирование не проводится. Только скриптованные тесты.",
      "Неструктурированное исследование опытными тестировщиками. Результаты не документируются.",
      "SBET: сессии с чартерами, тайм-боксинг, дебрифы и заметки по результатам.",
      "Систематическое исследовательское тестирование встроено в процесс. Feedback loop налажен.",
    ],
    levelArtifacts: [
      "Нет артефактов исследовательского тестирования.",
      "Неформальные заметки тестировщика, баги без источника.",
      "Чартеры сессий, логи сессий (SBET-шаблоны), отчёты дебрифов.",
      "База знаний исследовательского тестирования, история чартеров, метрики сессий, lessons learned.",
    ],
    levelRecommendations: [
      "Выделите 10–20% времени на исследовательское тестирование перед релизом.",
      "Внедрите SBET: пишите чартеры, устанавливайте тайм-бокс, фиксируйте результаты.",
      "Анализируйте результаты после каждого релиза. Создайте библиотеку чартеров для типовых сценариев.",
      "Уровень оптимизирован. Обучайте команду разработки технике исследовательского тестирования.",
    ],
  },
  {
    name: "Boundary Value Analysis",
    description: "Testing at the edges of input domains and equivalence classes",
    category: "Test Design",
    levelDescriptions: [
      "No boundary testing. Only happy-path scenarios covered.",
      "Some boundary values tested but without systematic approach.",
      "BVA applied consistently for all input fields and conditions.",
      "Extended BVA with robustness testing and integration boundary conditions.",
    ],
    levelRequirements: [
      "Граничные значения не тестируются. Только позитивные сценарии.",
      "Некоторые граничные значения проверяются, но без системного подхода.",
      "BVA применяется для всех полей ввода. Тестируются min, max, min±1, max±1.",
      "Расширенный BVA: тестирование надёжности, граничные условия между интегрируемыми системами.",
    ],
    levelArtifacts: [
      "Тест-кейсы без граничных значений.",
      "Несколько тест-кейсов с граничными значениями без документирования логики.",
      "Таблицы граничных значений для всех полей, тест-кейсы с обоснованием BVA.",
      "Тесты надёжности (за пределами границ), интеграционные граничные тесты, матрица BVA.",
    ],
    levelRecommendations: [
      "Для каждого числового поля добавьте тест-кейсы: min, max, min-1, max+1.",
      "Систематизируйте: ведите таблицу граничных значений для каждого поля ввода.",
      "Добавьте тесты надёжности (beyond boundaries). Покройте граничные случаи в API-контрактах.",
      "Уровень оптимизирован. Автоматически генерируйте граничные тесты из спецификации.",
    ],
  },
  {
    name: "Automation Framework",
    description: "Maintainable test automation with solid architecture",
    category: "Test Automation",
    levelDescriptions: [
      "No test automation. All testing is manual.",
      "Scripts exist but are fragile, unmaintained, and hard to run.",
      "Layered automation framework with page objects/abstractions. CI-integrated.",
      "Optimized, self-healing automation with parallelization and smart retry.",
    ],
    levelRequirements: [
      "Автоматизация отсутствует. Всё тестирование ручное.",
      "Скрипты существуют, но хрупкие, устаревшие и сложные в запуске.",
      "Многослойный фреймворк (Page Object / Screenplay pattern). Интегрирован в CI. Поддерживается командой.",
      "Самовосстанавливающаяся автоматизация, параллельное выполнение, умный retry, низкий maintenance cost.",
    ],
    levelArtifacts: [
      "Нет автотестов.",
      "Набор разрозненных скриптов без структуры и документации.",
      "Репозиторий фреймворка с README, CI-конфиг, отчёты о прогоне (Allure/HTML).",
      "Дашборд стабильности тестов, метрики flakiness, история прогонов, SLA на maintenance.",
    ],
    levelRecommendations: [
      "Начните с автоматизации smoke-тестов критичного пути (5–10 тест-кейсов).",
      "Внедрите Page Object pattern. Добавьте запуск в CI при каждом PR.",
      "Добавьте параллельный запуск, retry для flaky-тестов, интеграцию с Allure или аналогом.",
      "Уровень оптимизирован. Внедрите AI-assisted test generation и visual regression testing.",
    ],
  },
  {
    name: "CI/CD Integration",
    description: "Integration of automated tests into delivery pipelines",
    category: "Test Automation",
    levelDescriptions: [
      "No CI/CD integration. Tests run manually before releases.",
      "Some tests run in CI but pipelines are slow and flaky.",
      "Full test suite runs in CI/CD with clear gates. Failures block deployments.",
      "Intelligent pipeline with test selection, parallel runs, and fast feedback.",
    ],
    levelRequirements: [
      "Нет интеграции с CI/CD. Тесты запускаются вручную перед релизом.",
      "Часть тестов запускается в CI, но пайплайн медленный и нестабильный.",
      "Полный набор тестов запускается в CI/CD. Провалы блокируют деплой. Quality gates настроены.",
      "Интеллектуальный пайплайн: выбор тестов по изменениям, параллельный запуск, быстрая обратная связь.",
    ],
    levelArtifacts: [
      "Нет CI-конфигурации для тестов.",
      "Базовый CI-конфиг (GitHub Actions / Jenkins), нестабильные прогоны.",
      "CI/CD конфиг с качественными гейтами, отчёты о прогонах, уведомления о провалах.",
      "Умный выбор тестов (test impact analysis), дашборд времени обратной связи, SLA на время пайплайна.",
    ],
    levelRecommendations: [
      "Добавьте запуск хотя бы smoke-тестов в CI при каждом коммите.",
      "Настройте quality gates: запрет мержа при провале тестов. Добейтесь стабильности пайплайна.",
      "Внедрите test impact analysis для запуска только релевантных тестов. Оптимизируйте время прогона.",
      "Уровень оптимизирован. Используйте predictive test selection на основе ML.",
    ],
  },
  {
    name: "Test Data Management",
    description: "Reliable creation, management and cleanup of test data",
    category: "Test Automation",
    levelDescriptions: [
      "Tests rely on shared, unstable data. Frequent conflicts.",
      "Some data isolation but manual setup. Tests are order-dependent.",
      "Automated test data setup/teardown. Environment-specific data strategies.",
      "On-demand data generation, masking, virtualization, and full isolation.",
    ],
    levelRequirements: [
      "Тесты используют общие нестабильные данные. Частые конфликты между тестами.",
      "Частичная изоляция данных, но ручная настройка. Тесты зависят от порядка выполнения.",
      "Автоматизированная подготовка и очистка тестовых данных. Стратегии для каждой среды.",
      "Генерация данных по требованию, маскировка, виртуализация, полная изоляция каждого теста.",
    ],
    levelArtifacts: [
      "Нет документации по тестовым данным. Данные хаотичны.",
      "Скрипты ручной настройки данных, частичные фикстуры.",
      "Автоматизированные фикстуры (factories/fixtures), скрипты cleanup, документация стратегии данных.",
      "Data generation library, маска PII-данных, service virtualization конфиги, отчёты об изоляции.",
    ],
    levelRecommendations: [
      "Выделите изолированную тестовую базу данных. Добавьте скрипты сброса данных.",
      "Внедрите test data factories. Каждый тест должен создавать и удалять свои данные.",
      "Рассмотрите service virtualization для внешних зависимостей. Добавьте маскировку prod-данных.",
      "Уровень оптимизирован. Внедрите synthetic data generation с учётом бизнес-правил.",
    ],
  },
  {
    name: "Defect Tracking",
    description: "Systematic capture, classification, and lifecycle management of defects",
    category: "Quality Metrics",
    levelDescriptions: [
      "Defects tracked informally in notes or email. No system used.",
      "Bug tracker used but fields incomplete. No lifecycle management.",
      "Standardized defect lifecycle with severity/priority, assignment, and SLAs.",
      "Defect trend analysis drives process improvements and prevention strategies.",
    ],
    levelRequirements: [
      "Дефекты фиксируются неформально (заметки, почта). Системы нет.",
      "Баг-трекер используется, но поля заполняются неполно. Жизненный цикл не управляется.",
      "Стандартизированный жизненный цикл дефектов: severity/priority, назначение, SLA на исправление.",
      "Анализ трендов дефектов ведёт к улучшению процессов и стратегиям предотвращения.",
    ],
    levelArtifacts: [
      "Нет системы отслеживания дефектов.",
      "Записи в Jira/Bugzilla с неполными полями.",
      "Стандартная форма дефекта, SLA-документ, отчёты по статусам, метрики closure rate.",
      "Тренд-отчёты (дефекты по спринтам), RCA-документы, prevention backlog, дашборд качества.",
    ],
    levelRecommendations: [
      "Начните использовать баг-трекер (Jira, Linear). Добавьте обязательные поля: severity, шаги воспроизведения.",
      "Определите жизненный цикл дефекта. Установите SLA на исправление по severity.",
      "Внедрите еженедельный анализ трендов. Проводите RCA для критичных дефектов.",
      "Уровень оптимизирован. Используйте ML для предсказания дефектогенных зон кода.",
    ],
  },
  {
    name: "Test Reporting",
    description: "Transparent and actionable reporting of testing status and results",
    category: "Quality Metrics",
    levelDescriptions: [
      "No formal reporting. Status shared verbally or in meetings.",
      "Basic pass/fail counts reported. No trends or context.",
      "Structured test reports with coverage, metrics, and risk summaries.",
      "Real-time dashboards with predictive analytics and automated insights.",
    ],
    levelRequirements: [
      "Нет формальной отчётности. Статус передаётся устно или на встречах.",
      "Отчёт содержит базовые счётчики пройдено/упало. Нет трендов и контекста.",
      "Структурированные отчёты с покрытием, метриками, сводкой рисков. Регулярно распространяются.",
      "Дашборды реального времени с предиктивной аналитикой и автоматическими инсайтами.",
    ],
    levelArtifacts: [
      "Нет отчётов по результатам тестирования.",
      "Простые таблицы/письма с количеством пройденных и упавших тестов.",
      "Структурированные HTML/PDF отчёты (Allure, TestRail), метрики по спринту.",
      "Живые дашборды (Grafana, DataStudio), автоматические оповещения, предиктивные метрики.",
    ],
    levelRecommendations: [
      "После каждого тестирования отправляйте краткий отчёт команде (хотя бы в мессенджер).",
      "Добавьте тренды: сравнивайте метрики со спринтом к спринту. Включите охват покрытия.",
      "Автоматизируйте генерацию отчётов из CI. Интегрируйте с Allure или аналогом.",
      "Уровень оптимизирован. Добавьте предиктивные модели: прогноз качества релиза.",
    ],
  },
  {
    name: "KPI Monitoring",
    description: "Tracking and acting on key quality performance indicators",
    category: "Quality Metrics",
    levelDescriptions: [
      "No KPIs defined. Quality measured by gut feeling.",
      "A few metrics tracked (e.g., defect count) but not used for decisions.",
      "Defined QA KPIs tracked per sprint and release. Used in retrospectives.",
      "OKR-aligned quality metrics with causality analysis and improvement loops.",
    ],
    levelRequirements: [
      "KPI не определены. Качество оценивается интуитивно.",
      "Отслеживается несколько метрик (количество дефектов), но они не влияют на решения.",
      "Определённые QA KPI отслеживаются на каждом спринте/релизе. Используются на ретроспективах.",
      "Метрики качества согласованы с OKR. Причинно-следственный анализ. Циклы улучшений.",
    ],
    levelArtifacts: [
      "Нет документации по метрикам.",
      "Таблица с 1–3 метриками, без анализа и связи с решениями.",
      "KPI-дашборд (дефекты, покрытие, время цикла), отчёты спринта, данные для ретроспектив.",
      "OKR-карта качества, causality map, improvement backlog, прогнозные метрики.",
    ],
    levelRecommendations: [
      "Определите 3–5 ключевых метрик: defect density, test pass rate, escaped defects.",
      "Подключите KPI к ретроспективам. Анализируйте причины отклонений.",
      "Свяжите KPI с бизнес-целями (OKR). Автоматизируйте сбор и визуализацию.",
      "Уровень оптимизирован. Используйте A/B тестирование процессных изменений на основе KPI.",
    ],
  },
  {
    name: "Code Review in QA",
    description: "QA involvement in code and design reviews to catch issues early",
    category: "Process",
    levelDescriptions: [
      "QA not involved in code reviews. Issues found only in testing phase.",
      "QA occasionally reviews code. No standardized checklist.",
      "QA participates in code reviews with testability and quality checklists.",
      "QA co-owns code review process. Testability gates built into review SLA.",
    ],
    levelRequirements: [
      "QA не участвует в ревью кода. Проблемы выявляются только на этапе тестирования.",
      "QA иногда проверяет код. Нет стандартизированного чеклиста.",
      "QA участвует в code review с чеклистами тестируемости и качества. Процесс регулярный.",
      "QA совместно владеет процессом ревью. Гейты тестируемости встроены в SLA ревью.",
    ],
    levelArtifacts: [
      "QA не упоминается в PR-правилах.",
      "Редкие комментарии QA в PR без системного подхода.",
      "QA-чеклист для ревью (testability, observability, error handling), метрики участия QA.",
      "Testability gate в PR-правилах, SLA на ревью с QA-участием, метрики качества ревью.",
    ],
    levelRecommendations: [
      "Добавьте QA в PR-ревьюеры хотя бы для критичных модулей.",
      "Создайте QA-чеклист для ревью: тестируемость, логирование, обработка ошибок.",
      "Внедрите обязательное QA-ревью для новых фич. Измеряйте количество дефектов, найденных на этапе ревью.",
      "Уровень оптимизирован. Автоматизируйте проверку тестируемости через статический анализ.",
    ],
  },
  {
    name: "Shift-Left Testing",
    description: "Moving testing activities earlier in the development lifecycle",
    category: "Process",
    levelDescriptions: [
      "Testing starts only after development is complete.",
      "QA involved in requirement review. Some early testing activities.",
      "QA embedded in Agile teams. Testing from story writing to deployment.",
      "Full shift-left: TDD/BDD practiced. QA shapes requirements and architecture.",
    ],
    levelRequirements: [
      "Тестирование начинается только после завершения разработки.",
      "QA участвует в ревью требований. Некоторые ранние активности тестирования.",
      "QA встроен в Agile-команды. Тестирование от написания user story до деплоя.",
      "Полный shift-left: практикуются TDD/BDD. QA влияет на требования и архитектуру.",
    ],
    levelArtifacts: [
      "QA подключается только в конце разработки.",
      "Комментарии QA на встречах по требованиям, ранние тест-кейсы по требованиям.",
      "Acceptance criteria в user stories от QA, BDD-сценарии (Gherkin), участие в grooming.",
      "TDD/BDD метрики, QA-вклад в архитектурные решения, early defect rate (дефекты до кода).",
    ],
    levelRecommendations: [
      "Добавьте QA на встречи по требованиям. Пусть QA задаёт вопросы «как это тестировать?»",
      "QA должен писать acceptance criteria вместе с PO. Начните с BDD для ключевых фич.",
      "Внедрите TDD в разработке. QA проводит тест-анализ на этапе дизайна API.",
      "Уровень оптимизирован. QA влияет на product strategy через метрики качества.",
    ],
  },
  {
    name: "Performance Testing",
    description: "Systematic testing of system performance, load, and scalability",
    category: "Process",
    levelDescriptions: [
      "No performance testing. Issues discovered in production.",
      "Ad hoc load tests run before major releases. No baselines.",
      "Regular performance testing with defined SLAs and trend tracking.",
      "Continuous performance testing in pipeline with anomaly detection.",
    ],
    levelRequirements: [
      "Нагрузочное тестирование не проводится. Проблемы обнаруживаются в продакшне.",
      "Нагрузочные тесты запускаются нерегулярно перед крупными релизами. Нет базовых метрик.",
      "Регулярное нагрузочное тестирование с определёнными SLA и отслеживанием трендов.",
      "Непрерывное нагрузочное тестирование в пайплайне с детекцией аномалий в реальном времени.",
    ],
    levelArtifacts: [
      "Нет тестов производительности.",
      "Разовые скрипты нагрузки (JMeter/k6) без базовых значений и сравнения.",
      "Задокументированные SLA производительности, тренд-отчёты, baseline метрики.",
      "Continuous performance testing конфиг, anomaly detection алерты, APM-интеграция.",
    ],
    levelRecommendations: [
      "Проведите baseline нагрузочный тест: определите текущую производительность системы.",
      "Установите SLA (время ответа, throughput, error rate). Тестируйте перед каждым релизом.",
      "Добавьте нагрузочные тесты в CI/CD. Настройте автоматические алерты при деградации.",
      "Уровень оптимизирован. Интегрируйте с APM (Datadog, New Relic) для chaos engineering.",
    ],
  },
];

// ─── Org структура ────────────────────────────────────────────────────────────

const ORG_STRUCTURE = [
  {
    name: "Управление продуктовой разработки",
    description: "Отвечает за продуктовые решения: бэкенд, фронтенд и качество продукта",
    departments: [
      {
        name: "Отдел Backend-разработки",
        description: "Серверная логика, API, интеграции и безопасность",
        teams: [
          { name: "Core API",        description: "Ядро платформы: публичные и внутренние API",            level: 3 },
          { name: "Data Platform",   description: "Хранение, обработка и доступ к данным",                level: 2 },
          { name: "Integrations",    description: "Интеграции с внешними сервисами и партнёрами",          level: 2 },
          { name: "Auth & Security", description: "Аутентификация, авторизация и информационная безопасность", level: 3 },
          { name: "Payments",        description: "Платёжная инфраструктура и финансовые операции",       level: 2 },
        ],
      },
      {
        name: "Отдел Frontend-разработки",
        description: "Пользовательские интерфейсы: веб, мобайл и дизайн-система",
        teams: [
          { name: "Web App",         description: "Основное веб-приложение для конечных пользователей",   level: 2 },
          { name: "Design System",   description: "Единая библиотека компонентов и токены дизайна",       level: 3 },
          { name: "Mobile Web",      description: "Мобильная версия и PWA-адаптации",                     level: 1 },
          { name: "Analytics UI",    description: "Дашборды и инструменты визуализации данных",            level: 1 },
          { name: "Admin Panel",     description: "Внутренние инструменты для операционной команды",      level: 2 },
        ],
      },
      {
        name: "Отдел QA & Reliability",
        description: "Качество продукта, автоматизация тестирования и надёжность релизов",
        teams: [
          { name: "Automation QA",      description: "Автоматизированное тестирование и фреймворки",       level: 2 },
          { name: "Performance",        description: "Нагрузочное тестирование и профилирование",          level: 1 },
          { name: "Release Engineering",description: "Управление релизами и deployment-процессы",          level: 2 },
          { name: "Monitoring",         description: "Мониторинг, алертинг и SLO",                        level: 1 },
          { name: "Incident Response",  description: "Управление инцидентами и постмортемы",               level: 1 },
        ],
      },
    ],
  },
  {
    name: "Управление инфраструктуры и DevOps",
    description: "Инфраструктура, доставка кода и корпоративная безопасность",
    departments: [
      {
        name: "Отдел Cloud Infrastructure",
        description: "Облачные ресурсы, сети, хранилища и DR",
        teams: [
          { name: "Kubernetes",          description: "Оркестрация контейнеров и платформа k8s",            level: 2 },
          { name: "Networking",          description: "Сетевая архитектура и балансировка нагрузки",         level: 1 },
          { name: "Storage & DB",        description: "Управляемые базы данных и объектные хранилища",       level: 2 },
          { name: "Cost Optimization",   description: "Оптимизация облачных расходов и FinOps",             level: 1 },
          { name: "DR & Backup",         description: "Disaster recovery и резервное копирование",           level: 1 },
        ],
      },
      {
        name: "Отдел Developer Experience",
        description: "Инструменты разработчика, CI/CD и внутренние платформы",
        teams: [
          { name: "CI/CD",               description: "Конвейеры сборки, тестирования и доставки",          level: 3 },
          { name: "Internal Tools",      description: "Внутренние платформы и инструменты автоматизации",   level: 1 },
          { name: "Developer Portal",    description: "Портал разработчика, документация и onboarding",     level: 1 },
          { name: "SDK & Libraries",     description: "Клиентские SDK, библиотеки и инструменты интеграции",level: 2 },
          { name: "Observability",       description: "Трейсинг, логирование и метрики платформы",          level: 2 },
        ],
      },
      {
        name: "Отдел Security & Compliance",
        description: "Прикладная безопасность, соответствие требованиям и управление доступом",
        teams: [
          { name: "AppSec",              description: "Безопасность приложений и пентестирование",          level: 2 },
          { name: "Infra Security",      description: "Безопасность инфраструктуры и hardening",            level: 1 },
          { name: "Compliance",          description: "Соответствие стандартам ISO/SOC2/GDPR",              level: 1 },
          { name: "Identity & Access",   description: "IAM, SSO и управление привилегированным доступом",   level: 2 },
          { name: "Threat Intelligence", description: "Мониторинг угроз и аналитика безопасности",         level: 1 },
        ],
      },
    ],
  },
];

// ─── Вспомогательные функции ───────────────────────────────────────────────────

function calculateOverallLevel(levels: number[]): number {
  const total = levels.length;
  if (total === 0) return 0;
  for (let level = 3; level >= 1; level--) {
    const count = levels.filter((l) => l >= level).length;
    if (count / total >= 0.85) return level;
  }
  return 0;
}

/** Генерирует реалистичный набор уровней навыков для нужного overallLevel */
function generateSkillLevels(targetLevel: number): number[] {
  const n = 15;
  if (targetLevel === 3) {
    // 13 навыков на 3, 2 на 2 → overallLevel=3
    return [...Array(13).fill(3), 2, 2];
  }
  if (targetLevel === 2) {
    // 13 навыков на 2, 1 на 3, 1 на 1 → overallLevel=2
    return [...Array(13).fill(2), 3, 1];
  }
  if (targetLevel === 1) {
    // 13 навыков на 1, 2 на 0 → overallLevel=1
    return [...Array(13).fill(1), 0, 0];
  }
  return Array(n).fill(0);
}

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedUsersIfEmpty(assignedTeamIds: number[]): Promise<void> {
  const existingUsers = await db.select().from(usersTable).limit(1);
  if (existingUsers.length > 0) {
    console.log("Users already seeded — skipping.");
    return;
  }

  const users = [
    { name: "Edward",  email: "edward@company.com", password: "Edward",  role: "admin",       assignedTeamIds: [] as number[] },
    { name: "Anna",    email: "anna@company.com",   password: "Anna",    role: "viewer",      assignedTeamIds: [] },
    { name: "Boris",   email: "boris@company.com",  password: "Boris",   role: "contributor", assignedTeamIds: assignedTeamIds.slice(0, 3) },
    { name: "Clara",   email: "clara@company.com",  password: "Clara",   role: "reviewer",    assignedTeamIds: [] },
    { name: "Igor",    email: "igor@company.com",   password: "Igor",    role: "manager",     assignedTeamIds: assignedTeamIds.slice(0, 5) },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await db.insert(usersTable).values({ name: u.name, email: u.email, passwordHash, role: u.role, assignedTeamIds: u.assignedTeamIds });
    console.log(`  ✓ Created user "${u.name}" (${u.role})`);
  }
}

export async function seedIfEmpty(): Promise<void> {
  // Сначала проверяем/заполняем навыки
  const existingSkills = await db.select().from(skillsTable).limit(1);
  if (existingSkills.length === 0) {
    console.log("Empty database — seeding skills...");
    await db.insert(skillsTable).values(SKILLS);
    console.log(`  ✓ Inserted ${SKILLS.length} skills`);
  } else {
    console.log("Database already seeded — skipping skills.");
  }

  // Проверяем наличие org_units — если нет, создаём всю структуру заново
  const existingOrg = await db.select().from(orgUnitsTable).limit(1);
  if (existingOrg.length > 0) {
    console.log("Org structure already seeded — skipping teams.");
    const allTeams = await db.select().from(teamsTable).where(isNull(teamsTable.deletedAt));
    const teamIds = allTeams.map((t) => t.id);
    await seedUsersIfEmpty(teamIds);
    
    // Проверяем наличие snapshot'ов — если нет, генерируем исторические данные
    const existingSnapshots = await db.select().from(teamSkillSnapshotsTable).limit(1);
    if (existingSnapshots.length === 0 && allTeams.length > 0) {
      console.log("No snapshots found — generating historical data...");
      await generateSnapshots();
      await generateHistory();
    }
    return;
  }

  console.log("Seeding org structure and teams...");

  // Жёстко удаляем старые тестовые команды (если есть)
  const oldTeams = await db.select().from(teamsTable);
  for (const t of oldTeams) {
    await db.delete(teamsTable).where(eq(teamsTable.id, t.id));
  }
  if (oldTeams.length > 0) console.log(`  ✓ Removed ${oldTeams.length} old test teams`);

  const skills = await db.select().from(skillsTable).orderBy(skillsTable.id);
  const allCreatedTeamIds: number[] = [];

  for (const mgmt of ORG_STRUCTURE) {
    // Создаём управление (корневой узел)
    const [mgmtUnit] = await db.insert(orgUnitsTable).values({
      name: mgmt.name,
      description: mgmt.description,
      parentId: null,
    }).returning();
    console.log(`  ✓ Created management unit: ${mgmt.name}`);

    for (const dept of mgmt.departments) {
      // Создаём отдел (дочерний узел)
      const [deptUnit] = await db.insert(orgUnitsTable).values({
        name: dept.name,
        description: dept.description,
        parentId: mgmtUnit.id,
      }).returning();
      console.log(`    ✓ Created department: ${dept.name}`);

      for (const teamDef of dept.teams) {
        const skillLevels = generateSkillLevels(teamDef.level);
        const overallLevel = calculateOverallLevel(skillLevels);

        const [team] = await db.insert(teamsTable).values({
          name: teamDef.name,
          description: teamDef.description,
          orgUnitId: deptUnit.id,
          overallLevel,
          assessmentStatus: overallLevel >= 2 ? "completed" : overallLevel === 1 ? "in_progress" : "planned",
        }).returning();

        await db.insert(teamSkillLevelsTable).values(
          skills.map((skill, idx) => ({
            teamId: team.id,
            skillId: skill.id,
            level: skillLevels[idx] ?? 0,
          }))
        );

        allCreatedTeamIds.push(team.id);
        console.log(`      ✓ Team "${team.name}" L${overallLevel}`);
      }
    }
  }

  console.log(`Seed complete. ${allCreatedTeamIds.length} teams created.`);

  await seedUsersIfEmpty(allCreatedTeamIds);
  
  // Генерируем исторические данные для метрик
  await generateSnapshots();
  await generateHistory();
}

// ─── Генерация исторических данных для метрик ───────────────────────────────

/**
 * Генерирует ежедневные snapshot'ы уровней навыков для всех команд.
 * Период: 1 октября 2025 — текущий день.
 * Snapshot'ы консистентны с текущими данными в team_skill_levels.
 */
export async function generateSnapshots() {
  console.log("Generating historical snapshots (Oct 1, 2025 — today)...");

  const startDate = new Date("2025-10-01");
  const today = new Date();
  const totalDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Получаем все активные команды и их текущие уровни навыков
  const teams = await db.select().from(teamsTable).where(isNull(teamsTable.deletedAt));
  const skills = await db.select().from(skillsTable);

  // Получаем текущие уровни для всех команд
  const currentLevels = await db.select().from(teamSkillLevelsTable);
  const levelsMap = new Map<string, number>();
  for (const level of currentLevels) {
    levelsMap.set(`${level.teamId}-${level.skillId}`, level.level);
  }

  const snapshots = [];
  const snapshotDate = new Date(startDate);

  while (snapshotDate <= today) {
    const daysFromStart = Math.floor((snapshotDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const progress = daysFromStart / totalDays; // 0.0 → 1.0

    for (const team of teams) {
      for (const skill of skills) {
        const currentLevel = levelsMap.get(`${team.id}-${skill.id}`) ?? 0;

        // Прогрессивный рост уровня: к текущей дате должен быть currentLevel
        // В начале периода уровень ниже, постепенно растёт
        const historicalLevel = Math.max(0, Math.floor(currentLevel * progress));

        snapshots.push({
          teamId: team.id,
          skillId: skill.id,
          level: historicalLevel,
          snapshotDate: snapshotDate.toISOString().split("T")[0],
        });
      }
    }

    snapshotDate.setDate(snapshotDate.getDate() + 1);
  }

  // Batch insert по 1000 записей
  const batchSize = 1000;
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);
    await db.insert(teamSkillSnapshotsTable).values(batch);
  }

  console.log(`  ✓ Generated ${snapshots.length} snapshots (${totalDays} days × ${teams.length} teams × ${skills.length} skills)`);
}

/**
 * Генерирует историю изменений уровней навыков (2 изменения на навык).
 * Используется для аудита и страницы "Динамика зрелости навыков".
 */
export async function generateHistory() {
  console.log("Generating skill level history (2 changes per skill)...");

  const teams = await db.select().from(teamsTable).where(isNull(teamsTable.deletedAt));
  const skills = await db.select().from(skillsTable);
  const users = await db.select().from(usersTable);

  const history = [];
  const today = new Date();
  const periodStart = new Date("2025-10-01");

  for (const team of teams) {
    for (const skill of skills) {
      // Генерируем 2 изменения на каждый навык
      for (let changeIdx = 0; changeIdx < 2; changeIdx++) {
        // Первое изменение: октябрь 2025 — январь 2026
        // Второе изменение: февраль 2026 — апрель 2026
        const changeDate = new Date(periodStart);
        const daysOffset = changeIdx === 0
          ? Math.floor(Math.random() * 90)  // 0-90 дней (окт-дек)
          : 120 + Math.floor(Math.random() * 90);  // 120-210 дней (фев-апр)
        changeDate.setDate(changeDate.getDate() + daysOffset);

        const oldLevel = changeIdx === 0 ? 0 : Math.floor(Math.random() * 2);
        const newLevel = Math.min(3, oldLevel + 1);
        const userId = users[Math.floor(Math.random() * users.length)]?.id ?? null;

        history.push({
          teamId: team.id,
          skillId: skill.id,
          oldLevel: changeIdx === 0 ? null : oldLevel,
          newLevel,
          changedAt: changeDate,  // ← Date объект, не строка
          changedByUserId: userId,
        });
      }
    }
  }

  await db.insert(teamSkillHistoryTable).values(history);
  console.log(`  ✓ Generated ${history.length} history records (${teams.length} teams × ${skills.length} skills × 2 changes)`);
}

/**
 * Полная перегенерация данных для метрик.
 * Очищает старые snapshot'ы и history, затем создаёт новые.
 */
export async function regenerateMetricsData() {
  console.log("Regenerating metrics data...");

  console.log("  Clearing old snapshots...");
  await db.delete(teamSkillSnapshotsTable);

  console.log("  Clearing old history...");
  await db.delete(teamSkillHistoryTable);

  await generateSnapshots();
  await generateHistory();

  console.log("Metrics data regeneration complete!");
}
