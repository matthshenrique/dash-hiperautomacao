import { CLIENT } from "../../config/client";

export const CLIENT_NAME = CLIENT.nome;

// ---- Accent (por cliente, vindo do config) ----
const accentBase = CLIENT.tema.corPrimaria; // hex vindo do .env (DASH_COLOR)

function hexToRgb(h: string) {
  const s = h.replace("#", "");
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}
function mix(hex: string, target: number, amt: number) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => Math.round(c + (target - c) * amt);
  return `#${[f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
export const ACCENT = {
  light: accentBase,
  dark: mix(accentBase, 255, 0.42), // clareia p/ contraste no escuro
};

// Azul sequencial (ordinal) do dataviz — usado no funil (etapas ordenadas)
export const SEQ_BLUE = [
  "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab",
];

export type Mode = "light" | "dark";

export function initMode(): Mode {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyMode(mode: Mode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.setProperty("--accent", ACCENT[mode]);
  root.style.setProperty(
    "--accent-soft",
    mix(ACCENT[mode], mode === "dark" ? 26 : 250, 0.86),
  );
  localStorage.setItem("theme", mode);
}

export const globalCss = `
:root{
  --page:#f5f5f2; --card:#ffffff; --card-2:#fbfbfa;
  --ink:#0b0b0b; --ink2:#52514e; --muted:#8a8984;
  --grid:#e6e5df; --border:rgba(11,11,11,.10); --track:#edece8;
  --good:#0f8a0f; --warn:#b7791f; --crit:#c9342f; --blue:#2a78d6;
  --shadow:0 1px 2px rgba(11,11,11,.04), 0 8px 24px rgba(11,11,11,.06);
  --accent:${ACCENT.light}; --accent-soft:${mix(ACCENT.light, 250, 0.86)};
}
:root[data-theme="dark"]{
  --page:#0c0c0d; --card:#161617; --card-2:#1c1c1d;
  --ink:#ffffff; --ink2:#c3c2b7; --muted:#8a8984;
  --grid:#2b2b2a; --border:rgba(255,255,255,.10); --track:#26262a;
  --good:#25b325; --warn:#e0a92b; --crit:#e26363; --blue:#3987e5;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.5);
  --accent:${ACCENT.dark}; --accent-soft:${mix(ACCENT.dark, 26, 0.86)};
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;overflow-x:hidden}
body{
  background:var(--page); color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
  -webkit-font-smoothing:antialiased;
  transition:background .25s ease,color .25s ease;
}
.tnum{font-variant-numeric:tabular-nums}
.app{max-width:1400px;margin:0 auto;padding:20px 24px 64px}
@media(max-width:560px){.app{padding:14px 14px 48px}}

.topbar{
  position:sticky;top:0;z-index:20;display:flex;align-items:center;
  justify-content:space-between;gap:16px;flex-wrap:wrap;
  padding:14px 0 16px;margin-bottom:4px;
  background:linear-gradient(var(--page),var(--page) 72%,transparent);
}
.brand{display:flex;align-items:center;gap:12px}
.brand-badge{
  width:38px;height:38px;border-radius:11px;flex:0 0 auto;
  background:var(--accent);color:#fff;display:grid;place-items:center;
  font-weight:800;font-size:16px;box-shadow:var(--shadow);
}
.brand h1{font-size:19px;font-weight:700;margin:0;letter-spacing:-.01em}
.brand .sub{font-size:12px;color:var(--muted);margin-top:1px}
.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}

