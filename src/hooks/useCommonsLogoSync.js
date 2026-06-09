import { useCallback, useEffect, useState } from 'react';
import { fetchLiveCommonsLogos, readCachedCommonsLogos } from '../services/commonsLogos.js';

function getLogoMap(logos) {
  return Object.fromEntries(logos.map((logo) => [logo.id, logo]));
}

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

function getInitialSyncState() {
  return {
    status: 'fallback',
    label: 'Bundled fallbacks',
    detail: 'Waiting for Commons refresh.'
  };
}

export function useCommonsLogoSync(fallbackLogos) {
  const [remoteLogos, setRemoteLogos] = useState({});
  const [syncState, setSyncState] = useState(getInitialSyncState);

  useEffect(() => {
    const cached = readCachedCommonsLogos(fallbackLogos);
    if (cached?.logos?.length) {
      setRemoteLogos(getLogoMap(cached.logos));
      setSyncState({
        status: cached.isFresh ? 'cached' : 'fallback',
        label: cached.isFresh ? 'Commons cache' : 'Bundled fallbacks',
        detail: cached.isFresh ? `${cached.logos.length} logos cached at ${formatSyncTime(cached.cachedAt)}.` : 'Refreshing Commons logos.'
      });
    }

    const controller = new AbortController();

    fetchLiveCommonsLogos(fallbackLogos, { signal: controller.signal })
      .then((result) => {
        setRemoteLogos(getLogoMap(result.logos));
        setSyncState({
          status: 'live',
          label: getLiveLabel(result.source),
          detail: `${result.logos.length} logos refreshed at ${formatSyncTime(result.fetchedAt)}.`
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSyncState({
          status: cached?.logos?.length ? 'cached' : 'fallback',
          label: cached?.logos?.length ? 'Commons cache' : 'Bundled fallbacks',
          detail: cached?.logos?.length ? `Using cached logos. ${error.message}` : `Commons unavailable. ${error.message}`
        });
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
        setRemoteLogos(getLogoMap(result.logos));
        setSyncState({
          status: 'live',
          label: getLiveLabel(result.source),
          detail: `${result.logos.length} logos refreshed at ${formatSyncTime(result.fetchedAt)}.`
        });
      } catch (error) {
        setSyncState((current) => ({
          status: Object.keys(remoteLogos).length ? 'cached' : 'fallback',
          label: Object.keys(remoteLogos).length ? 'Commons cache' : 'Bundled fallbacks',
          detail: error.message || current.detail
        }));
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
