import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 5000;
const GH_HEADERS = {
  headers: {
    "User-Agent": "github-organization-contributions-map",
    Accept: "application/vnd.github+json"
  }
};

const sanitize = (value = "") =>
  String(value).replace(/[&<>"']/g, char => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char] || char;
  });

app.get("/leaderboard-badge", async (req, res) => {
  const org = req.query.org;
  if (!org) return res.status(400).send("Missing org parameter");

  try {
    const reposRes = await fetch(`https://api.github.com/orgs/${org}/repos`, GH_HEADERS);
    if (!reposRes.ok) {
      return res.status(reposRes.status).send("Unable to fetch organization repositories");
    }

    const repos = await reposRes.json();
    if (!Array.isArray(repos)) {
      return res.status(404).send("Organization repositories not found");
    }

    const contributorMap = {};
    let totalCommits = 0;

    for (const repo of repos) {
      const contribRes = await fetch(
        `https://api.github.com/repos/${org}/${repo.name}/contributors`,
        GH_HEADERS
      );

      if (!contribRes.ok) continue;

      const contributors = await contribRes.json();
      if (!Array.isArray(contributors)) continue;

      contributors.forEach(user => {
        if (!contributorMap[user.login]) {
          contributorMap[user.login] = {
            username: user.login,
            commits: 0,
            avatar: user.avatar_url || `https://github.com/${user.login}.png?size=64`
          };
        }

        contributorMap[user.login].commits += user.contributions;
        totalCommits += user.contributions;
      });
    }

    const contributorsList = Object.values(contributorMap);
    if (!contributorsList.length) {
      return res.status(200).send("No contributor data available for this organization.");
    }

    const leaderboard = contributorsList
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 5);

    const totalContributors = contributorsList.length;
    const repoCount = repos.length;
    const width = 560;
    const rowHeight = 76;
    const headerHeight = 110;
    const statsSectionHeight = 88;
    const padding = 28;
    const footerHeight = 36;
    const statsGap = 20;
    const rowsGap = 30;
    const statsY = padding + headerHeight + statsGap;
    const rowsStartY = statsY + statsSectionHeight + rowsGap;
    const height = rowsStartY + leaderboard.length * rowHeight + footerHeight + padding;

    const maxCommits = leaderboard[0]?.commits || 1;
    const medals = [
      { icon: "🥇", accent: "#fbbf24" },
      { icon: "🥈", accent: "#cbd5f5" },
      { icon: "🥉", accent: "#f97316" }
    ];
    const lastUpdated = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    const stats = [
      { label: "Repos scanned", value: repoCount.toLocaleString() },
      { label: "Unique contributors", value: totalContributors.toLocaleString() },
      { label: "Commits analyzed", value: totalCommits.toLocaleString() }
    ];

    let svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Top contributors for ${sanitize(
        org
      )}" style="font-family:'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#020617"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e1b4b"/>
          </linearGradient>
          <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3b82f6"/>
            <stop offset="100%" stop-color="#8b5cf6"/>
          </linearGradient>
          <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3b82f6"/>
            <stop offset="100%" stop-color="#22d3ee"/>
          </linearGradient>
          <pattern id="mesh" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="80" height="80" fill="rgba(255,255,255,0.02)"/>
            <path d="M 0 80 L 80 0" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
          </pattern>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.25"/>
          </filter>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="30" result="blur"/>
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect width="100%" height="100%" rx="24" fill="url(#bgGrad)"/>
        <rect width="100%" height="100%" rx="24" fill="url(#mesh)"/>

        <g opacity="0.25" filter="url(#softGlow)">
          <circle cx="${width - 80}" cy="${headerHeight - 40}" r="80" fill="#3b82f6"/>
          <circle cx="${padding * 2}" cy="${height - padding * 2}" r="70" fill="#a855f7"/>
        </g>

        <g transform="translate(${padding}, ${padding})">
          <rect width="${width - padding * 2}" height="${headerHeight - padding}" rx="18" fill="url(#headerGrad)" opacity="0.16" />
          <text x="12" y="36" font-size="13" fill="#a5b4fc" letter-spacing="2">LEADERBOARD</text>
          <text x="12" y="68" font-size="30" font-weight="700" fill="#f8fafc">${sanitize(org)}</text>
          <text x="12" y="92" font-size="14" fill="#cbd5f5">Top contributors across the organization</text>
        </g>
    `;

    const cardWidth = (width - padding * 2 - 24) / stats.length;

    stats.forEach((stat, index) => {
      const cardX = padding + index * (cardWidth + 12);
      svgContent += `
        <g transform="translate(${cardX}, ${statsY})" filter="url(#shadow)">
          <rect width="${cardWidth}" height="72" rx="14" fill="rgba(15,23,42,0.8)" stroke="rgba(148,163,184,0.2)" />
          <text x="16" y="32" font-size="12" fill="#94a3b8" letter-spacing="1">${stat.label.toUpperCase()}</text>
          <text x="16" y="56" font-size="22" font-weight="700" fill="#e2e8f0">${stat.value}</text>
        </g>
      `;
    });

    leaderboard.forEach((user, index) => {
      const y = rowsStartY + index * rowHeight;
      const barWidth = ((user.commits / maxCommits) * (width - padding * 2 - 140));
      const accent =
        medals[index]?.accent ||
        ["#60a5fa", "#f472b6", "#34d399"][index - medals.length] ||
        "#f472b6";
      const medalIcon = medals[index]?.icon || `#${index + 1}`;
      const contributionShare = totalCommits
        ? (user.commits / totalCommits) * 100
        : 0;

      const avatarClipId = `avatarClip${index}`;

      svgContent += `
        <defs>
          <clipPath id="${avatarClipId}">
            <circle cx="${padding + 52}" cy="${y + 38}" r="26" />
          </clipPath>
        </defs>

        <g transform="translate(0, ${y})" filter="url(#shadow)">
          <rect x="${padding}" y="6" width="${width - padding * 2}" height="${rowHeight - 14}" rx="18" fill="rgba(15,23,42,0.75)" stroke="rgba(148,163,184,0.15)" />
          <rect x="${padding + 116}" y="${rowHeight - 34}" width="${barWidth}" height="10" rx="5" fill="url(#barGrad)" opacity="0.8" />

          <circle cx="${padding + 52}" cy="${rowHeight / 2}" r="32" fill="rgba(15,23,42,0.9)" stroke="rgba(148,163,184,0.3)" stroke-width="1.5" />
          <image href="${user.avatar}" x="${padding + 26}" y="${rowHeight / 2 - 26}" width="52" height="52" clip-path="url(#${avatarClipId})" preserveAspectRatio="xMidYMid slice" />

          <g transform="translate(${padding + 92}, ${rowHeight / 2 - 2})">
            <text font-size="14" font-weight="600" fill="${accent}">
              ${medalIcon}
            </text>
          </g>

          <text x="${padding + 120}" y="${rowHeight / 2}" font-size="16" font-weight="600" fill="#f8fafc">
            ${sanitize(user.username)}
          </text>

          <text x="${padding + 120}" y="${rowHeight / 2 + 22}" font-size="12" fill="#94a3b8">
            ${user.commits.toLocaleString()} commits
          </text>

          <text x="${width - padding - 12}" y="${rowHeight / 2 + 6}" font-size="18" font-weight="700" fill="${accent}" text-anchor="end">
            ${contributionShare.toFixed(1)}%
          </text>
          <text x="${width - padding - 12}" y="${rowHeight / 2 + 26}" font-size="12" fill="#94a3b8" text-anchor="end">
            of total activity
          </text>
        </g>
      `;
    });

    svgContent += `
        <text x="${padding}" y="${height - 20}" font-size="12" fill="#94a3b8">
          Updated ${lastUpdated} • Powered by GitHub REST API
        </text>
      </svg>
    `;

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.send(svgContent);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating leaderboard");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));