.btn{
  display:inline-flex;align-items:center;gap:8px;cursor:pointer;
  background:var(--card);color:var(--ink);border:1px solid var(--border);
  border-radius:10px;padding:8px 12px;font-size:13px;font-weight:500;
  transition:background .15s,border-color .15s,transform .05s;
}
.btn:hover{border-color:var(--accent);background:var(--card-2)}
.btn:active{transform:translateY(1px)}
.btn.icon{padding:0;width:38px;height:38px;justify-content:center}
.btn.primary{background:var(--accent);color:#fff;border-color:transparent}
.btn.primary:hover{filter:brightness(1.06)}

.dr{position:relative}
.dr-menu{
  position:absolute;right:0;top:calc(100% + 8px);z-index:40;width:290px;
  max-width:calc(100vw - 24px);
  background:var(--card);border:1px solid var(--border);border-radius:14px;
  box-shadow:var(--shadow);overflow:hidden;
}
/* Ancorada no botão, um menu de 290px pode nascer fora da tela em telas
   pequenas (o botão raramente fica encostado na borda direita). Abaixo de
   560px vira um sheet fixo, centralizado na viewport, sem depender da
   posição do botão. */
@media(max-width:560px){
  .dr-menu{
    position:fixed;top:auto;bottom:16px;left:12px;right:12px;
    width:auto;max-width:none;max-height:calc(100vh - 32px);overflow-y:auto;
  }
}
.dr-preset{
  display:flex;align-items:center;justify-content:space-between;width:100%;
  background:none;border:0;cursor:pointer;color:var(--ink);
  padding:10px 14px;font-size:13.5px;text-align:left;
}
.dr-preset:hover{background:var(--accent-soft)}
.dr-preset .chk{color:var(--accent);font-weight:800;font-size:16px;visibility:hidden}
.dr-preset[aria-selected="true"]{font-weight:600}
.dr-preset[aria-selected="true"] .chk{visibility:visible}
.dr-custom{border-top:1px solid var(--border);padding:12px 14px;display:grid;gap:8px}
.dr-custom label{font-size:11px;color:var(--muted);display:block;margin-bottom:3px}
.dr-custom input{
  width:100%;background:var(--card-2);color:var(--ink);
  border:1px solid var(--border);border-radius:8px;padding:7px 9px;font-size:13px;
  color-scheme:light dark;
}
.backdrop{position:fixed;inset:0;z-index:30}

.status-menu{width:280px;max-width:calc(100vw - 24px)}
@media(max-width:560px){
  .status-menu{
    position:fixed;top:auto;bottom:16px;left:12px;right:12px;
    width:auto;max-width:none;max-height:calc(100vh - 32px);overflow-y:auto;
  }
}
.status-head{font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--muted);
  text-transform:uppercase;padding:12px 14px 8px}
.status-row{padding:10px 14px;border-top:1px solid var(--border)}
.status-row-head{display:flex;align-items:center;gap:8px;font-size:13px}
.status-detail{font-size:12px;color:var(--ink2);margin-top:4px;padding-left:16px}
.status-err{color:var(--crit);margin-top:2px;font-size:11.5px;line-height:1.4}

.grid{display:grid;gap:14px}
.kpis{grid-template-columns:repeat(auto-fill,minmax(178px,1fr))}
.cols-2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
@media(max-width:860px){.cols-2{grid-template-columns:minmax(0,1fr)}}
.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
@media(max-width:560px){.cols-3{grid-template-columns:minmax(0,1fr)}}
.card{
  background:var(--card);border:1px solid var(--border);border-radius:16px;
  padding:18px;box-shadow:var(--shadow);
  /* item de grid não deve crescer além da própria coluna por causa de
     conteúdo comprido (nome de anúncio, valor grande) — sem isso, o item
     força a coluna/linha a alargar e a página ganha scroll horizontal. */
  min-width:0;
}
@media(max-width:480px){
  .card{padding:14px}
  .stat .value{font-size:19px}
  .kpis{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
}
.card h3{margin:0 0 14px;font-size:14px;font-weight:650;letter-spacing:-.01em;
  display:flex;align-items:center;gap:6px}
.section-title{font-size:12px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted);margin:30px 2px 12px}

.stat .label{font-size:11.5px;color:var(--muted);font-weight:600;
  letter-spacing:.04em;text-transform:uppercase;
  display:flex;align-items:center;gap:5px}

.info{position:relative;display:inline-flex;cursor:help;color:var(--muted)}
.info .tip{
  position:absolute;bottom:calc(100% + 8px);left:0;transform:translateX(-8px);
  background:#1c1c1e;color:#fff;font-size:11.5px;font-weight:500;
  text-transform:none;letter-spacing:normal;padding:8px 10px;border-radius:8px;
  width:200px;max-width:calc(100vw - 40px);line-height:1.4;box-shadow:var(--shadow);
  opacity:0;visibility:hidden;transition:opacity .12s ease;pointer-events:none;z-index:50;
}
.info .tip::after{
  content:"";position:absolute;top:100%;left:14px;
  border:5px solid transparent;border-top-color:#1c1c1e;
}
.info:hover .tip,.info:focus .tip,.info:focus-visible .tip{opacity:1;visibility:visible}
.stat .value{font-size:27px;font-weight:750;letter-spacing:-.02em;margin-top:7px;
  line-height:1.15;overflow-wrap:anywhere}
