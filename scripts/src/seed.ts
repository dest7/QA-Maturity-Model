import { db, skillsTable, teamsTable, teamSkillLevelsTable } from "@workspace/db";

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

const TEAMS = [
  {
    name: "Team Alpha",
    description: "Backend services team — early-stage QA practices",
    skillLevels: [0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
  },
  {
    name: "Team Beta",
    description: "Frontend product team — developing QA maturity",
    skillLevels: [1, 1, 1, 2, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0],
  },
  {
    name: "Team Gamma",
    description: "Platform team — defined QA processes",
    skillLevels: [2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 1],
  },
  {
    name: "Team Delta",
    description: "Core infrastructure team — optimized QA practices",
    skillLevels: [3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3],
  },
  {
    name: "Team Epsilon",
    description: "Mobile apps team — mixed maturity levels",
    skillLevels: [2, 1, 2, 2, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 0],
  },
];

function calculateOverallLevel(levels: number[]): number {
  const total = levels.length;
  if (total === 0) return 0;
  const threshold = 0.85;
  for (let level = 3; level >= 1; level--) {
    const count = levels.filter((l) => l >= level).length;
    if (count / total >= threshold) return level;
  }
  return 0;
}

async function seed() {
  console.log("Seeding database...");

  await db.delete(teamSkillLevelsTable);
  await db.delete(teamsTable);
  await db.delete(skillsTable);

  const insertedSkills = await db.insert(skillsTable).values(SKILLS).returning();
  console.log(`Inserted ${insertedSkills.length} skills`);

  for (const teamData of TEAMS) {
    const overallLevel = calculateOverallLevel(teamData.skillLevels);
    const [team] = await db
      .insert(teamsTable)
      .values({ name: teamData.name, description: teamData.description, overallLevel })
      .returning();

    await db.insert(teamSkillLevelsTable).values(
      insertedSkills.map((skill, idx) => ({
        teamId: team.id,
        skillId: skill.id,
        level: teamData.skillLevels[idx] ?? 0,
      }))
    );

    console.log(`Created team "${team.name}" with overall level ${overallLevel}`);
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
