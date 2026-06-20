import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AFFILIATE_LOGOS } from '../data/affiliateLogos.js';
import { fetchCatalogCommonsLogo } from '../services/commonsLogos.js';

const AFFILIATE_BY_ID = new Map(AFFILIATE_LOGOS.map((entry) => [entry.id, entry]));

function removeKey(object, key) {
  const next = { ...object };
  delete next[key];
  return next;
}

export function useAffiliateLogoLibrary(selectedLogoIds) {
  const [affiliateLogos, setAffiliateLogos] = useState([]);
  const [loadingById, setLoadingById] = useState({});
  const [errorById, setErrorById] = useState({});
  const inFlightRef = useRef(new Map());

  const loadedById = useMemo(() => new Map(affiliateLogos.map((logo) => [logo.id, logo])), [affiliateLogos]);
  const loadedRef = useRef(loadedById);
  const errorRef = useRef(errorById);

  useEffect(() => {
    loadedRef.current = loadedById;
  }, [loadedById]);

  useEffect(() => {
    errorRef.current = errorById;
  }, [errorById]);

  const ensureAffiliateLogo = useCallback(async (entry, { signal } = {}) => {
    if (!entry || entry.kind === 'core') return null;

    const loadedLogo = loadedRef.current.get(entry.id);
    if (loadedLogo) return loadedLogo;

    const inFlight = inFlightRef.current.get(entry.id);
    if (inFlight) return inFlight;

    setLoadingById((current) => ({ ...current, [entry.id]: true }));
    setErrorById((current) => {
      const next = removeKey(current, entry.id);
      errorRef.current = next;
      return next;
    });

    const request = fetchCatalogCommonsLogo(entry, { signal })
      .then((logo) => {
        loadedRef.current = new Map(loadedRef.current).set(logo.id, logo);
        setAffiliateLogos((current) => [...current.filter((item) => item.id !== logo.id), logo]);
        return logo;
      })
      .catch((error) => {
        if (signal?.aborted || error.name === 'AbortError') return null;
        setErrorById((current) => {
          const next = { ...current, [entry.id]: error.message || 'Could not load this logo.' };
          errorRef.current = next;
          return next;
        });
        return null;
      })
      .finally(() => {
        inFlightRef.current.delete(entry.id);
        setLoadingById((current) => removeKey(current, entry.id));
      });

    inFlightRef.current.set(entry.id, request);
    return request;
  }, []);

  useEffect(() => {
    const idsToHydrate = selectedLogoIds.filter(
      (id) => AFFILIATE_BY_ID.has(id) && !loadedRef.current.has(id) && !inFlightRef.current.has(id) && !errorRef.current[id]
    );

    if (idsToHydrate.length === 0) return undefined;

    idsToHydrate.forEach((id) => {
      ensureAffiliateLogo(AFFILIATE_BY_ID.get(id));
    });
  }, [ensureAffiliateLogo, selectedLogoIds]);

  return {
    affiliateLogos,
    affiliateLoadingById: loadingById,
    affiliateErrorById: errorById,
    ensureAffiliateLogo
  };
}
