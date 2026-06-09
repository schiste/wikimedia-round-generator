import { useCallback, useEffect, useState } from 'react';
import { fetchLiveCommonsLogos, readCachedCommonsLogos } from '../services/commonsLogos.js';
import { indexById } from '../utils/collection.js';

function formatSyncTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}

function getLiveLabel(source) {
  return source === 'commons-direct' ? 'Commons direct' : 'Commons live';
}

function liveSyncState(result) {
  return {
    status: 'live',
    label: getLiveLabel(result.source),
    detail: `${result.logos.length} logos refreshed at ${formatSyncTime(result.fetchedAt)}.`
  };
}

function degradedSyncState(hasCache, detail) {
  return {
    status: hasCache ? 'cached' : 'fallback',
    label: hasCache ? 'Commons cache' : 'Bundled fallbacks',
    detail
  };
}

function getInitialSyncState() {
  return degradedSyncState(false, 'Waiting for Commons refresh.');
}

export function useCommonsLogoSync(fallbackLogos) {
  const [remoteLogos, setRemoteLogos] = useState({});
  const [syncState, setSyncState] = useState(getInitialSyncState);

  useEffect(() => {
    const cached = readCachedCommonsLogos(fallbackLogos);
    const hasCache = Boolean(cached?.logos?.length);
    if (hasCache) {
      setRemoteLogos(indexById(cached.logos));
      setSyncState(
        degradedSyncState(
          cached.isFresh,
          cached.isFresh ? `${cached.logos.length} logos cached at ${formatSyncTime(cached.cachedAt)}.` : 'Refreshing Commons logos.'
        )
      );
    }

    const controller = new AbortController();

    fetchLiveCommonsLogos(fallbackLogos, { signal: controller.signal })
      .then((result) => {
        setRemoteLogos(indexById(result.logos));
        setSyncState(liveSyncState(result));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSyncState(
          degradedSyncState(hasCache, hasCache ? `Using cached logos. ${error.message}` : `Commons unavailable. ${error.message}`)
        );
      });

    return () => {
      controller.abort();
    };
  }, [fallbackLogos]);

  const refreshCommons = useCallback(
    async ({ force = false } = {}) => {
      setSyncState((current) => ({
        ...current,
        status: 'syncing',
        label: 'Refreshing Commons',
        detail: 'Resolving latest SVG revisions.'
      }));

      try {
        const result = await fetchLiveCommonsLogos(fallbackLogos, { force });
        setRemoteLogos(indexById(result.logos));
        setSyncState(liveSyncState(result));
      } catch (error) {
        setSyncState((current) => degradedSyncState(Object.keys(remoteLogos).length > 0, error.message || current.detail));
      }
    },
    [fallbackLogos, remoteLogos]
  );

  return {
    remoteLogos,
    syncState,
    refreshCommons
  };
}
