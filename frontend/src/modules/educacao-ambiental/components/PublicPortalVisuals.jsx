const ICON_PATHS = {
  alert: (
    <>
      <path d="M12 3.5 21 19H3L12 3.5Z" />
      <path d="M12 9v4" />
      <path d="M12 16.5h.01" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5c2.3 0 4.2.45 5.5 1.35V19c-1.3-.9-3.2-1.35-5.5-1.35V5.5Z" />
      <path d="M19.5 5.5c-2.3 0-4.2.45-5.5 1.35V19c1.3-.9 3.2-1.35 5.5-1.35V5.5Z" />
      <path d="M10 6.85h4" />
    </>
  ),
  calendar: (
    <>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" />
      <path d="M7.5 3.5v4" />
      <path d="M16.5 3.5v4" />
      <path d="M3.5 9.5h17" />
      <path d="M8 13h.01" />
      <path d="M12 13h.01" />
      <path d="M16 13h.01" />
    </>
  ),
  check: (
    <>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="m8.5 12.2 2.15 2.15L15.8 9.2" />
    </>
  ),
  clipboard: (
    <>
      <path d="M8.5 4.5h7l.75 2h2.25A1.5 1.5 0 0 1 20 8v10.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V8a1.5 1.5 0 0 1 1.5-1.5h2.25l.75-2Z" />
      <path d="M8 10.5h8" />
      <path d="M8 14h5" />
    </>
  ),
  compass: (
    <>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="m15.5 8.5-2.1 5-4.9 2 2.1-4.9 4.9-2.1Z" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 3.5s5.5 6.1 5.5 10.2A5.5 5.5 0 0 1 6.5 13.7C6.5 9.6 12 3.5 12 3.5Z" />
      <path d="M9.25 14.1c.45 1.45 1.55 2.15 3.05 2.15" />
    </>
  ),
  faq: (
    <>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="M9.75 9.5a2.3 2.3 0 1 1 3.55 1.9c-.85.55-1.3 1.05-1.3 2.1" />
      <path d="M12 16.75h.01" />
    </>
  ),
  file: (
    <>
      <path d="M6.5 3.5h7L18.5 8v12.5h-12v-17Z" />
      <path d="M13.5 3.5V8h5" />
      <path d="M9 12h6" />
      <path d="M9 15.5h4.5" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h5l2 2h7a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-10Z" />
    </>
  ),
  graduation: (
    <>
      <path d="m3.5 9 8.5-4 8.5 4-8.5 4-8.5-4Z" />
      <path d="M7 11v4.5c1.25 1.15 2.9 1.75 5 1.75s3.75-.6 5-1.75V11" />
      <path d="M20.5 9v5.5" />
    </>
  ),
  info: (
    <>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="M12 10.5v5.25" />
      <path d="M12 7.75h.01" />
    </>
  ),
  leaf: (
    <>
      <path d="M20.5 4.5c-6.75.35-12 3.9-12 9.1 0 2.95 2.05 5.05 5.05 5.05 5.15 0 8.05-5.45 6.95-14.15Z" />
      <path d="M4 20c3.7-5.95 8.15-9.05 14-10.25" />
      <path d="M6.75 13.25c-2.25.6-3.35 2.1-3.25 4.4 1.9.15 3.25-.45 4.05-1.8" />
    </>
  ),
  lock: (
    <>
      <path d="M6.5 10h11v9.5h-11V10Z" />
      <path d="M8.75 10V7.8a3.25 3.25 0 0 1 6.5 0V10" />
      <path d="M12 14v2" />
    </>
  ),
  map: (
    <>
      <path d="M8 5.5 3.5 7.25v13L8 18.5l8 3 4.5-1.75v-13L16 8.5l-8-3Z" />
      <path d="M8 5.5v13" />
      <path d="M16 8.5v13" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s6-5.35 6-11a6 6 0 0 0-12 0c0 5.65 6 11 6 11Z" />
      <path d="M12 12.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
    </>
  ),
  route: (
    <>
      <path d="M6 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
      <path d="M18 13.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
      <path d="M8.5 8h3.25A2.25 2.25 0 0 1 14 10.25v.5A2.25 2.25 0 0 1 11.75 13H10a2.5 2.5 0 0 0 0 5h5.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.2c0 4.25-2.75 7.8-7 9.3-4.25-1.5-7-5.05-7-9.3V6l7-2.5Z" />
      <path d="m8.75 12.1 2.15 2.15 4.35-4.5" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 20V9.5" />
      <path d="M12 10c-4.2 0-6.8-2.45-7.5-6.5C8.7 3.5 11.2 5.8 12 10Z" />
      <path d="M12 12.5c4.2 0 6.8-2.45 7.5-6.5-4.2 0-6.7 2.3-7.5 6.5Z" />
    </>
  ),
  target: (
    <>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
      <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </>
  ),
  tree: (
    <>
      <path d="M12 20v-5" />
      <path d="M8.5 15h7L12 4.5 8.5 15Z" />
      <path d="M6.5 18h11" />
    </>
  ),
  waves: (
    <>
      <path d="M3.5 9.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 5 1.5" />
      <path d="M3.5 14c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 5 1.5" />
      <path d="M3.5 18.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 5 1.5" />
    </>
  ),
};

