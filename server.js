import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 5000;

app.get("/leaderboard-badge", async (req, res) => {
  const org = req.query.org;
  if (!org) return res.status(400).send("Missing org parameter");

  try {
    const reposRes = await fetch(`https://api.github.com/orgs/${org}/repos`);
    const repos = await reposRes.json();

    const contributorMap = {};

    for (const repo of repos) {
      const contribRes = await fetch(`https://api.github.com/repos/${org}/${repo.name}/contributors`);
      const contributors = await contribRes.json();
      if (!Array.isArray(contributors)) continue;

      contributors.forEach(u => {
        contributorMap[u.login] = (contributorMap[u.login] || 0) + u.contributions;
      });
    }

    const leaderboard = Object.entries(contributorMap)
      .map(([username, commits]) => ({ username, commits }))
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 5);

    const width = 480;
    const rowHeight = 52;
    const headerHeight = 80;
    const padding = 24;
    const height = headerHeight + leaderboard.length * rowHeight + padding * 2;

    const maxCommits = leaderboard[0]?.commits || 1;
    const medals = ['🥇', '🥈', '🥉'];

    let svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="font-family:'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.3"/>
          </filter>
        </defs>
        
        <rect width="100%" height="100%" rx="16" fill="url(#bgGrad)"/>
        
        <rect x="0" y="0" width="100%" height="${headerHeight}" rx="16" fill="url(#headerGrad)" opacity="0.15"/>
        
        <text x="${width / 2}" y="36" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">
          ${org}
        </text>
        <text x="${width / 2}" y="58" font-size="13" font-weight="500" fill="#94a3b8" text-anchor="middle" letter-spacing="1">
          TOP CONTRIBUTORS
        </text>
      `;

    leaderboard.forEach((u, i) => {
      const y = headerHeight + padding + i * rowHeight;
      const barWidth = ((u.commits / maxCommits) * (width - 180));
      const isTop3 = i < 3;
      
      const rowBg = isTop3 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(30, 41, 59, 0.4)';
      const barColor = isTop3 
        ? `rgba(${i === 0 ? '251, 191, 36' : i === 1 ? '168, 85, 247' : '59, 130, 246'}, 0.3)`
        : 'rgba(71, 85, 105, 0.3)';
      const barStroke = isTop3
        ? `rgb(${i === 0 ? '251, 191, 36' : i === 1 ? '168, 85, 247' : '59, 130, 246'})`
        : 'rgb(100, 116, 139)';

      svgContent += `
        <g filter="url(#shadow)">
          <rect x="${padding}" y="${y}" width="${width - padding * 2}" height="44" rx="8" fill="${rowBg}" stroke="rgba(148, 163, 184, 0.1)" stroke-width="1"/>
        </g>
        
        <rect x="${padding + 4}" y="${y + 4}" width="${barWidth}" height="36" rx="6" fill="${barColor}" stroke="${barStroke}" stroke-width="1.5" opacity="0.8"/>
        
        <text x="${padding + 16}" y="${y + 27}" font-size="16" font-weight="600" fill="#ffffff">
          ${isTop3 ? medals[i] : `#${i + 1}`}
        </text>
        
        <text x={padding + ${isTop3 ? 48 : 42}} y={y + 27} font-size="14" font-weight="500" fill="#e2e8f0">
          ${u.username}
        </text>
        
        <text x="${width - padding - 16}" y="${y + 27}" font-size="14" font-weight="700" fill="${isTop3 ? (i === 0 ? '#fbbf24' : i === 1 ? '#a855f7' : '#3b82f6') : '#64748b'}" text-anchor="end">
          ${u.commits.toLocaleString()}
        </text>
      `;
    });

    svgContent += `</svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(svgContent);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating leaderboard");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));