// api/build.js — Vercel Serverless Function
// POST /api/build  → trigger GitHub Actions workflow
// GET  /api/build?id=xxx → check status

const { v4: uuidv4 } = require('uuid');

const GH_TOKEN  = process.env.GH_TOKEN;        // GitHub PAT
const GH_OWNER  = process.env.GH_OWNER;        // your GitHub username
const GH_REPO   = process.env.GH_REPO;         // your repo name

// ── POST: Start build ────────────────────────────────────────────────────────
async function handlePost(req, res) {
  const body = req.body;

  // Validate
  if (!body.appName) return res.status(400).json({ error: 'appName required' });
  if (!GH_TOKEN)     return res.status(500).json({ error: 'GH_TOKEN not set in Vercel env vars' });

  const buildId    = uuidv4().replace(/-/g,'').slice(0,12);
  const appName    = body.appName.trim();
  const pkgName    = (body.packageName || ('com.webviewapp.' + appName.toLowerCase().replace(/[^a-z0-9]/g,''))).replace(/[^a-z0-9.]/g,'');
  const version    = body.version     || '1.0.0';
  const versionCode= String(body.versionCode || 1);
  const targetSdk  = String(body.targetSdk   || 34);
  const minSdk     = String(body.minSdk      || 24);
  const sourceType = body.sourceType === 'file' ? 'file' : 'url';
  const webUrl     = body.webUrl      || '';
  const entryPoint = body.entryPoint  || 'index.html';
  const orientation= body.orientation || 'unspecified';
  const iconUrl    = body.iconUrl     || '';
  const siteZipUrl = body.siteZipUrl  || '';

  if (sourceType === 'url' && !webUrl.startsWith('http'))
    return res.status(400).json({ error: 'webUrl must start with http/https' });

  // Trigger GitHub Actions workflow_dispatch
  const triggerUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/build-apk.yml/dispatches`;

  const ghRes = await fetch(triggerUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        app_name:    appName,
        package_name: pkgName,
        version,
        version_code: versionCode,
        target_sdk:  targetSdk,
        min_sdk:     minSdk,
        source_type: sourceType,
        web_url:     webUrl,
        entry_point: entryPoint,
        orientation,
        build_id:    buildId,
        icon_url:    iconUrl,
        site_zip_url: siteZipUrl,
      },
    }),
  });

  if (!ghRes.ok) {
    const err = await ghRes.text();
    console.error('GitHub trigger failed:', err);
    return res.status(500).json({ error: 'Failed to trigger build: ' + err });
  }

  // Wait 3s then get the run ID
  await sleep(3000);
  const runId = await getLatestRunId(buildId);

  return res.json({ buildId, runId, owner: GH_OWNER, repo: GH_REPO });
}

// ── GET: Check build status ──────────────────────────────────────────────────
async function handleGet(req, res) {
  const { runId, buildId } = req.query;

  if (!runId) return res.status(400).json({ error: 'runId required' });

  const runUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${runId}`;
  const ghRes  = await fetch(runUrl, {
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!ghRes.ok) return res.status(500).json({ error: 'Failed to fetch run status' });

  const run = await ghRes.json();
  const status   = run.status;   // queued, in_progress, completed
  const conclusion = run.conclusion; // success, failure, null

  // Map to our progress %
  const progressMap = { queued: 5, in_progress: 50, completed: 100 };
  const progress = progressMap[status] || 0;

  let downloadUrl = null;
  if (status === 'completed' && conclusion === 'success') {
    downloadUrl = `/api/download?runId=${runId}&buildId=${buildId}`;
  }

  return res.json({
    status,
    conclusion,
    progress,
    downloadUrl,
    ghRunUrl: run.html_url,
  });
}

// ── GET /api/download → proxy artifact download ──────────────────────────────
async function handleDownload(req, res) {
  const { runId, buildId } = req.query;

  // List artifacts for this run
  const artUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${runId}/artifacts`;
  const artRes = await fetch(artUrl, {
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const artData = await artRes.json();
  const artifact = artData.artifacts?.find(a => a.name.startsWith('apk-'));

  if (!artifact) return res.status(404).json({ error: 'APK artifact not found yet' });

  // GitHub artifact download requires redirect
  const dlRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/artifacts/${artifact.id}/zip`, {
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'manual',
  });

  // GitHub returns 302 redirect to actual download URL
  const location = dlRes.headers.get('location');
  if (location) {
    return res.redirect(302, location);
  }

  return res.status(500).json({ error: 'Could not get download URL' });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getLatestRunId(buildId) {
  try {
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs?per_page=5&event=workflow_dispatch`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const data = await res.json();
    return data.workflow_runs?.[0]?.id || null;
  } catch {
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST')                        return await handlePost(req, res);
    if (req.method === 'GET' && req.query.download)   return await handleDownload(req, res);
    if (req.method === 'GET')                         return await handleGet(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