export function PublicIcon({ name = 'leaf', size = 24, title, className = '', strokeWidth = 1.9 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        {ICON_PATHS[name] || ICON_PATHS.leaf}
      </g>
    </svg>
  );
}

export function BrandMark() {
  return (
    <span className="sigma-educacao-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="1.5" width="39" height="39" rx="12" fill="#F4FBF7" stroke="#0F6B3A" strokeWidth="2" />
        <path
          d="M31.6 10.8c-11.6.55-18.4 6.35-18.4 13.6 0 4.15 2.75 7.15 6.95 7.15 7.25 0 12.5-7.85 11.45-20.75Z"
          fill="#0F6B3A"
        />
        <path d="M9.2 32.8C15 22.6 22.4 17.1 30.3 14.4" stroke="#FFFFFF" strokeWidth="2.3" strokeLinecap="round" />
        <path
          d="M11.2 22.5c-3.35.8-5.05 2.95-4.95 6.45 2.75.2 4.85-.8 6.25-2.95"
          fill="#78C39A"
        />
      </svg>
    </span>
  );
}

export function EnvironmentalBackground() {
  return (
    <div className="sigma-educacao-public-background" aria-hidden="true">
      <svg className="sigma-educacao-background-lines" viewBox="0 0 1440 980" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="contourLine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0F6B3A" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#123B55" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d="M-60 210C120 120 240 130 380 225c140 95 265 105 410 12 170-109 340-85 510 42 92 69 168 92 250 71" stroke="url(#contourLine)" strokeWidth="2" fill="none" />
        <path d="M-40 720c180-95 335-92 465 8 126 97 268 104 430 22 198-100 392-74 575 62" stroke="url(#contourLine)" strokeWidth="2" fill="none" />
        <path d="M1040 80c-42 54-38 106 14 154 52-48 56-100 14-154h-28Z" fill="#0F6B3A" opacity="0.055" />
        <path d="M1160 635c-54 68-48 136 18 196 66-60 72-128 18-196h-36Z" fill="#0F6B3A" opacity="0.06" />
        <path d="M40 84c-54 68-48 136 18 196 66-60 72-128 18-196H40Z" fill="#0F6B3A" opacity="0.06" />
        <circle cx="1088" cy="256" r="4" fill="#0F6B3A" opacity="0.12" />
        <circle cx="1138" cy="294" r="3" fill="#123B55" opacity="0.11" />
        <circle cx="1032" cy="318" r="3" fill="#0F6B3A" opacity="0.10" />
        <circle cx="286" cy="812" r="4" fill="#123B55" opacity="0.10" />
      </svg>
    </div>
  );
}

