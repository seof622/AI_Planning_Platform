import type { CSSProperties } from "react";

export function RoadmapWorkshop() {
  return <svg className="roadmap-workshop" viewBox="0 0 900 300" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="roadmap-workshop-belt" x1="450" y1="112" x2="450" y2="247" gradientUnits="userSpaceOnUse">
        <stop stopColor="#21494b" /><stop offset="1" stopColor="#14313b" />
      </linearGradient>
      <linearGradient id="roadmap-workshop-paper" x1="0" y1="-92" x2="0" y2="4" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fffce7" /><stop offset="1" stopColor="#deebcf" />
      </linearGradient>
    </defs>
    <ellipse cx="450" cy="242" rx="348" ry="31" fill="#327567" fillOpacity="0.07" />
    <path d="m104 185 94-49h568l32 18v43l-94 49H136l-32-18Z" fill="#17373d" stroke="#598b82" />
    <path d="m104 185 94-49h568l32 18-94 49H136Z" fill="url(#roadmap-workshop-belt)" stroke="#6c9f8b" />
    <path className="roadmap-workshop__belt" d="M168 174H735" stroke="#8bc9a9" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 17" />
    <path d="M140 217h550m21-4 68-35" stroke="#80ba9b" strokeOpacity="0.5" />
    {[180, 230, 280, 330, 380, 430, 480, 530, 580, 630, 680].map((x) => <circle key={x} cx={x} cy="226" r="3" fill="#517e71" />)}
    <g className="roadmap-workshop__route" stroke="#b8df9c" strokeWidth="2" strokeLinecap="round">
      <path pathLength="1" d="M270 172h95m90 0h95m90 0h75" />
    </g>
    {[0, 1, 2].map((index) => <g key={index} transform={`translate(${index * 185 + 262} 165)`}>
      <ellipse cy="15" rx="65" ry="14" fill="#020f14" fillOpacity="0.18" />
      <g className={`roadmap-workshop__card roadmap-workshop__card--${index}`}>
        <rect x="-54" y="-95" width="112" height="102" rx="10" fill="#a6bba0" />
        <rect x="-58" y="-100" width="112" height="102" rx="10" fill="url(#roadmap-workshop-paper)" stroke="#f9ffed" strokeWidth="1.5" />
        <rect x="-44" y="-84" width="25" height="24" rx="6" fill="#4b806c" />
        <text x="-31.5" y="-68" textAnchor="middle" fill="#f0ffe7" fontSize="11" fontWeight="600">0{index + 1}</text>
        <path d="M-7-76h40M-7-66h27M-42-42h78M-42-30h59M-42-18h43" stroke="#a9bea0" strokeWidth="4" strokeLinecap="round" />
        <g className={`roadmap-workshop__stamp roadmap-workshop__stamp--${index}`}>
          <circle cx="36" cy="-86" r="11" fill="#a4d59c" stroke="#6e9f73" />
          <path d="m31-86 3 3 7-7" stroke="#3d7453" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      <text y="68" textAnchor="middle" fill="#6c8a74" fontSize="11" letterSpacing="1">{["작업 정리", "순서 연결", "단계 구성"][index]}</text>
    </g>)}
    <g className="roadmap-workshop__press">
      <g transform="translate(262 38)">
        <path d="M0-24v18" stroke="#83b69a" strokeWidth="4" />
        <path d="m-17-8 17-9 17 9L0 1Z" fill="#d1f0cd" stroke="#689d85" />
        <path d="M-17-8v16L0 17 17 8V-8L0 1Z" fill="#5a9b82" stroke="#9dd3ad" />
        <path d="m-10 12 10 5 10-5" stroke="#e3ffc7" strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
    <g transform="translate(136 122)">
      <path d="m-19 10 19 11 19-11v25L0 46l-19-11Z" fill="#44867b" stroke="#82bba1" />
      <rect x="-23" y="-26" width="46" height="38" rx="12" fill="#c7e9ce" stroke="#81b799" />
      <rect x="-17" y="-18" width="34" height="23" rx="7" fill="#1e494a" />
      <g className="design-workshop__eyes" fill="#a9efbb"><ellipse cx="-7" cy="-7" rx="2.5" ry="4" /><ellipse cx="7" cy="-7" rx="2.5" ry="4" /></g>
      <path d="M0-27v-9" stroke="#65a28b" strokeWidth="2" /><circle className="design-workshop__signal" cy="-40" r="3" fill="#70b88d" />
      <g className="roadmap-workshop__arm"><path d="m18 22 15-11 10 5" stroke="#83b99f" strokeWidth="5" strokeLinecap="round" /><rect x="38" y="10" width="16" height="23" rx="3" fill="#e5edcc" stroke="#7da78a" /><path d="M43 17h6m-6 6h4" stroke="#7da78a" strokeWidth="2" /></g>
    </g>
  </svg>;
}