.stat .foot{font-size:12px;color:var(--ink2);margin-top:8px;display:flex;align-items:center;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.stat.accent{position:relative;overflow:hidden}
.stat.accent::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent)}

.prog{height:7px;border-radius:99px;background:var(--track);overflow:hidden;margin-top:10px}
.prog>span{display:block;height:100%;border-radius:99px;background:var(--accent);transition:width .5s ease}

.barlist{display:flex;flex-direction:column;gap:11px;min-width:0}
.barrow{display:grid;grid-template-columns:130px minmax(0,1fr) auto;align-items:center;gap:12px}
.barrow .k{font-size:13px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.barrow .v{font-size:13px;font-weight:650;text-align:right;min-width:52px}
.bartrack{height:9px;border-radius:99px;background:var(--track);overflow:hidden}
.barfill{height:100%;border-radius:99px;transition:width .5s ease}
.barrow:hover .barfill{filter:brightness(1.08)}
@media(max-width:480px){
  .barrow{grid-template-columns:84px minmax(0,1fr) auto;gap:8px}
  .barrow .v{min-width:44px}
}

.modal-backdrop{background:rgba(0,0,0,.5)}
.modal{
  position:fixed;z-index:70;top:50%;left:50%;transform:translate(-50%,-50%);
  width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 64px);overflow-y:auto;
  background:var(--card);border:1px solid var(--border);border-radius:16px;
  box-shadow:var(--shadow);padding:22px;
}
.modal-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  position:sticky;top:-22px;margin:-22px -22px 4px;padding:22px 22px 14px;
  background:var(--card);
}
.modal-head h2{margin:0;font-size:17px;letter-spacing:-.01em}
.modal-body section{margin-top:16px}
.modal-body section:first-child{margin-top:0}
.modal-body h4{margin:0 0 6px;font-size:13px;font-weight:650}
.modal-body p{margin:0;font-size:13px;line-height:1.55;color:var(--ink2)}
.modal-body strong{color:var(--ink);font-weight:650}

.funnel{display:flex;flex-direction:column;gap:9px;min-width:0}
.fstage{display:grid;grid-template-columns:96px minmax(0,1fr);align-items:center;gap:12px}
.fstage .fk{font-size:13px;color:var(--ink2)}
.fbar{height:34px;border-radius:9px;display:flex;align-items:center;padding:0 12px;
  color:#fff;font-weight:700;font-size:14px;min-width:44px;transition:width .5s ease}

table.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{color:var(--muted);font-weight:600;font-size:11px;letter-spacing:.04em;
  text-transform:uppercase;text-align:right;padding:0 0 10px}
.tbl th:first-child{text-align:left}
.tbl td{padding:11px 0;border-top:1px solid var(--border);text-align:right}
.tbl td:first-child{text-align:left;font-weight:550}
.tbl tr:hover td{background:var(--card-2)}

.empty{color:var(--muted);font-size:13px;padding:6px 0}
.fade{opacity:.45;transition:opacity .2s;pointer-events:none}

/* login */
.login-wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
.login{width:342px;max-width:100%}
.login .brand-badge{width:48px;height:48px;border-radius:14px;margin:0 auto 16px;font-size:20px}
.login h2{margin:0 0 4px;text-align:center;font-size:19px;letter-spacing:-.01em}
.login p{margin:0 0 18px;text-align:center;color:var(--muted);font-size:13px}
.field{width:100%;background:var(--card-2);color:var(--ink);border:1px solid var(--border);
  border-radius:10px;padding:11px 12px;font-size:14px;color-scheme:light dark}
.field:focus{outline:none;border-color:var(--accent)}
.login .btn.primary{width:100%;justify-content:center;margin-top:12px;padding:11px}
.err-msg{color:var(--crit);font-size:12.5px;margin-top:10px;text-align:center}

/* meta editor */
.metahead{display:flex;justify-content:space-between;align-items:center;gap:8px}
.link{background:none;border:0;color:var(--accent);cursor:pointer;font-size:12px;
  font-weight:600;padding:2px 0;display:inline-flex;align-items:center;gap:4px}
.link:hover{text-decoration:underline}
.metaedit{display:grid;gap:8px;margin-top:12px}
.metaedit label{font-size:10.5px;color:var(--muted);display:block;margin-bottom:3px;
  text-transform:uppercase;letter-spacing:.04em}
.metaedit .row{display:flex;gap:8px}
`;
