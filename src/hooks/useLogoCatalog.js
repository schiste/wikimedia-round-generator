import { useMemo } from 'react';

export function useLogoCatalog({ fallbackLogos, remoteLogos, customLogos }) {
  const baseLogos = useMemo(
    () =>
      fallbackLogos.map((logo) => ({
        ...logo,
        ...(remoteLogos[logo.id] || {})
      })),
    [fallbackLogos, remoteLogos]
  );

  const allLogos = useMemo(() => [...baseLogos, ...customLogos], [baseLogos, customLogos]);
  const logoById = useMemo(() => new Map(allLogos.map((logo) => [logo.id, logo])), [allLogos]);
  const activeCommonsCount = useMemo(() => baseLogos.filter((logo) => logo.sha1 || logo.sourceUrl).length, [baseLogos]);

  return {
    activeCommonsCount,
    allLogos,
    baseLogos,
    logoById
  };
}
