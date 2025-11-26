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

const formatDisplayText = (value = "", maxLength = 32) => {
  const safe = sanitize(value);
  return safe.length > maxLength ? `${safe.slice(0, maxLength - 1)}…` : safe;
};

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
    const width = 640;
    const rowHeight = 104;
    const headerHeight = 138;
    const statsCardHeight = 98;
    const statsColumns = 2;
    const statsCardGap = 20;
    const padding = 40;
    const footerHeight = 44;
    const statsGap = 28;
    const rowsGap = 48;

    const maxCommits = leaderboard[0]?.commits || 1;
    const medals = [
      { icon: "🥇", accent: "#f97316" },
      { icon: "🥈", accent: "#38bdf8" },
      { icon: "🥉", accent: "#22d3ee" }
    ];
    const accentCycle = ["#0ea5e9", "#f43f5e", "#14b8a6", "#c084fc", "#f97316"];
    const topShare = totalCommits ? ((leaderboard[0]?.commits || 0) / totalCommits) * 100 : 0;
    const lastUpdated = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    const stats = [
      { label: "Repos scanned", value: repoCount.toLocaleString() },
      { label: "Unique contributors", value: totalContributors.toLocaleString() },
      { label: "Commits analyzed", value: totalCommits.toLocaleString() },
      { label: "Top contributor share", value: `${topShare.toFixed(1)}%` }
    ];

    const statsRows = Math.ceil(stats.length / statsColumns);
    const statsSectionHeight =
      statsRows * statsCardHeight + Math.max(0, statsRows - 1) * statsCardGap;
    const statsY = padding + headerHeight + statsGap;
    const rowsStartY = statsY + statsSectionHeight + rowsGap;
    const height = rowsStartY + leaderboard.length * rowHeight + footerHeight + padding;
    const safeOrg = formatDisplayText(org, 32);

    let svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Top contributors for ${safeOrg}" style="font-family:'Spectral', 'Inter', 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, serif;">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#010409"/>
            <stop offset="40%" stop-color="#04172a"/>
            <stop offset="100%" stop-color="#07182f"/>
          </linearGradient>
          <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0ea5e9"/>
            <stop offset="100%" stop-color="#f43f5e"/>
          </linearGradient>
          <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0ea5e9"/>
            <stop offset="100%" stop-color="#f43f5e"/>
          </linearGradient>
          <radialGradient id="orbGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(244,63,94,0.5)"/>
            <stop offset="100%" stop-color="rgba(14,165,233,0)"/>
          </radialGradient>
          <pattern id="mesh" width="72" height="72" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <rect width="72" height="72" fill="rgba(255,255,255,0.01)"/>
            <path d="M 0 72 L 72 0" stroke="rgba(255,255,255,0.03)" stroke-width="0.5"/>
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

        <g opacity="0.55" filter="url(#softGlow)">
          <circle cx="${width - 120}" cy="${padding + 30}" r="110" fill="url(#orbGrad)"/>
          <circle cx="${padding * 1.2}" cy="${height - padding * 1.1}" r="90" fill="url(#orbGrad)"/>
        </g>

        <g transform="translate(${padding}, ${padding})">
          <rect width="${width - padding * 2}" height="${headerHeight - 30}" rx="26" fill="url(#headerGrad)" opacity="0.22" stroke="rgba(255,255,255,0.12)"/>
          <text x="26" y="40" font-size="12" fill="#a5f3fc" letter-spacing="5">ORGANIZATION</text>
          <text x="26" y="86" font-size="38" font-weight="700" fill="#f8fafc">${safeOrg}</text>
          <text x="26" y="118" font-size="16" fill="#dbeafe">Top contributors across the organization</text>
          <rect x="${width - padding * 2 - 148}" y="30" width="132" height="40" rx="20" fill="rgba(15,23,42,0.6)" stroke="rgba(255,255,255,0.25)"/>
          <text x="${width - padding * 2 - 82}" y="58" font-size="14" font-weight="600" fill="#f1f5f9" text-anchor="middle">Top 5 Badge</text>
        </g>
    `;

    const cardWidth = (width - padding * 2 - (statsColumns - 1) * statsCardGap) / statsColumns;

    stats.forEach((stat, index) => {
      const col = index % statsColumns;
      const row = Math.floor(index / statsColumns);
      const cardX = padding + col * (cardWidth + statsCardGap);
      const cardY = statsY + row * (statsCardHeight + statsCardGap);
      svgContent += `
        <g transform="translate(${cardX}, ${cardY})" filter="url(#shadow)">
          <rect width="${cardWidth}" height="${statsCardHeight}" rx="22" fill="rgba(15,23,42,0.9)" stroke="rgba(148,163,184,0.22)"/>
          <text x="24" y="38" font-size="12" fill="#94a3b8" letter-spacing="2">${stat.label.toUpperCase()}</text>
          <text x="24" y="72" font-size="28" font-weight="700" fill="#f8fafc">${stat.value}</text>
        </g>
      `;
    });

    leaderboard.forEach((user, index) => {
      const rowTop = rowsStartY + index * rowHeight;
      const rowCardWidth = width - padding * 2;
      const percentCardWidth = 170;
      const textStartX = padding + 128;
      const progressX = textStartX;
      const progressMaxWidth = Math.max(
        140,
        rowCardWidth - (textStartX - padding) - percentCardWidth - 48
      );
      const barWidth = Math.max(
        20,
        (user.commits / maxCommits) * progressMaxWidth
      );
      const accent = medals[index]?.accent || accentCycle[index % accentCycle.length];
      const accentTrail = accentCycle[(index + 1) % accentCycle.length];
      const medalIcon = medals[index]?.icon || `#${index + 1}`;
      const contributionShare = totalCommits ? (user.commits / totalCommits) * 100 : 0;
      const usernameDisplay = formatDisplayText(user.username, 22);
      const progressGradId = `progressGrad${index}`;
      const avatarClipId = `avatarClip${index}`;
      const avatarRadius = 34;
      const avatarCenterX = padding + 64;
      const medalLabel =
        index === 0 ? "Most active" : index === 1 ? "Runner up" : index === 2 ? "Key contributor" : "Top contributor";
      const percentCardX = width - padding - percentCardWidth - 18;
      const percentCardY = rowHeight / 2 - 26;

      svgContent += `
        <defs>
          <clipPath id="${avatarClipId}">
            <circle cx="${avatarCenterX}" cy="${rowHeight / 2}" r="${avatarRadius}" />
          </clipPath>
          <linearGradient id="${progressGradId}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="${accentTrail}" stop-opacity="0.75"/>
          </linearGradient>
        </defs>

        <g transform="translate(0, ${rowTop})" filter="url(#shadow)">
          <rect x="${padding}" y="6" width="${rowCardWidth}" height="${rowHeight - 18}" rx="26" fill="rgba(7,13,26,0.95)" stroke="rgba(148,163,184,0.16)"/>

          <circle cx="${avatarCenterX}" cy="${rowHeight / 2}" r="${avatarRadius + 6}" fill="rgba(15,23,42,0.9)" stroke="${accent}" stroke-width="1.4"/>
          <image href="${user.avatar}" x="${avatarCenterX - avatarRadius}" y="${rowHeight / 2 - avatarRadius}" width="${avatarRadius * 2}" height="${avatarRadius * 2}" clip-path="url(#${avatarClipId})" preserveAspectRatio="xMidYMid slice"/>

          <text x="${textStartX}" y="${rowHeight / 2 - 8}" font-size="18" font-weight="600" fill="#f8fafc">
            ${usernameDisplay}
          </text>
          <text x="${textStartX}" y="${rowHeight / 2 + 22}" font-size="13" fill="#cbd5f5">
            ${user.commits.toLocaleString()} commits · ${medalLabel}
          </text>

          <rect x="${progressX}" y="${rowHeight - 36}" width="${progressMaxWidth}" height="14" rx="7" fill="rgba(148,163,184,0.22)"/>
          <rect x="${progressX}" y="${rowHeight - 36}" width="${barWidth}" height="14" rx="7" fill="url(#${progressGradId})" />

          <g transform="translate(${percentCardX}, ${percentCardY})">
            <rect width="${percentCardWidth}" height="58" rx="29" fill="rgba(10,20,38,0.92)" stroke="${accent}" stroke-width="1"/>
            <text x="${percentCardWidth / 2}" y="28" font-size="18" font-weight="700" fill="${accent}" text-anchor="middle">
              ${contributionShare.toFixed(1)}%
            </text>
            <text x="${percentCardWidth / 2}" y="44" font-size="12" fill="#94a3b8" text-anchor="middle">
              ${medalIcon} · ${medalLabel}
            </text>
          </g>
        </g>
      `;
    });

    svgContent += `
        <text x="${padding}" y="${height - 18}" font-size="12" fill="#94a3b8">
          Updated ${lastUpdated} · Powered by GitHub REST API
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