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

    const width = 400;
    const rowHeight = 40;
    const height = 60 + leaderboard.length * rowHeight;

    let svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="font-family:Arial, sans-serif;">
        <rect width="100%" height="100%" rx="10" ry="10" fill="#1E1E2F"/>
        <text x="20" y="35" font-size="18" font-weight="bold" fill="#FFD700">Leaderboard: ${org}</text>
      `;

    leaderboard.forEach((u, i) => {
      const y = 70 + i * rowHeight;
      svgContent += `
        <rect x="20" y="${y - 25}" width="${width - 40}" height="30" rx="5" ry="5" fill="#2E2E4D"/>
        <text x="30" y="${y - 5}" font-size="14" fill="#FFFFFF">${i + 1}. ${u.username}</text>
        <text x="${width - 80}" y="${y - 5}" font-size="14" fill="#FFD700">${u.commits} commits</text>
      `;
    });

    svgContent += `</svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svgContent);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating leaderboard");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
