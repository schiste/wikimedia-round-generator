import React from 'react';

export function LogoGlyph({ logo, className = 'logo-glyph' }) {
  return <div className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo.svg }} />;
}
