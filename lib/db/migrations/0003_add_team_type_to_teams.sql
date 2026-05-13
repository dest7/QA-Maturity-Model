-- Add team_type column to teams table
-- Types: 'product' (продуктовая), 'platform' (платформенная), 'service' (сервисная)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_type TEXT NOT NULL DEFAULT 'service';

-- Update existing teams based on their names and context
-- Product teams (продуктовые)
UPDATE teams SET team_type = 'product' WHERE name IN (
    'Core API', 'Data Platform', 'Integrations', 'Auth & Security', 'Payments',
    'Web App', 'Design System', 'Mobile Web', 'Analytics UI', 'Admin Panel'
);

-- Platform teams (платформенные)
UPDATE teams SET team_type = 'platform' WHERE name IN (
    'Kubernetes', 'Networking', 'Storage & DB', 'Cost Optimization', 'DR & Backup',
    'CI/CD', 'Internal Tools', 'Developer Portal', 'SDK & Libraries', 'Observability'
);

-- Service teams (сервисные) — QA, Security, Automation
UPDATE teams SET team_type = 'service' WHERE name IN (
    'Automation QA', 'Performance', 'Release Engineering', 'Monitoring', 'Incident Response',
    'AppSec', 'Infra Security', 'Compliance', 'Identity & Access', 'Threat Intelligence'
);
