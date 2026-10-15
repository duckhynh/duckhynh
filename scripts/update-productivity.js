const fs = require('fs');

async function updateProductivity() {
  const token = process.env.GITHUB_TOKEN;
  const username = process.env.GH_USERNAME || 'duckhynh';
  const headers = {
    'User-Agent': 'Productivity-Box-Updater',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&type=owner`, { headers });
  const repos = await reposRes.json();
  if (!Array.isArray(repos)) {
    console.error('Could not fetch repositories:', repos);
    return;
  }

  const buckets = { morning: 0, daytime: 0, evening: 0, night: 0 };
  let total = 0;

  for (const r of repos) {
    if (r.fork) continue;
    try {
      const commitsRes = await fetch(`https://api.github.com/repos/${username}/${r.name}/commits?author=${username}&per_page=100`, { headers });
      const commits = await commitsRes.json();
      if (Array.isArray(commits)) {
        for (const c of commits) {
          if (!c.commit || !c.commit.author || !c.commit.author.date) continue;
          const d = new Date(c.commit.author.date);
          const hour = (d.getUTCHours() + 7) % 24; // Asia/Ho_Chi_Minh (UTC+7)
          total++;
          if (hour >= 6 && hour < 12) buckets.morning++;
          else if (hour >= 12 && hour < 18) buckets.daytime++;
          else if (hour >= 18 && hour < 24) buckets.evening++;
          else buckets.night++;
        }
      }
    } catch (e) {
      console.warn(`Skipping repo ${r.name} due to error:`, e.message);
    }
  }

  if (total === 0) {
    console.log('No commits found.');
    return;
  }

  const isNight = (buckets.evening + buckets.night) >= (buckets.morning + buckets.daytime);
  const title = isNight ? "I'm a night 🦉" : "I'm an early 🐣";

  const labels = [
    { name: '🌞 Morning', count: buckets.morning },
    { name: '🌇 Daytime', count: buckets.daytime },
    { name: '🌃 Evening', count: buckets.evening },
    { name: '🌙 Night  ', count: buckets.night }
  ];

  const barLength = 20;
  const lines = [title, ''];
  for (const item of labels) {
    const pct = (item.count / total) * 100;
    const filled = Math.round((pct / 100) * barLength);
    const empty = barLength - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const countStr = String(item.count).padStart(3, ' ') + ' commits';
    const pctStr = pct.toFixed(1).padStart(5, ' ') + ' %';
    lines.push(`${item.name}    ${countStr}    ${bar}    ${pctStr}`);
  }

  const boxContent = '```text\n' + lines.join('\n') + '\n```';

  const readmePath = 'README.md';
  let readme = fs.readFileSync(readmePath, 'utf8');
  const startTag = '<!-- START_SECTION:productivity -->';
  const endTag = '<!-- END_SECTION:productivity -->';

  if (readme.includes(startTag) && readme.includes(endTag)) {
    const pattern = new RegExp(`${startTag}[\\s\\S]*?${endTag}`, 'm');
    readme = readme.replace(pattern, `${startTag}\n${boxContent}\n${endTag}`);
    fs.writeFileSync(readmePath, readme, 'utf8');
    console.log('Productivity section updated successfully!');
  } else {
    console.log('Tags not found in README.md.');
  }
}

updateProductivity().catch(console.error);
