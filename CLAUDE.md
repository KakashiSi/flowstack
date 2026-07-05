# FlowStack — Claude Code Handoff

## Wat is dit project?
FlowStack is een onafhankelijke AI workflow tool review en vergelijkingssite op pflow.org.
Monetisatie: email list (Beehiiv) + betaalde guide ($39, Gumroad/Lemon Squeezy) + affiliate links.

- Live URL: https://pflow.org
- GitHub: https://github.com/KakashiSi/flowstack
- Vercel: via mike@sieng.digital account

## Tech Stack

| Laag | Technologie |
|---|---|
| Hosting | Vercel (static) |
| DNS | Cloudflare (pflow.org) |
| Email list | Beehiiv (morgen configureren) |
| Guide verkoop | Gumroad (nog aanmaken) |
| Notificaties | Resend (re_ZZE2CR5U_...) |
| Indexering | SpeedyIndex |
| Repo | GitHub KakashiSi/flowstack |

## Projectstructuur

```
flowstack/
├── index.html              Homepage + email opt-in
├── guide/index.html        Betaalde guide landingspagina ($39)
├── tools/index.html        Alle tools vergelijkingspagina
├── blog/
│   ├── index.html          Blog overzicht
│   ├── what-is-pflow/
│   ├── best-ai-workflow-tools-2026/
│   ├── reduce-ai-agent-costs/
│   └── free-ai-workflow-tools/
├── vs/
│   ├── pflow-vs-make/
│   ├── pflow-vs-n8n/
│   └── pflow-vs-zapier/
├── api/
│   └── subscribe.js        Beehiiv + Resend email handler
├── llms.txt               AEO targeting
├── sitemap.xml
├── robots.txt
└── vercel.json
```

## Kritieke regels

- Nooit SpeedyIndex, Resend, of Vercel noemen in publieke content
- Footer altijd: "FlowStack is independent. Not affiliated with pflow, Make.com, n8n, or Zapier."
- Nooit pflow.run als eigen merk gebruiken — FlowStack is de sitenaam
- Beehiiv API env vars: BEEHIIV_API_KEY + BEEHIIV_PUB_ID (morgen instellen)
- Gumroad product ID in guide/index.html vervangen zodra aangemaakt

## Vercel env vars die nog ingesteld moeten worden

```
BEEHIIV_API_KEY=<van beehiiv.com dashboard>
BEEHIIV_PUB_ID=<publication ID van beehiiv>
RESEND_API_KEY=re_ZZE2CR5U_seoMfWqFxyWcX95y5cGUr4c4
```

## Dagelijkse Status
**Laatste update: 2026-07-05**

### Vandaag gedaan:
- Site gebouwd: homepage, guide pagina, blog posts, VS pagina's, tools pagina
- API subscribe handler (Beehiiv + Resend) aangemaakt
- GitHub repo aangemaakt + code gepushed
- Vercel deployed op pflow.org
- SpeedyIndex submit gedaan voor alle URLs

### Volgende prioriteiten:
1. Beehiiv account aanmaken + BEEHIIV_API_KEY + BEEHIIV_PUB_ID instellen in Vercel
2. Gumroad product aanmaken ($39) + product ID invullen in guide/index.html
3. Google Search Console: pflow.org toevoegen + sitemap submitten
4. 5 nieuwe blog posts schrijven (meer SEO keywords targeten)

### Bekende issues:
- Email form werkt nog niet (wacht op Beehiiv API keys)
- Guide knop linkt naar placeholder Gumroad URL
