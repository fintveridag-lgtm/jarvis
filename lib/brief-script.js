function n(num) {
  return Number(num || 0).toLocaleString('en-US');
}

// Builds the spoken brief from whatever sections currently have real data.
// Box 3 (client performance) is intentionally never included here.
export function buildBriefSections(data) {
  const sections = [];

  sections.push({ id: 'intro', box: null, text: 'Good morning Sir. Pulling up the data now.' });

  const ig = data.instagram;
  if (ig?.configured && ig.mode === 'full') {
    sections.push({
      id: 'instagram',
      box: 'instagram',
      text: `You reached ${n(ig.reach)} accounts on Instagram over the past seven days, with ${n(
        ig.interactions
      )} interactions and ${n(ig.followers)} followers.`,
    });
  } else if (ig?.configured && ig.mode === 'basic') {
    sections.push({
      id: 'instagram',
      box: 'instagram',
      text: `Your Instagram account has ${n(ig.followers)} followers and ${n(ig.mediaCount)} posts.`,
    });
  }

  const meta = data.metaAds;
  if (meta?.configured && meta.campaigns?.length) {
    const top = meta.campaigns[0];
    sections.push({
      id: 'metaads',
      box: 'metaads',
      text: `Your top campaign, ${top.campaignName}, spent ${n(
        top.spend
      )} dollars and delivered ${n(top.result)} ${top.resultLabel.toLowerCase()}.`,
    });
  }

  const notion = data.notion;
  if (notion?.tasks?.length) {
    sections.push({
      id: 'notion',
      box: 'notion',
      text: `On the schedule for today you have ${notion.tasks.slice(0, 3).join(', ')}.`,
    });
  }

  const ws = data.worldStage;
  if (ws) {
    const parts = [];
    if (ws.headlines?.length) {
      parts.push(`On the world stage, ${ws.headlines[0].title}.`);
    }
    if (ws.markets?.sp500) {
      const m = ws.markets.sp500;
      parts.push(
        `The S&P 500 is ${m.changePercent >= 0 ? 'up' : 'down'} ${Math.abs(m.changePercent).toFixed(
          1
        )} percent.`
      );
    }
    if (parts.length) {
      sections.push({ id: 'worldstage', box: 'worldstage', text: parts.join(' ') });
    }
  }

  const gmail = data.gmail;
  if (gmail?.urgent?.length) {
    const first = gmail.urgent[0];
    sections.push({
      id: 'gmail',
      box: 'gmail',
      text: `The most urgent email is from ${first.from}, regarding ${first.subject}.`,
    });
  }

  sections.push({ id: 'outro', box: null, text: "That's your brief." });

  return sections;
}
