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
