import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from "recharts";

export function MaturityRadar({ skills }: { skills: any[] }) {
  const data = skills.map(s => ({
    subject: s.skillName,
    value: s.level,
    fullMark: 3
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="hsl(var(--border))" strokeDasharray="4 4" />
        <PolarAngleAxis 
          dataKey="subject" 
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }} 
        />
        <PolarRadiusAxis 
          angle={90} 
          domain={[0, 3]} 
          tick={{ fill: 'hsl(var(--foreground))', fontSize: 10, fontWeight: 'bold' }} 
          tickCount={4} 
        />
        <Radar
          name="Maturity Level"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={3}
          fill="hsl(var(--primary))"
          fillOpacity={0.25}
          activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
        />
        <Tooltip
          contentStyle={{ 
            backgroundColor: 'hsl(var(--card))', 
            borderColor: 'hsl(var(--border))', 
            borderRadius: '12px', 
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            padding: '12px'
          }}
          itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
          labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px', fontWeight: 'bold', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '4px' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