export function EducacaoHeroIllustration() {
  return (
    <svg
      className="sigma-educacao-hero-illustration"
      viewBox="0 0 640 430"
      role="img"
      aria-labelledby="educacaoHeroIllustrationTitle"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="educacaoHeroIllustrationTitle">Paisagem ambiental com relevo, rio, mapa e indicadores de conhecimento municipal</title>
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EAF6FB" />
          <stop offset="56%" stopColor="#F4FBF7" />
          <stop offset="100%" stopColor="#DFF2E9" />
        </linearGradient>
        <linearGradient id="heroRiver" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#B9E8F5" />
          <stop offset="52%" stopColor="#4FA8BC" />
          <stop offset="100%" stopColor="#0F6B3A" />
        </linearGradient>
        <linearGradient id="heroMountainA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9CD5BA" />
          <stop offset="100%" stopColor="#0F6B3A" />
        </linearGradient>
        <linearGradient id="heroMountainB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7CBFA0" />
          <stop offset="100%" stopColor="#064E2E" />
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#0B1B3F" floodOpacity="0.14" />
        </filter>
      </defs>

      <rect x="10" y="12" width="620" height="400" rx="34" fill="url(#heroSky)" />
      <circle cx="174" cy="84" r="50" fill="#FFF4E5" opacity="0.86" />
      <path d="M20 266 148 122 286 276Z" fill="url(#heroMountainA)" opacity="0.74" />
      <path d="M156 278 330 86l216 208Z" fill="url(#heroMountainB)" opacity="0.68" />
      <path d="M334 292 456 138l168 170Z" fill="#2B8558" opacity="0.54" />
      <path d="M28 306c118-52 220-54 302-9 84 46 178 48 288-8v123H28V306Z" fill="#D7EEE1" />
      <path d="M90 416c42-58 92-86 148-84 56 1 104-15 144-49 46-39 94-50 144-34-68 22-122 61-164 118-40 54-108 71-204 51-22-5-45-5-68-2Z" fill="url(#heroRiver)" opacity="0.9" />
      <path d="M38 343c60-24 106-26 138-6 34 20 67 18 100-6 34-24 74-30 120-18" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.55" />

      <g opacity="0.75" stroke="#0B1B3F" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M166 94c12-8 24-8 36 0" />
        <path d="M206 112c9-6 18-6 27 0" />
        <path d="M82 118c8-6 17-6 25 0" />
      </g>

      <g transform="translate(52 258)" fill="#0F6B3A" opacity="0.86">
        <path d="M15 80V38" stroke="#064E2E" strokeWidth="5" strokeLinecap="round" />
        <path d="M15 4 0 42h30L15 4Z" />
        <path d="M74 92V44" stroke="#064E2E" strokeWidth="5" strokeLinecap="round" />
        <path d="M74 0 54 50h40L74 0Z" />
        <path d="M124 84V50" stroke="#064E2E" strokeWidth="5" strokeLinecap="round" />
        <path d="M124 18 108 56h32l-16-38Z" />
      </g>

      <g transform="translate(292 88)" filter="url(#softShadow)">
        <rect x="0" y="0" width="268" height="166" rx="22" fill="rgba(255,255,255,0.72)" stroke="#FFFFFF" strokeWidth="2" />
        <rect x="18" y="18" width="108" height="64" rx="14" fill="rgba(234,246,251,0.82)" stroke="#B7DCCE" />
        <path d="M36 67V45" stroke="#0F6B3A" strokeWidth="7" strokeLinecap="round" />
        <path d="M58 67V32" stroke="#123B55" strokeWidth="7" strokeLinecap="round" />
        <path d="M80 67V51" stroke="#0F6B3A" strokeWidth="7" strokeLinecap="round" />
        <path d="M102 67V38" stroke="#9A4B00" strokeWidth="7" strokeLinecap="round" />
        <rect x="146" y="18" width="100" height="112" rx="14" fill="rgba(244,251,247,0.84)" stroke="#B7DCCE" />
        <path d="M194 30c26 12 38 28 34 48-5 25-30 36-63 42-14-30-9-57 29-90Z" fill="#A9D7BF" />
        <path d="M178 64c21 6 33 20 36 42" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        <path d="M214 76c-16 4-30 11-42 22" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        <circle cx="198" cy="76" r="17" fill="#FFFFFF" opacity="0.88" />
        <path d="M198 96s13-12 13-24a13 13 0 0 0-26 0c0 12 13 24 13 24Z" fill="#0F6B3A" opacity="0.9" />
        <circle cx="198" cy="72" r="4" fill="#FFFFFF" />
        <path d="M20 108h94" stroke="#0B1B3F" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />
        <path d="M20 128h70" stroke="#0B1B3F" strokeOpacity="0.2" strokeWidth="3" strokeLinecap="round" />
      </g>

      <g transform="translate(314 278)">
        <circle cx="30" cy="30" r="29" fill="rgba(255,255,255,0.72)" stroke="#0F6B3A" />
        <path d="M40 18c-18 1-28 10-28 21 16-1 27-10 28-21Z" fill="#0F6B3A" />
        <path d="M16 42c6-10 13-16 22-20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="105" cy="30" r="29" fill="rgba(255,255,255,0.72)" stroke="#0F6B3A" />
        <path d="M105 12s17 19 17 32a17 17 0 0 1-34 0c0-13 17-32 17-32Z" fill="#0F6B3A" opacity="0.9" />
        <circle cx="180" cy="30" r="29" fill="rgba(255,255,255,0.72)" stroke="#0F6B3A" />
        <path d="M180 48V20" stroke="#0F6B3A" strokeWidth="4" strokeLinecap="round" />
        <path d="m164 36 16-22 16 22h-32Z" fill="#0F6B3A" opacity="0.9" />
      </g>

      <g stroke="#0F6B3A" strokeWidth="1.8" strokeDasharray="4 8" opacity="0.46" fill="none">
        <path d="M342 308c34-48 78-52 132-12" />
        <path d="M450 309c40-44 84-45 132-2" />
      </g>
    </svg>
  );
}
