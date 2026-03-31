import { deriveCmuxSidebarSnapshot } from './cmux-sidebar-snapshot.js';

export const BGSD_STATE_KEY = 'bgsd.state';
export const BGSD_CONTEXT_KEY = 'bgsd.context';
export const BGSD_ACTIVITY_KEY = 'bgsd.activity';

async function syncStatusKey(cmuxAdapter, key, value) {
  if (value) {
    await cmuxAdapter.setStatus(key, value);
    return;
  }

  await cmuxAdapter.clearStatus(key);
}

export async function syncCmuxSidebar(cmuxAdapter, projectState) {
  if (!cmuxAdapter || typeof cmuxAdapter.setStatus !== 'function') {
    return null;
  }

  const snapshot = deriveCmuxSidebarSnapshot(projectState);

  await syncStatusKey(cmuxAdapter, BGSD_STATE_KEY, snapshot.status?.label || null);
  await syncStatusKey(
    cmuxAdapter,
    BGSD_CONTEXT_KEY,
    snapshot.context?.trustworthy ? snapshot.context.label || null : null,
  );

  if (snapshot.progress?.mode === 'activity') {
    await syncStatusKey(cmuxAdapter, BGSD_ACTIVITY_KEY, snapshot.progress.label || 'Active');
    await cmuxAdapter.clearProgress();
    return snapshot;
  }

  await syncStatusKey(cmuxAdapter, BGSD_ACTIVITY_KEY, null);

  if (snapshot.progress?.mode === 'exact') {
    await cmuxAdapter.setProgress(snapshot.progress.value, { label: snapshot.progress.label });
    return snapshot;
  }

  await cmuxAdapter.clearProgress();
  return snapshot;
}