export function DesignWorkshop() {
  return <svg className="design-workshop" viewBox="0 0 900 500" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="workshop-table" x1="450" y1="94" x2="450" y2="426" gradientUnits="userSpaceOnUse">
        <stop stopColor="#183c43" /><stop offset="1" stopColor="#112b35" />
      </linearGradient>
      <linearGradient id="workshop-beam" x1="0" y1="-95" x2="0" y2="10" gradientUnits="userSpaceOnUse">
        <stop stopColor="#a9fbd2" stopOpacity="0.65" /><stop offset="1" stopColor="#a9fbd2" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="workshop-glow"><stop stopColor="#6dd3b0" stopOpacity="0.2" /><stop offset="1" stopColor="#6dd3b0" stopOpacity="0" /></radialGradient>
      <pattern id="workshop-grid" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="matrix(1 .5 -1 .5 450 80)">
        <path d="M40 0H0V40" stroke="#39716f" strokeOpacity="0.3" strokeWidth="1" />
      </pattern>
    </defs>
    <ellipse cx="450" cy="397" rx="350" ry="82" fill="url(#workshop-glow)" />
    <g className="design-workshop__platform">
      <path d="m154 280 28 15v95l-28-15Zm564 15 28-15v95l-28 15Z" fill="#132b34" stroke="#28505a" />
      <path d="m435 414 30 0v55l-15 8-15-8Z" fill="#142e37" stroke="#28505a" />
      <path d="m110 252 340 174 340-174v20L450 447 110 272Z" fill="#15333c" stroke="#39616a" />
      <path d="m110 252 340-174 340 174-340 174Z" fill="url(#workshop-table)" stroke="#568d8a" />
      <path d="m110 252 340-174 340 174-340 174Z" fill="url(#workshop-grid)" />
      <path d="m130 274 320 164 320-164" stroke="#73dcb4" strokeOpacity="0.65" strokeWidth="2" />
      <path d="m137 252 313-160 313 160-313 160Z" stroke="#6bb69d" strokeOpacity="0.28" strokeDasharray="4 8" />
      <g stroke="#8cceb8" strokeWidth="2"><path d="m157 249 35-18m-35 18 35 18M708 231l35 18-35 18M427 113l23-12 23 12M427 389l23 12 23-12" /></g>
    </g>
    <g className="design-workshop__blueprint">
      <path d="m307 240 143-74 142 74-142 74Z" fill="#79efbc" fillOpacity="0.035" stroke="#75d4b7" strokeOpacity="0.35" strokeDasharray="5 7" />
      <g className="design-workshop__connections" stroke="#9af5cc" strokeWidth="2" strokeLinecap="round">
        <path pathLength="1" d="m353 221 96-49 103 52" />
        <path pathLength="1" d="m353 236 97 50 102-50" />
        <path pathLength="1" d="M450 192v75" />
      </g>
      {[
        { x: 450, y: 166, order: 0, label: "01" },
        { x: 337, y: 228, order: 1, label: "02" },
        { x: 563, y: 228, order: 2, label: "03" },
        { x: 450, y: 288, order: 3, label: "04" },
      ].map(({ x, y, order, label }) => <g key={label} transform={`translate(${x} ${y})`}>
        <ellipse cy="10" rx="43" ry="21" fill="#70e2b0" fillOpacity="0.09" />
        <g className={`design-workshop__module design-workshop__module--${order}`}>
          <path d="m-37-18 37 19 37-19v36L0 37-37 18Z" fill="#2b6b67" stroke="#79c6ad" />
          <path d="M0 1v36l37-19v-36Z" fill="#24565d" stroke="#79c6ad" />
          <path d="m-37-18 37-19 37 19L0 1Z" fill="#b2f0d1" stroke="#d0ffe7" />
          <path d="m-22-18 22-11 22 11L0-7Z" fill="#7bc7ac" />
          <path d="m-24 6 15 8m-15 1 10 5" stroke="#8fe1ba" strokeWidth="2" strokeLinecap="round" />
          <text x="13" y="18" fill="#b2f0d1" fontSize="10" transform="skewY(-27)">{label}</text>
          <path className="design-workshop__module-spark" d="M0-58v-9m-12 17-6-6m30 6 6-6" stroke="#d5ffe3" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>)}
    </g>
    <g transform="translate(248 218)">
      <ellipse cy="49" rx="42" ry="17" fill="#040d13" fillOpacity="0.4" />
      <g className="design-workshop__robot">
        <path d="M-22 0h44l7 34-29 16-29-16Z" fill="#377976" stroke="#9bd7c1" />
        <path d="m-29 34 29 16 29-16M0 17v33" stroke="#90c9b2" strokeOpacity="0.65" />
        <path d="M-30-26Q0-43 30-26v34Q0 25-30 8Z" fill="#d3f3e1" stroke="#e3fff0" strokeWidth="2" />
        <path d="M-23-18Q0-29 23-18V2Q0 16-23 2Z" fill="#173d45" />
        <g className="design-workshop__eyes" fill="#9ef5c8"><ellipse cx="-10" cy="-7" rx="3" ry="5" /><ellipse cx="10" cy="-7" rx="3" ry="5" /></g>
        <path d="M0-35v-13" stroke="#a7edca" strokeWidth="2" /><circle className="design-workshop__signal" cy="-51" r="4" fill="#b9ffce" />
        <path d="m-29 18-12 10m70-10 14-8" stroke="#98d6b9" strokeWidth="7" strokeLinecap="round" />
        <path d="m43 10 14-13" stroke="#dcffe8" strokeWidth="4" strokeLinecap="round" />
        <circle cx="58" cy="-5" r="5" fill="#b2f9ce" />
      </g>
    </g>
    <g className="design-workshop__plotter">
      <g transform="translate(450 160)">
        <path d="M-5-94 0-8 5-94Z" fill="url(#workshop-beam)" />
        <ellipse rx="16" ry="8" stroke="#baffdd" strokeWidth="1.5" />
        <path d="M-24 0h12m24 0h12M0-14v7m0 14v7" stroke="#baffdd" strokeOpacity="0.6" />
        <path d="m-13-102 13-7 13 7L0-95Z" fill="#e4ffec" />
        <path d="M-13-102v9l13 7 13-7v-9L0-95Z" fill="#6bba9a" stroke="#c1ffdc" />
      </g>
    </g>
    <g className="design-workshop__particles" fill="#b4fcd5">
      {[{ x: 356, y: 127 }, { x: 578, y: 147 }, { x: 632, y: 259 }, { x: 385, y: 331 }].map(({ x, y }, index) =>
        <circle key={x} cx={x} cy={y} r="2" style={{ "--particle-delay": `${index * -0.8}s` } as CSSProperties} />)}
    </g>
    <g fill="#6fa99d" fontFamily="monospace" fontSize="9" letterSpacing="2">
      <text x="138" y="354" transform="rotate(27 138 354)">PLAN NOTE / DESIGN LAB</text>
      <text x="620" y="342" transform="rotate(-27 620 342)">IDEA → STRUCTURE</text>
    </g>
  </svg>;
}
