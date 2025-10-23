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

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="${40 + leaderboard.length * 20}">
      <style>
        .title { font: bold 14px sans-serif; }
        .row { font: 12px sans-serif; }
      </style>
      <text x="10" y="20" class="title">Leaderboard: ${org}</text>`;

    leaderboard.forEach((u, i) => {
      svgContent += `<text x="10" y="${40 + i*20}" class="row">${i+1}. ${u.username} — ${u.commits} commits</text>`;
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
