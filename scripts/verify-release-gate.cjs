'use strict';

const DEFAULT_BRANCH = process.env.RELEASE_GATE_BRANCH || 'main';
const DEFAULT_ATTEMPTS = Number(process.env.RELEASE_GATE_MAX_ATTEMPTS || 60);
const DEFAULT_POLL_MS = Number(process.env.RELEASE_GATE_POLL_MS || 10_000);
const REQUIRED_WORKFLOWS = [
  { file: 'ci.yml', label: 'CI' },
  { file: 'security.yml', label: 'Security Scan' },
];

const EXIT = {
  OK: 0,
  BLOCKED: 1,
  STALE: 78,
};

function latestExactPushRun(workflowRuns, targetSha) {
  return (workflowRuns || [])
    .filter((run) => run && run.head_sha === targetSha && run.event === 'push')
    .sort((a, b) => {
      const aTime = Date.parse(a.created_at || '') || 0;
      const bTime = Date.parse(b.created_at || '') || 0;
      if (aTime !== bTime) return bTime - aTime;
      return Number(b.run_number || 0) - Number(a.run_number || 0);
    })[0] || null;
}

function evaluateWorkflowRun(run) {
  if (!run) return { state: 'waiting', reason: 'no exact push run yet' };
  if (run.status !== 'completed') {
    return { state: 'waiting', reason: `status=${run.status || 'unknown'}` };
  }
  if (run.conclusion === 'success') {
    return { state: 'success', reason: 'completed successfully' };
  }
  return {
    state: 'failure',
    reason: `completed with conclusion=${run.conclusion || 'unknown'}`,
  };
}

function isCurrentMainTip(targetSha, mainSha) {
  return Boolean(targetSha && mainSha && targetSha === mainSha);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function githubJson(pathname) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  if (!token) throw new Error('GITHUB_TOKEN is required for the production release gate');
  if (!repo) throw new Error('GITHUB_REPOSITORY is required for the production release gate');

  const response = await fetch(`${apiUrl}/repos/${repo}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kfm-delice-release-gate',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status} for ${pathname}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

async function getMainSha() {
  const commit = await githubJson(`/commits/${encodeURIComponent(DEFAULT_BRANCH)}`);
  return commit.sha || '';
}

async function getWorkflowRuns(workflowFile) {
  const query = new URLSearchParams({
    event: 'push',
    branch: DEFAULT_BRANCH,
    per_page: '50',
  });
  const payload = await githubJson(`/actions/workflows/${encodeURIComponent(workflowFile)}/runs?${query}`);
  return payload.workflow_runs || [];
}

async function verifyRelease(targetSha) {
  if (!/^[0-9a-f]{40}$/i.test(targetSha || '')) {
    console.error(`::error::Invalid production target SHA: ${targetSha || '<empty>'}`);
    return EXIT.BLOCKED;
  }

  const mainSha = await getMainSha();
  if (!isCurrentMainTip(targetSha, mainSha)) {
    console.log(`::notice::Skipping stale production release ${targetSha}; current ${DEFAULT_BRANCH} is ${mainSha}.`);
    return EXIT.STALE;
  }

  for (let attempt = 1; attempt <= DEFAULT_ATTEMPTS; attempt += 1) {
    // Re-check main on every poll so a release that becomes stale while waiting
    // for Security Scan can never be deployed afterwards.
    const currentMainSha = await getMainSha();
    if (!isCurrentMainTip(targetSha, currentMainSha)) {
      console.log(`::notice::Skipping release ${targetSha}; ${DEFAULT_BRANCH} advanced to ${currentMainSha} while gates were running.`);
      return EXIT.STALE;
    }

    let waiting = false;
    for (const workflow of REQUIRED_WORKFLOWS) {
      const run = latestExactPushRun(await getWorkflowRuns(workflow.file), targetSha);
      const evaluation = evaluateWorkflowRun(run);

      if (evaluation.state === 'failure') {
        console.error(`::error::Production release blocked: ${workflow.label} ${evaluation.reason} for ${targetSha}.`);
        return EXIT.BLOCKED;
      }
      if (evaluation.state === 'waiting') {
        waiting = true;
        console.log(`Attempt ${attempt}/${DEFAULT_ATTEMPTS}: ${workflow.label} ${evaluation.reason} for ${targetSha}.`);
      } else {
        console.log(`${workflow.label}: green for ${targetSha}.`);
      }
    }

    if (!waiting) {
      console.log(`Production release gate passed for current ${DEFAULT_BRANCH} ${targetSha}: CI + Security Scan are green.`);
      return EXIT.OK;
    }

    if (attempt < DEFAULT_ATTEMPTS) await sleep(DEFAULT_POLL_MS);
  }

  console.error(`::error::Timed out waiting for CI + Security Scan on ${targetSha}.`);
  return EXIT.BLOCKED;
}

async function main() {
  const targetSha = process.argv[2] || '';
  const exitCode = await verifyRelease(targetSha);
  process.exitCode = exitCode;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`::error::Production release gate failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = EXIT.BLOCKED;
  });
}

module.exports = {
  EXIT,
  REQUIRED_WORKFLOWS,
  latestExactPushRun,
  evaluateWorkflowRun,
  isCurrentMainTip,
};
