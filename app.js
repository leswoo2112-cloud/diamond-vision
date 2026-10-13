"use strict";

(() => {
  const DB_KEY = "diamondVisionDatabaseV7";
  const PREVIOUS_DB = "diamondVisionDatabaseV6";
  const OLD_CURRENT = "diamondVisionCompleteV2";
  const OLD_ARCHIVE = "diamondVisionGamesV3";
  const OLD_PLAN = "diamondVisionSBOTeamsV5";

  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));

  const escape = value => String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );

  const uid = () =>
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const number = value =>
    Number.isFinite(Number(value)) ? Number(value) : 0;

  const integer = value =>
    Math.max(0, Math.floor(number(value)));

  const normalizeResult = result =>
    String(result || "").replace(/^티바\s*/, "").trim();

  const rate = (numerator, denominator) =>
    denominator > 0 ? numerator / denominator : null;

  const decimal = value =>
    value === null ? "—" : value.toFixed(3);

  const percentage = value =>
    value === null ? "—" : `${(value * 100).toFixed(1)}%`;

  const adjustedRate = (numerator, denominator) =>
    (numerator + 5) / (denominator + 10);

  const validDate = value =>
    /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

  const TEAMS = ["home", "away"];
  const BASES = ["first", "second", "third"];

  const HIT_BASES = {
    "안타": 1,
    "2루타": 2,
    "3루타": 3,
    "홈런": 4
  };

  const RESULTS = [
    "안타", "2루타", "3루타", "홈런",
    "땅볼", "뜬공", "라인드라이브", "희생플라이",
    "번트", "실책", "야수선택", "데드볼"
  ];

  const POSITIONS = [
    "", "투수", "포수", "1루수", "2루수", "3루수",
    "유격수", "좌익수", "중견수", "우익수", "지명타자"
  ];

  const AXIS_NAMES = [
    "정타 안타율",
    "볼넷·사구",
    "실제 출루",
    "장타 생산",
    "티바 성공",
    "삼진 회피"
  ];

  const DRAFT_IDS = {
    pitcher: "dvPitcher",
    batter: "dvBatter",
    side: "dvSide",
    runs: "dvRuns",
    rbi: "dvRbi",
    note: "dvNote",
    youtube: "dvYoutubeUrl"
  };

  let database = {
    version: 7,
    revision: "",
    activeId: "",
    games: [],
    teamPlan: null
  };

  let game;
  let ready = false;
  let storageBlocked = false;
  let storageError = "";
  let lastRevision = "";
  let undoStack = [];
  let rosterKeys = [];
  let saveTimer;

  let youtubePlayer = null;
  let youtubeReady = false;
  let youtubeId = "";
  let localVideoURL = "";

  function localDate() {
    const date = new Date();

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function button(label, action, extra = "", primary = false) {
    return `
      <button type="button"
        data-action="${action}"
        ${extra}
        class="${primary ? "dv-primary" : ""}">
        ${label}
      </button>
    `;
  }

  function section(title, kicker, body, id = "") {
    return `
      <section class="dv-panel" ${id ? `id="${id}"` : ""}>
        <div class="dv-kicker">${kicker}</div>
        <h2>${title}</h2>
        ${body}
      </section>
    `;
  }

  function buildInterface() {
    if ($("dvRoot")) return;

    const style = document.createElement("style");
    style.id = "dvAppStyle";

    style.textContent = `
      #dvRoot {
        --dv-bg:#07101f;
        --dv-line:#293c57;
        --dv-muted:#99aabe;
        --dv-red:#ff4057;
        --dv-blue:#2e6cff;
        color:#eef4ff;
        background:
          radial-gradient(circle at 80% 0%,#142947,transparent 38%),
          #07101f;
        min-height:100vh;
        font-family:
          -apple-system,BlinkMacSystemFont,
          "Apple SD Gothic Neo","Noto Sans KR",sans-serif;
      }

      #dvRoot *{box-sizing:border-box}
      #dvRoot [hidden]{display:none!important}

      #dvRoot button,
      #dvRoot input,
      #dvRoot select{font:inherit}

      #dvRoot button,
      #dvRoot .dv-button{
        cursor:pointer;
        touch-action:manipulation;
        border:1px solid var(--dv-line);
        border-radius:11px;
        padding:11px 14px;
        background:#142238;
        color:#eef4ff;
      }

      #dvRoot button:hover{filter:brightness(1.15)}
      #dvRoot button:disabled{opacity:.35;cursor:not-allowed}

      #dvRoot input,
      #dvRoot select{
        min-width:0;
        max-width:100%;
        padding:12px;
        color:#eef4ff;
        background:#081425;
        border:1px solid var(--dv-line);
        border-radius:10px;
      }

      #dvRoot input[type=checkbox]{width:20px;height:20px}
      #dvRoot a{color:inherit;text-decoration:none}

      #dvRoot button:focus-visible,
      #dvRoot input:focus-visible,
      #dvRoot select:focus-visible,
      #dvRoot a:focus-visible{
        outline:3px solid #80b1ff;
        outline-offset:2px;
      }

      #dvRoot h1,
      #dvRoot h2,
      #dvRoot h3{line-height:1.35}

      #dvRoot h2{font-size:23px;margin:6px 0 18px}
      #dvRoot h3{font-size:17px}
      #dvRoot p{line-height:1.7}

      #dvRoot .dv-top{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:18px;
        padding:22px 28px;
        background:#050c18;
        border-bottom:1px solid var(--dv-line);
      }

      #dvRoot .dv-brand{
        display:flex;
        align-items:center;
        gap:14px;
      }

      #dvRoot .dv-logo{
        width:55px;
        height:55px;
        display:grid;
        place-items:center;
        background:linear-gradient(140deg,#381927,#091323);
        border:1px solid #7f2638;
        border-radius:17px;
        font-size:29px;
      }

      #dvRoot .dv-brand h1{
        margin:0;
        font-size:25px;
        letter-spacing:.6px;
      }

      #dvRoot .dv-brand p{
        margin:4px 0 0;
        color:var(--dv-red);
        font-size:11px;
        font-weight:900;
        letter-spacing:3px;
      }

      #dvRoot .dv-live{color:#36e68b;white-space:nowrap}

      #dvRoot .dv-layout{
        display:grid;
        grid-template-columns:210px minmax(0,1fr);
      }

      #dvRoot .dv-sidebar{
        padding:24px 15px;
        background:#050c18;
        border-right:1px solid var(--dv-line);
      }

      #dvRoot .dv-sidebar a{
        display:block;
        padding:14px 10px;
        border-radius:10px;
        color:#b7c3d3;
      }

      #dvRoot .dv-sidebar a:hover{background:#431b2c}
      #dvRoot .dv-main{padding:22px;min-width:0}

      #dvRoot .dv-panel{
        min-width:0;
        padding:22px;
        margin-bottom:18px;
        border:1px solid var(--dv-line);
        border-radius:20px;
        background:linear-gradient(145deg,#0e1d31,#081425);
        box-shadow:0 15px 35px #0003;
      }

      #dvRoot .dv-kicker{
        color:var(--dv-red);
        font-size:11px;
        font-weight:900;
        letter-spacing:3px;
      }

      #dvRoot .dv-toolbar{
        display:flex;
        flex-wrap:wrap;
        align-items:end;
        gap:10px;
        margin:12px 0;
      }

      #dvRoot .dv-toolbar>select,
      #dvRoot .dv-toolbar>input{
        flex:1;
        min-width:150px;
      }

      #dvRoot label{
        display:grid;
        gap:7px;
        font-size:13px;
        color:var(--dv-muted);
      }

      #dvRoot .dv-primary{
        background:linear-gradient(90deg,#ff4057,#d70f2d);
        border:0;
        font-weight:800;
        color:white;
      }

      #dvRoot .dv-note{font-size:13px;color:var(--dv-muted)}

      #dvRoot .dv-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:18px;
      }

      #dvRoot .dv-form{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
        gap:12px;
      }

      #dvRoot .dv-form input,
      #dvRoot .dv-form select{width:100%}

      #dvRoot .dv-scoreboard{
        display:grid;
        grid-template-columns:minmax(0,1fr) 270px minmax(0,1fr);
        padding:0;
        overflow:hidden;
      }

      #dvRoot .dv-team{
        display:flex;
        align-items:center;
        gap:14px;
        padding:28px;
        min-width:0;
      }

      #dvRoot .dv-home{
        background:linear-gradient(100deg,#80172e,#3b1321);
      }

      #dvRoot .dv-away{
        background:linear-gradient(100deg,#0e2850,#164897);
      }

      #dvRoot .dv-team input{
        width:100%;
        min-width:0;
        border:0;
        padding:0;
        background:transparent;
        color:white;
        font-size:23px;
        font-weight:900;
      }

      #dvRoot .dv-away input{text-align:right}

      #dvRoot .dv-team strong{
        display:block;
        font-size:64px;
        text-align:center;
      }

      #dvRoot .dv-score-buttons{display:flex;gap:4px}
      #dvRoot .dv-score-buttons button{padding:3px 12px}

      #dvRoot .dv-center{
        display:grid;
        place-items:center;
        gap:15px;
        padding:20px;
        background:#071120;
      }

      #dvRoot .dv-inning{display:flex;align-items:center;gap:20px}
      #dvRoot .dv-inning strong{white-space:nowrap;font-size:23px}

      #dvRoot .dv-bases{
        position:relative;
        width:105px;
        height:72px;
      }

      #dvRoot .dv-bases button{
        position:absolute;
        width:29px;
        height:29px;
        padding:0;
        border-radius:0;
        transform:rotate(45deg);
        border:2px solid #53627a;
        background:#0a1424;
      }

      #dvRoot .dv-bases button.active{
        background:#ffc628;
        border-color:#fff1a3;
        box-shadow:0 0 15px #ffc62870;
      }

      #dvBase2{left:38px;top:0}
      #dvBase3{left:11px;top:33px}
      #dvBase1{right:11px;top:33px}

      #dvRoot .dv-count{display:flex;gap:8px}

      #dvRoot .dv-count div{
        padding:9px 14px;
        border:1px solid var(--dv-line);
        border-radius:10px;
        background:#0d1a2c;
      }

      #dvBalls{color:#36e68b}
      #dvStrikes{color:#ffc628}
      #dvOuts{color:#ff4057}

      #dvRoot .dv-current{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:15px;
      }

      #dvRoot .dv-current span{
        display:block;
        font-size:12px;
        color:var(--dv-muted);
      }

      #dvRoot .dv-current strong{display:block;margin-top:6px}

      #dvRoot .dv-buttons{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:8px;
      }

      #dvRoot .dv-buttons button{
        padding:13px 5px;
        font-size:13px;
        font-weight:700;
      }

      #dvRoot .dv-sequence{
        min-height:50px;
        padding:12px;
        margin:12px 0;
        background:#07111f;
        border:1px solid var(--dv-line);
        border-radius:11px;
      }

      #dvRoot .dv-chip{
        display:inline-block;
        padding:5px 9px;
        margin:3px;
        border-radius:30px;
        background:#675316;
        color:white;
        font-size:12px;
      }

      #dvRoot .dv-chip.B{background:#175738}
      #dvRoot .dv-chip.F,
      #dvRoot .dv-chip.TF{background:#744823}
      #dvRoot .dv-chip.SW{background:#783147}

      #dvRoot .dv-save{
        width:100%;
        font-size:17px;
        padding:17px;
      }

      #dvRoot .dv-video{
        height:320px;
        background:black;
        border-radius:15px;
        overflow:hidden;
        margin:15px 0;
      }

      #dvRoot .dv-video video,
      #dvRoot .dv-video iframe,
      #dvYoutubeWrap,
      #dvYoutubePlayer{
        width:100%;
        height:100%;
        border:0;
      }

      #dvRoot .dv-video-buttons{
        display:grid;
        grid-template-columns:repeat(6,1fr);
        gap:6px;
      }

      #dvRoot .dv-video-buttons button{padding:10px 4px}

      #dvRoot .dv-lineup-row{
        display:grid;
        grid-template-columns:30px minmax(0,1fr) 110px;
        align-items:center;
        gap:8px;
        margin:8px 0;
      }

      #dvRoot .dv-scroll{overflow:auto}
      #dvRoot table{width:100%;border-collapse:collapse}

      #dvRoot th,
      #dvRoot td{
        padding:11px;
        border-bottom:1px solid var(--dv-line);
        text-align:left;
        white-space:nowrap;
        font-size:13px;
      }

      #dvRoot th{color:var(--dv-muted)}
      #dvRoot td button{padding:5px 10px}

      #dvRoot .dv-card{
        padding:14px;
        border:1px solid var(--dv-line);
        border-radius:13px;
        background:#081425;
        margin:10px 0;
      }

      #dvRoot .dv-card h3{margin:0 0 10px}

      #dvRoot .dv-stats{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }

      #dvRoot .dv-stats>div{
        padding:10px;
        background:#122137;
        border-radius:8px;
      }

      #dvRoot .dv-stats span{
        display:block;
        font-size:11px;
        color:var(--dv-muted);
        margin-bottom:5px;
      }

      #dvRoot .dv-detail{
        margin-top:18px;
        padding:18px;
        border:1px solid var(--dv-line);
        border-radius:14px;
      }

      #dvRoot .dv-bar{
        display:grid;
        grid-template-columns:minmax(85px,1fr) 2fr 70px;
        align-items:center;
        gap:10px;
        margin:11px 0;
        font-size:12px;
      }

      #dvRoot .dv-track{
        height:13px;
        background:#64748b25;
        border-radius:20px;
        overflow:hidden;
      }

      #dvRoot .dv-fill{
        height:100%;
        background:#ff4057;
        border-radius:20px;
      }

      #dvSpray{
        position:relative;
        height:330px;
        cursor:crosshair;
        overflow:hidden;
        border-radius:50% 50% 12px 12px;
        border:1px solid #45674a;
        margin:15px 0;
        background:
          radial-gradient(
            circle at 50% 100%,
            #775123 0 20%,
            transparent 20.5%
          ),
          repeating-conic-gradient(
            from -30deg at 50% 100%,
            #214622 0deg 18deg,
            #193a20 18deg 36deg
          );
      }

      #dvSpray>span{position:absolute;font-size:12px}

      #dvZone{
        position:relative;
        display:grid;
        grid-template-columns:repeat(3,1fr);
        grid-template-rows:repeat(3,1fr);
        width:260px;
        max-width:100%;
        aspect-ratio:1;
        margin:20px auto;
        border:2px solid #7388a7;
        cursor:crosshair;
      }

      #dvZone>span{border:1px solid #31445f}

      #dvRoot .dv-point{
        position:absolute;
        width:10px;
        height:10px;
        background:#ff4057;
        border-radius:50%;
        transform:translate(-50%,-50%);
        pointer-events:none;
      }

      #dvReportOutput{
        padding:12px;
        border:1px solid var(--dv-line);
        border-radius:12px;
        min-height:130px;
      }

      #dvRoot .dv-paper{
        padding:28px;
        background:white;
        color:#172033;
        border-radius:8px;
        max-width:1100px;
        margin:auto;
      }

      #dvRoot .dv-paper h1{
        font-size:25px;
        border-bottom:3px solid #172033;
        padding-bottom:15px;
      }

      #dvRoot .dv-paper h2{
        margin-top:25px;
        font-size:19px;
        border-left:4px solid #e52f4e;
        padding-left:10px;
      }

      #dvRoot .dv-paper h3{font-size:15px}

      #dvRoot .dv-paper p,
      #dvRoot .dv-paper .dv-note{color:#526176}

      #dvRoot .dv-paper .dv-stats>div{
        background:white;
        border:1px solid #d6dfea;
      }

      #dvRoot .dv-paper .dv-stats span{color:#69778b}
      #dvRoot .dv-paper .dv-stats strong{font-size:19px}

      #dvRoot .dv-paper th,
      #dvRoot .dv-paper td{
        color:#172033;
        border-color:#d6dfea;
        white-space:normal;
        overflow-wrap:anywhere;
      }

      #dvRoot .dv-paper th{background:#eef2f7}
      #dvRoot .dv-paper svg{display:block;width:100%;height:auto}

      #dvRoot .dv-chart{
        padding:12px;
        border:1px solid #dbe2eb;
        border-radius:9px;
        min-width:0;
      }

      #dvRoot .dv-rules{
        padding:13px;
        background:#f1f5f9;
        font-size:12px;
        line-height:1.8;
        margin-top:15px;
      }

      #dvRoot .dv-team-plan{
        padding:17px;
        background:#0a172a;
        border:1px solid var(--dv-line);
        border-radius:13px;
      }

      #dvRoot .dv-team-plan ul{padding-left:22px;line-height:2}

      @media(max-width:1180px){
        #dvRoot .dv-layout{grid-template-columns:1fr}
        #dvRoot .dv-sidebar{display:none}

        #dvRoot .dv-scoreboard{
          grid-template-columns:minmax(0,1fr) 240px minmax(0,1fr);
        }

        #dvRoot .dv-team{padding:20px 15px}
      }

      @media(max-width:760px){
        #dvRoot .dv-main{padding:10px}
        #dvRoot .dv-top{padding:15px}
        #dvRoot .dv-brand h1{font-size:19px}
        #dvRoot .dv-brand p{font-size:9px;letter-spacing:2px}
        #dvRoot .dv-live{display:none}
        #dvRoot .dv-panel{padding:16px;border-radius:15px}

        #dvRoot .dv-scoreboard{
          padding:0;
          grid-template-columns:1fr 1fr;
        }

        #dvRoot .dv-center{grid-column:1/-1;grid-row:1}
        #dvRoot .dv-team input{font-size:17px}
        #dvRoot .dv-team strong{font-size:45px}
        #dvRoot .dv-grid{grid-template-columns:1fr}
        #dvRoot .dv-buttons{grid-template-columns:repeat(2,1fr)}
        #dvRoot .dv-video-buttons{grid-template-columns:repeat(3,1fr)}
        #dvRoot .dv-video{height:240px}

        #dvRoot .dv-stats{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        #dvRoot .dv-paper{padding:14px}
        #dvReportOutput{padding:4px}
      }

      @media print{
        body{background:white!important}
        body *{visibility:hidden!important}
        #dvRoot,#dvRoot *{visibility:visible!important}

        #dvRoot{
          background:white!important;
          color:black!important;
        }

        #dvRoot .dv-top,
        #dvRoot .dv-sidebar,
        #dvRoot .dv-main>section:not(#dvReportSection){
          display:none!important;
        }

        #dvRoot .dv-layout,
        #dvRoot .dv-main{
          display:block!important;
          padding:0!important;
        }

        #dvReportSection{
          padding:0!important;
          border:0!important;
          background:white!important;
          box-shadow:none!important;
        }

        #dvReportSection>*:not(#dvReportOutput){
          display:none!important;
        }

        #dvReportOutput{
          padding:0!important;
          border:0!important;
        }

        #dvRoot .dv-paper{
          padding:0!important;
          max-width:none!important;
        }

        #dvRoot .dv-paper .dv-grid{
          grid-template-columns:1fr 1fr;
        }

        #dvRoot .dv-chart,
        #dvRoot .dv-stats,
        #dvRoot tr{
          break-inside:avoid;
        }

        #dvRoot .dv-paper h2,
        #dvRoot .dv-paper h3{
          break-after:avoid;
        }

        #dvRoot .dv-scroll{overflow:visible!important}

        *{
          -webkit-print-color-adjust:exact;
          print-color-adjust:exact;
        }

        @page{size:A4;margin:12mm}
      }
    `;

    document.head.appendChild(style);

    // 2번 코드를 바로 아래에 이어 붙여주세요.
    const host = document.querySelector(".app-shell") || document.body;
    const root = document.createElement("div");
    root.id = "dvRoot";

    root.innerHTML = `
      <header class="dv-top">
        <div class="dv-brand">
          <div class="dv-logo">⚾</div>
          <div>
            <h1>DIAMOND VISION</h1>
            <p>BASEBALL ANALYTICS · SBO</p>
          </div>
        </div>
        <div class="dv-live">
          <span id="dvToday"></span>　● LIVE
        </div>
      </header>

      <div class="dv-layout">
        <nav class="dv-sidebar">
          <a href="#dvArchive">▦ 경기 저장 · 조회</a>
          <a href="#dvLive">◉ 실시간 기록</a>
          <a href="#dvLineup">♙ 라인업</a>
          <a href="#dvRecords">▤ 경기 기록</a>
          <a href="#dvVideoSection">▣ 영상 분석</a>
          <a href="#dvLocations">⌁ 타구 · 투구 위치</a>
          <a href="#dvReportSection">▧ 리포트</a>
          <a href="#dvBalance">⚖ 균형 팀 편성</a>
        </nav>

        <main class="dv-main">
          ${section("경기 저장 · 불러오기", "GAME ARCHIVE", `
            <div class="dv-toolbar">
              <label>
                경기 날짜
                <input id="dvDate" type="date">
              </label>

              ${button("현재 경기 저장", "save", "", true)}
              ${button("새 경기", "newGame")}
              ${button("백업 내보내기", "export")}
              ${button("백업 가져오기", "import")}

              <input
                id="dvImportFile"
                type="file"
                accept=".json,application/json"
                hidden
              >
            </div>

            <div class="dv-toolbar">
              <label>
                조회 날짜
                <input id="dvDateFilter" type="date">
              </label>

              ${button("전체 날짜", "allDates")}

              <select
                id="dvArchives"
                aria-label="저장 경기"
              ></select>

              ${button("선택 경기 불러오기", "load")}
            </div>

            <p id="dvSaveStatus" role="status">
              저장 상태 확인 중
            </p>

            <p class="dv-note">
              같은 브라우저에 자동 저장합니다.
              다른 기기로 옮길 때는 백업을 사용해주세요.
              한 날짜에 여러 경기를 저장할 수 있습니다.
            </p>
          `, "dvArchive")}

          <section
            id="dvLive"
            class="dv-panel dv-scoreboard"
          >
            <div class="dv-team dv-home">
              <input
                id="dvHomeName"
                aria-label="홈 팀 이름"
              >

              <div>
                <strong id="dvHomeScore">0</strong>

                <div class="dv-score-buttons">
                  ${button(
                    "−",
                    "score",
                    'data-team="home" data-value="-1"'
                  )}

                  ${button(
                    "+",
                    "score",
                    'data-team="home" data-value="1"'
                  )}
                </div>
              </div>
            </div>

            <div class="dv-center">
              <div class="dv-inning">
                ${button("◀", "inning", 'data-value="-1"')}

                <strong id="dvInning"></strong>

                ${button("▶", "inning", 'data-value="1"')}
              </div>

              <div class="dv-bases">
                <button
                  type="button"
                  id="dvBase2"
                  data-action="base"
                  data-base="second"
                  aria-label="2루"
                ></button>

                <button
                  type="button"
                  id="dvBase3"
                  data-action="base"
                  data-base="third"
                  aria-label="3루"
                ></button>

                <button
                  type="button"
                  id="dvBase1"
                  data-action="base"
                  data-base="first"
                  aria-label="1루"
                ></button>
              </div>

              <div class="dv-count">
                <div>B <b id="dvBalls">0</b></div>
                <div>S <b id="dvStrikes">0</b></div>
                <div>O <b id="dvOuts">0</b></div>
              </div>
            </div>

            <div class="dv-team dv-away">
              <div>
                <strong id="dvAwayScore">0</strong>

                <div class="dv-score-buttons">
                  ${button(
                    "−",
                    "score",
                    'data-team="away" data-value="-1"'
                  )}

                  ${button(
                    "+",
                    "score",
                    'data-team="away" data-value="1"'
                  )}
                </div>
              </div>

              <input
                id="dvAwayName"
                aria-label="원정 팀 이름"
              >
            </div>
          </section>

          <section class="dv-panel dv-current">
            <div>
              <span>현재 공격팀</span>
              <strong id="dvOffense"></strong>
            </div>

            <div>
              <span>현재 타자</span>
              <strong id="dvCurrentBatter"></strong>
            </div>

            <div>
              <span>다음 타자</span>
              <strong id="dvNextBatter"></strong>
            </div>
          </section>

          ${section("주루 · 경기 상황 수정", "RUNNER & SCORE", `
            <div class="dv-form">
              <label>
                1루 주자
                <input
                  id="dvRunnerFirst"
                  placeholder="없으면 빈칸"
                >
              </label>

              <label>
                2루 주자
                <input
                  id="dvRunnerSecond"
                  placeholder="없으면 빈칸"
                >
              </label>

              <label>
                3루 주자
                <input
                  id="dvRunnerThird"
                  placeholder="없으면 빈칸"
                >
              </label>

              <label>
                아웃
                <select id="dvManualOuts">
                  <option value="0">0아웃</option>
                  <option value="1">1아웃</option>
                  <option value="2">2아웃</option>
                </select>
              </label>
            </div>

            <div class="dv-toolbar">
              ${button("주자 · 아웃 적용", "situation")}

              <select
                id="dvRunnerBase"
                aria-label="주루 대상"
              >
                <option value="first">1루 주자</option>
                <option value="second">2루 주자</option>
                <option value="third">3루 주자</option>
              </select>

              ${button("도루 성공", "runner", 'data-kind="SB"')}
              ${button("도루 실패", "runner", 'data-kind="CS"')}
              ${button("견제 아웃", "runner", 'data-kind="PO"')}
              ${button("땅볼 병살", "runner", 'data-kind="DP"')}
              ${button("이닝별 점수 수정", "editScore")}
              ${button("↶ 최근 작업 취소", "undoAction")}
            </div>

            <p class="dv-note">
              안타는 루타 수만큼 자동 진루합니다.
              실제 주루와 다르면 주자·득점을 수정해주세요.
              병살은 타자와 선택한 주자의 아웃을 함께 기록합니다.
            </p>

            <div id="dvRunnerLog"></div>
          `)}

          <section class="dv-grid">
            ${section("경기 영상 분석", "GAME VIDEO", `
              <div class="dv-toolbar">
                <input
                  id="dvYoutubeUrl"
                  placeholder="유튜브 영상 주소"
                >

                ${button("유튜브 불러오기", "youtube", "", true)}
              </div>

              <input
                id="dvVideoFile"
                type="file"
                accept="video/*"
              >

              <div class="dv-video">
                <video
                  id="dvVideo"
                  controls
                  playsinline
                ></video>

                <div id="dvYoutubeWrap" hidden>
                  <div id="dvYoutubePlayer"></div>
                </div>
              </div>

              <div class="dv-video-buttons">
                ${button("−5초", "seek", 'data-value="-5"')}
                ${button("재생 / 정지", "play")}
                ${button("+5초", "seek", 'data-value="5"')}
                ${button("0.5×", "speed", 'data-value="0.5"')}
                ${button("1×", "speed", 'data-value="1"')}
                ${button("2×", "speed", 'data-value="2"')}
              </div>

              <p class="dv-note">
                영상 파일은 경기 백업에 포함되지 않습니다.
              </p>
            `, "dvVideoSection")}

            ${section("타석 기록", "LIVE SCORING", `
              <div class="dv-form">
                <label>
                  투수
                  <input
                    id="dvPitcher"
                    placeholder="투수 이름"
                  >
                </label>

                <label>
                  타자
                  <input
                    id="dvBatter"
                    placeholder="타자 이름"
                  >
                </label>

                <label>
                  타석 방향
                  <select id="dvSide">
                    <option>우타</option>
                    <option>좌타</option>
                    <option>양타</option>
                  </select>
                </label>
              </div>

              <h3>투구 기록</h3>

              <div class="dv-buttons">
                ${button("S 스트라이크", "pitch", 'data-value="S"')}
                ${button("B 볼", "pitch", 'data-value="B"')}
                ${button("F 파울", "pitch", 'data-value="F"')}
                ${button("SW 헛스윙", "pitch", 'data-value="SW"')}
              </div>

              <div
                id="dvSequence"
                class="dv-sequence"
              ></div>

              ${button("↶ 마지막 입력 취소", "undoInput")}

              <h3>타석 결과</h3>

              <div
                id="dvResultButtons"
                class="dv-buttons"
              >
                ${RESULTS.map(result =>
                  button(
                    result,
                    "result",
                    `data-value="${result}"`
                  )
                ).join("")}
              </div>

              <div
                class="dv-form"
                style="margin-top:14px"
              >
                <label>
                  득점
                  <input
                    id="dvRuns"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="빈칸이면 자동"
                  >
                </label>

                <label>
                  타점
                  <input
                    id="dvRbi"
                    type="number"
                    min="0"
                    step="1"
                    value="0"
                  >
                </label>

                <label>
                  메모
                  <input
                    id="dvNote"
                    placeholder="작전, 수비 위치 등"
                  >
                </label>
              </div>

              <div
                id="dvSelectedResult"
                class="dv-sequence"
              ></div>

              <button
                type="button"
                data-action="savePlate"
                class="dv-primary dv-save"
              >
                타석 저장
              </button>
            `)}
          </section>

          ${section("양 팀 라인업", "STARTING LINEUP", `
            <div class="dv-toolbar">
              ${button("라인업 초기화", "clearLineups")}
              ${button("라인업 저장", "saveLineups", "", true)}
            </div>

            <div class="dv-grid">
              <div>
                <h3 id="dvHomeLineupTitle"></h3>
                <div id="dvHomeLineup"></div>
              </div>

              <div>
                <h3 id="dvAwayLineupTitle"></h3>
                <div id="dvAwayLineup"></div>
              </div>
            </div>
          `, "dvLineup")}

          ${section("최근 타석 기록", "PLAY BY PLAY", `
            <div class="dv-toolbar">
              ${button("최근 타석 취소", "undoPlate")}
              ${button("현재 경기 기록 초기화", "clearRecords")}
            </div>

            <p class="dv-note">
              타자 이름을 누르면 투구 순서·볼카운트 확인과
              기록 수정이 가능합니다.
            </p>

            <div class="dv-scroll">
              <table>
                <thead>
                  <tr>
                    <th>회차</th>
                    <th>투수</th>
                    <th>타자</th>
                    <th>결과</th>
                    <th>득점</th>
                    <th>스코어</th>
                  </tr>
                </thead>

                <tbody id="dvRecordBody"></tbody>
              </table>
            </div>

            <div id="dvRecordDetail"></div>
          `, "dvRecords")}

          <section class="dv-grid">
            ${section(
              "타자 주요 분석",
              "BATTER ANALYSIS",
              '<div id="dvBatterStats"></div>'
            )}

            ${section(
              "투수 주요 분석",
              "PITCHER ANALYSIS",
              '<div id="dvPitcherStats"></div>'
            )}

            ${section(
              "이닝별 득점",
              "INNING FLOW",
              '<div id="dvInningChart"></div>'
            )}

            ${section(
              "타석 결과 분포",
              "RESULT SHARE",
              '<div id="dvResultChart"></div>'
            )}

            ${section(
              "오늘의 MVP",
              "TODAY’S MVP",
              '<div id="dvMvp"></div>'
            )}

            ${section(
              "팀 비교 · 하이라이트",
              "TEAM ANALYSIS",
              '<div id="dvTeamCompare"></div><div id="dvHighlights"></div>'
            )}
          </section>

          <section
            id="dvLocations"
            class="dv-grid"
          >
            ${section("타구 방향", "SPRAY CHART", `
              <p class="dv-note">
                현재 타자에게 연결됩니다.
                타석 저장 전에 위치를 눌러주세요.
              </p>

              <div id="dvSpray">
                <span style="left:18%;top:20%">좌익</span>
                <span style="left:46%;top:9%">중견</span>
                <span style="right:18%;top:20%">우익</span>
                <span style="left:45%;bottom:4%">HOME</span>
              </div>

              ${button(
                "타구 위치 초기화",
                "clearPoints",
                'data-kind="spray"'
              )}
            `)}

            ${section("투구 위치", "STRIKE ZONE", `
              <p class="dv-note">
                현재 투수에게 연결되는 별도 위치 기록입니다.
              </p>

              <div id="dvZone">
                ${"<span></span>".repeat(9)}
              </div>

              ${button(
                "투구 위치 초기화",
                "clearPoints",
                'data-kind="zone"'
              )}
            `)}
          </section>

          ${section("경기 · 선수 · 팀 리포트", "SCOUTING REPORT", `
            <div class="dv-toolbar">
              ${button(
                "현재 경기 리포트",
                "gameReport",
                "",
                true
              )}

              <select
                id="dvCurrentPlayer"
                aria-label="현재 경기 선수"
              ></select>

              ${button(
                "현재 경기 선수 리포트",
                "playerReport",
                'data-scope="current"'
              )}

              ${button("🖨 리포트 인쇄", "print")}
            </div>

            <div class="dv-toolbar">
              <label>
                누적 시작일
                <input id="dvFrom" type="date">
              </label>

              <label>
                누적 종료일
                <input id="dvTo" type="date">
              </label>

              <select
                id="dvReportPlayer"
                aria-label="누적 선수"
              ></select>

              ${button(
                "누적 선수 리포트",
                "playerReport",
                'data-scope="range"'
              )}
            </div>

            <div class="dv-toolbar">
              <select
                id="dvReportTeam"
                aria-label="누적 팀"
              ></select>

              ${button("누적 팀 리포트", "teamReport")}
            </div>

            <p class="dv-note">
              날짜를 비우면 전체 저장 경기를 분석합니다.
              선수는 ‘팀 이름 + 선수 이름’으로 구분하므로
              동일 선수는 같은 이름으로 입력해주세요.
            </p>

            <div id="dvReportOutput">
              리포트를 생성해주세요.
            </div>
          `, "dvReportSection")}

          ${section("리포트 기반 균형 팀 편성", "BALANCED TEAMS", `
            <p class="dv-note">
              위 리포트 날짜 범위의 기록으로 계산합니다.
              참가자·투수·포수를 선택하면 인원과 평균 점수,
              투수·포수 수를 고려합니다.
            </p>

            <div class="dv-toolbar">
              ${button("리포트 선수 불러오기", "roster")}

              <label>
                팀 수
                <select id="dvTeamCount">
                  ${[2, 3, 4, 5, 6].map(count => `
                    <option value="${count}">${count}팀</option>
                  `).join("")}
                </select>
              </label>

              ${button("균형 팀 편성", "makeTeams", "", true)}
              ${button("저장한 편성 보기", "restoreTeams")}
            </div>

            <div class="dv-scroll">
              <table>
                <thead>
                  <tr>
                    <th>참가</th>
                    <th>선수</th>
                    <th>기존 팀</th>
                    <th>완료 타석</th>
                    <th>평가점수</th>
                    <th>역할</th>
                  </tr>
                </thead>

                <tbody id="dvRoster"></tbody>
              </table>
            </div>

            <div
              id="dvTeamOutput"
              style="margin-top:20px"
            ></div>
          `, "dvBalance")}
        </main>
      </div>
    `;

    if (host === document.body) {
      document.body.replaceChildren(root);
    } else {
      host.replaceChildren(root);
      host.style.display = "block";
      host.style.minHeight = "100vh";
    }
  }

  /* =====================================================
     기본 경기 상태
  ===================================================== */

  function blankGame() {
    return {
      id: uid(),
      date: localDate(),
      updatedAt: "",

      homeTeamName: "레드 이글스",
      awayTeamName: "블루 타이거즈",

      currentInning: 1,
      isTopInning: true,

      ballCount: 0,
      strikeCount: 0,
      outCount: 0,

      homeScore: 0,
      awayScore: 0,

      baseState: {
        first: false,
        second: false,
        third: false
      },

      runners: {
        first: "",
        second: "",
        third: ""
      },

      currentPitchSequence: [],
      selectedPlateResult: "",

      isTeeMode: false,
      teeReason: "",

      inputHistory: [],
      plateAppearances: [],

      lineups: {
        home: [],
        away: []
      },

      battingOrderIndex: {
        home: 0,
        away: 0
      },

      inningScores: {
        home: {},
        away: {}
      },

      sprayPoints: [],
      zonePoints: [],
      events: [],
      lastKind: "",

      draft: {
        pitcher: "",
        batter: "",
        side: "우타",
        runs: "",
        rbi: "0",
        note: "",
        youtube: ""
      }
    };
  }

  function normalizeGame(saved) {
    const base = blankGame();

    const source =
      saved && typeof saved === "object"
        ? saved
        : {};

    const extension = source.dvExtension || {};
    const result = { ...base, ...source };

    result.id = String(
      source.id ||
      extension.id ||
      uid()
    );

    result.date = validDate(source.date || extension.date)
      ? (source.date || extension.date)
      : localDate();

    result.homeTeamName = String(
      source.homeTeamName || base.homeTeamName
    );

    result.awayTeamName = String(
      source.awayTeamName || base.awayTeamName
    );

    result.currentInning = Math.max(
      1,
      integer(source.currentInning) || 1
    );

    result.isTopInning = source.isTopInning !== false;

    [
      "ballCount",
      "strikeCount",
      "outCount",
      "homeScore",
      "awayScore"
    ].forEach(key => {
      result[key] = integer(source[key]);
    });

    result.baseState = {
      ...base.baseState,
      ...(source.baseState || {})
    };

    result.runners = {
      ...base.runners,
      ...(source.runners || extension.runners || {})
    };

    result.draft = {
      ...base.draft,
      ...(source.draft || source.dvDraft || {})
    };

    result.lineups = {
      home: [],
      away: []
    };

    result.battingOrderIndex = {
      home: 0,
      away: 0
    };

    result.inningScores = {
      home: {},
      away: {}
    };

    TEAMS.forEach(team => {
      result.lineups[team] = Array.isArray(source.lineups?.[team])
        ? source.lineups[team].filter(player =>
            player && typeof player === "object"
          )
        : [];

      result.battingOrderIndex[team] =
        integer(source.battingOrderIndex?.[team]);

      Object.entries(
        source.inningScores?.[team] || {}
      ).forEach(([inning, runs]) => {
        if (
          /^\d+$/.test(inning) &&
          Number(inning) >= 1
        ) {
          result.inningScores[team][inning] = integer(runs);
        }
      });
    });

    [
      "currentPitchSequence",
      "inputHistory",
      "plateAppearances",
      "sprayPoints",
      "zonePoints",
      "events"
    ].forEach(key => {
      const value = source[key] ?? extension[key];
      result[key] = Array.isArray(value) ? value : [];
    });

    result.plateAppearances =
      result.plateAppearances.filter(record =>
        record && typeof record === "object"
      );

    result.events = result.events.filter(event =>
      event && typeof event === "object"
    );

    result.lastKind =
      source.lastKind ||
      extension.lastKind ||
      "";

    BASES.forEach(baseName => {
      result.baseState[baseName] =
        Boolean(result.baseState[baseName]);

      result.runners[baseName] = result.baseState[baseName]
        ? String(result.runners[baseName] || "주자")
        : "";
    });

    return result;
  }

  function offense(state = game) {
    return state.isTopInning ? "away" : "home";
  }

  function teamName(team, state = game) {
    return team === "home"
      ? state.homeTeamName
      : state.awayTeamName;
  }

  function inningText(state = game) {
    return `${state.currentInning}회${state.isTopInning ? "초" : "말"}`;
  }

  function validLineup(team) {
    return game.lineups[team].filter(player =>
      String(player.name || "").trim()
    );
  }

  function readDraft() {
    if (!game) return;

    game.homeTeamName =
      $("dvHomeName").value.trim() || "HOME";

    game.awayTeamName =
      $("dvAwayName").value.trim() || "AWAY";

    Object.entries(DRAFT_IDS).forEach(([key, id]) => {
      game.draft[key] = $(id).value;
    });

    game.draft.pitcher = game.draft.pitcher.trim();
    game.draft.batter = game.draft.batter.trim();
  }

  function writeDraft() {
    $("dvHomeName").value = game.homeTeamName;
    $("dvAwayName").value = game.awayTeamName;
    $("dvDate").value = game.date;

    Object.entries(DRAFT_IDS).forEach(([key, id]) => {
      $(id).value = game.draft[key] ?? "";
    });
  }

  function setCurrentBatter() {
    const team = offense();
    const players = validLineup(team);
    const index = game.battingOrderIndex[team];

    game.draft.batter = players.length
      ? players[index % players.length].name
      : "";

    $("dvBatter").value = game.draft.batter;
  }

  function allGames() {
    const map = new Map(
      database.games.map(saved => [saved.id, saved])
    );

    map.set(game.id, game);

    return [...map.values()].sort(
      (a, b) => a.date.localeCompare(b.date)
    );
  }

  // 3번 코드를 바로 아래에 이어 붙여주세요.
  /* =====================================================
     저장 / 백업 / 이전 버전 데이터
  ===================================================== */

  function status(text, error = false) {
    $("dvSaveStatus").textContent = text;
    $("dvSaveStatus").style.color = error
      ? "#ff8193"
      : "#36e68b";
  }

  function upsertCurrent() {
    const index = database.games.findIndex(
      saved => saved.id === game.id
    );

    const snapshot = clone(game);

    if (index < 0) {
      database.games.push(snapshot);
    } else {
      database.games[index] = snapshot;
    }

    database.activeId = game.id;
  }

  function persist() {
    if (storageBlocked) {
      status(
        storageError ||
        "저장이 중단되었습니다. 백업을 내보내주세요.",
        true
      );

      return false;
    }

    try {
      const existingRaw = localStorage.getItem(DB_KEY);

      const existing = existingRaw
        ? JSON.parse(existingRaw)
        : null;

      if (
        lastRevision &&
        (!existing || existing.revision !== lastRevision)
      ) {
        storageBlocked = true;

        storageError =
          "다른 탭에서 저장 데이터가 바뀌었습니다. " +
          "현재 내용을 백업한 뒤 새로고침해주세요.";

        status(storageError, true);
        return false;
      }

      const revision = uid();

      const next = {
        ...database,
        revision
      };

      localStorage.setItem(
        DB_KEY,
        JSON.stringify(next)
      );

      database.revision = revision;
      lastRevision = revision;

      status(
        `저장됨 · ${new Date().toLocaleTimeString("ko-KR")}`
      );

      return true;
    } catch (error) {
      status(
        "저장 실패: 브라우저 저장 공간·설정을 확인하고 백업해주세요.",
        true
      );

      console.error(error);
      return false;
    }
  }

  function saveGame(notify = false) {
    if (!ready) return false;

    clearTimeout(saveTimer);

    readDraft();

    game.updatedAt = new Date().toISOString();

    upsertCurrent();

    const success = persist();

    renderArchives();

    if (notify) {
      alert(
        success
          ? "경기를 저장했어용."
          : "저장하지 못했어요. 저장 상태를 확인해주세요."
      );
    }

    return success;
  }

  function renderArchives() {
    const select = $("dvArchives");
    const previous = select.value || game.id;
    const filter = $("dvDateFilter").value;

    select.replaceChildren();

    allGames()
      .filter(saved =>
        !filter || saved.date === filter
      )
      .sort((a, b) =>
        b.date.localeCompare(a.date)
      )
      .forEach(saved => {
        const option = document.createElement("option");

        option.value = saved.id;

        option.textContent =
          `${saved.date} · ${saved.awayTeamName} ` +
          `${saved.awayScore} : ${saved.homeScore} ` +
          `${saved.homeTeamName} · ${saved.id.slice(-5)}`;

        select.appendChild(option);
      });

    if (
      [...select.options].some(
        option => option.value === previous
      )
    ) {
      select.value = previous;
    } else if (
      [...select.options].some(
        option => option.value === game.id
      )
    ) {
      select.value = game.id;
    }
  }

  function invalidateReport() {
    $("dvReportOutput").textContent =
      "최신 기록으로 리포트를 생성해주세요.";
  }

  function installGame(saved) {
    game = normalizeGame(clone(saved));

    undoStack = [];
    rosterKeys = [];

    $("dvRecordDetail").innerHTML = "";
    $("dvRoster").innerHTML = "";

    writeDraft();
    renderLineups();

    if (!game.draft.batter) {
      setCurrentBatter();
    }

    invalidateReport();
    render();
    refreshReportSelectors();
  }

  function newGame() {
    if (!saveGame()) return;

    const next = blankGame();

    next.date =
      $("dvDate").value || localDate();

    next.homeTeamName = game.homeTeamName;
    next.awayTeamName = game.awayTeamName;
    next.lineups = clone(game.lineups);

    installGame(next);
    saveGame();
  }

  function loadGame() {
    const id = $("dvArchives").value;

    if (!id || !saveGame()) return;

    const saved = database.games.find(
      item => item.id === id
    );

    if (!saved) {
      return alert("선택한 경기를 찾지 못했어요.");
    }

    installGame(saved);
    saveGame();
  }

  function downloadJSON(data, filename) {
    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function exportBackup() {
    readDraft();
    upsertCurrent();

    const backup = clone(database);

    backup.exportedAt = new Date().toISOString();

    if (storageBlocked) {
      backup.preservedOriginals = {};

      [
        DB_KEY,
        PREVIOUS_DB,
        OLD_CURRENT,
        OLD_ARCHIVE
      ].forEach(key => {
        try {
          backup.preservedOriginals[key] =
            localStorage.getItem(key);
        } catch {
          // 접근할 수 없는 저장 항목은 건너뜁니다.
        }
      });
    }

    downloadJSON(
      backup,
      `diamond-vision-${localDate()}.json`
    );
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const data = JSON.parse(
        await file.text()
      );

      const list = Array.isArray(data?.games)
        ? data.games
        : Array.isArray(data)
          ? data
          : Array.isArray(data?.plateAppearances)
            ? [data]
            : null;

      if (
        !list ||
        !list.every(item =>
          item &&
          typeof item === "object" &&
          Array.isArray(
            (item.state || item).plateAppearances
          )
        )
      ) {
        throw new Error(
          "경기 백업 형식이 아닙니다."
        );
      }

      if (storageBlocked) {
        alert(
          "기존 저장 데이터를 보호하기 위해 가져오기를 중단했어요. " +
          "현재 백업을 내보낸 뒤 저장 오류를 먼저 해결해주세요."
        );

        return;
      }

      if (!saveGame()) return;

      const next = clone(database);

      let added = 0;
      let skipped = 0;

      list.forEach(item => {
        const raw = item.state || item;

        const saved = normalizeGame({
          ...raw,

          id:
            raw.id ||
            raw.dvExtension?.id ||
            item.id,

          date:
            raw.date ||
            raw.dvExtension?.date ||
            item.date
        });

        if (
          next.games.some(
            existing => existing.id === saved.id
          )
        ) {
          skipped++;
        } else {
          next.games.push(saved);
          added++;
        }
      });

      if (
        !next.teamPlan &&
        Array.isArray(data?.teamPlan?.teams)
      ) {
        next.teamPlan = data.teamPlan;
      }

      const previous = database;
      database = next;

      if (!persist()) {
        database = previous;
        return;
      }

      renderArchives();
      refreshReportSelectors();

      alert(
        `${added}경기 추가, ` +
        `같은 ID의 ${skipped}경기는 중복 제외했어용.`
      );
    } catch (error) {
      alert(
        `가져오기 실패: ${error.message}`
      );
    } finally {
      event.target.value = "";
    }
  }

  function initializeStorage() {
    const currentRaw =
      localStorage.getItem(DB_KEY);

    if (currentRaw !== null) {
      const saved = JSON.parse(currentRaw);

      if (!Array.isArray(saved?.games)) {
        throw new Error("저장 형식 오류");
      }

      database = {
        version: 7,
        revision: saved.revision || "",
        activeId: saved.activeId || "",
        games: saved.games.map(normalizeGame),
        teamPlan: saved.teamPlan || null
      };

      lastRevision = database.revision;

      return (
        database.games.find(
          item => item.id === database.activeId
        ) ||
        database.games[0] ||
        blankGame()
      );
    }

    const previousRaw =
      localStorage.getItem(PREVIOUS_DB);

    if (previousRaw) {
      const previous = JSON.parse(previousRaw);

      if (!Array.isArray(previous?.games)) {
        throw new Error("이전 저장 형식 오류");
      }

      database.games =
        previous.games.map(normalizeGame);

      database.activeId =
        previous.activeId || "";

      database.teamPlan =
        previous.teamPlan || null;

      return (
        database.games.find(
          item => item.id === database.activeId
        ) ||
        database.games[0] ||
        blankGame()
      );
    }

    const archiveRaw =
      localStorage.getItem(OLD_ARCHIVE);

    const activeRaw =
      localStorage.getItem(OLD_CURRENT);

    const archive = archiveRaw
      ? JSON.parse(archiveRaw)
      : [];

    const active = activeRaw
      ? JSON.parse(activeRaw)
      : null;

    const list = Array.isArray(archive)
      ? archive
      : (archive?.games || []);

    if (!Array.isArray(list)) {
      throw new Error("이전 경기 목록 형식 오류");
    }

    database.games = list.map(item => {
      const raw = item.state || item;

      return normalizeGame({
        ...raw,

        id:
          raw.id ||
          raw.dvExtension?.id ||
          item.id,

        date:
          raw.date ||
          raw.dvExtension?.date ||
          item.date
      });
    });

    try {
      database.teamPlan = JSON.parse(
        localStorage.getItem(OLD_PLAN) || "null"
      );
    } catch {
      database.teamPlan = null;
    }

    if (active) {
      const normalized = normalizeGame(active);

      const index = database.games.findIndex(
        item => item.id === normalized.id
      );

      if (index < 0) {
        database.games.push(normalized);
      } else {
        database.games[index] = normalized;
      }

      database.activeId = normalized.id;

      return normalized;
    }

    return database.games[0] || blankGame();
  }

  /* =====================================================
     작업 취소 / 상태 복원
  ===================================================== */

  function checkpoint() {
    readDraft();

    undoStack.push(clone(game));

    if (undoStack.length > 15) {
      undoStack.shift();
    }
  }

  function commit(kind) {
    game.lastKind = kind;

    writeDraft();
    invalidateReport();
    render();
    saveGame();
    refreshReportSelectors();
  }

  function undoAction() {
    if (!undoStack.length) {
      return alert(
        "이번 접속에서 취소할 작업이 없어요."
      );
    }

    game = normalizeGame(
      undoStack.pop()
    );

    writeDraft();
    renderLineups();

    $("dvRecordDetail").innerHTML = "";

    invalidateReport();
    render();
    saveGame();
    refreshReportSelectors();
  }

  function inputSnapshot() {
    return {
      ballCount: game.ballCount,
      strikeCount: game.strikeCount,

      currentPitchSequence: [
        ...game.currentPitchSequence
      ],

      selectedPlateResult:
        game.selectedPlateResult,

      isTeeMode: game.isTeeMode,
      teeReason: game.teeReason
    };
  }

  function rememberInput() {
    game.inputHistory.push(
      inputSnapshot()
    );

    if (game.inputHistory.length > 200) {
      game.inputHistory.shift();
    }
  }

  function situationSnapshot() {
    return clone({
      ...inputSnapshot(),

      currentInning: game.currentInning,
      isTopInning: game.isTopInning,

      outCount: game.outCount,

      homeScore: game.homeScore,
      awayScore: game.awayScore,

      baseState: game.baseState,
      runners: game.runners,

      battingOrderIndex:
        game.battingOrderIndex,

      inningScores: game.inningScores,
      draft: game.draft,
      inputHistory: game.inputHistory
    });
  }

  function resetPlate() {
    game.ballCount = 0;
    game.strikeCount = 0;

    game.currentPitchSequence = [];
    game.selectedPlateResult = "";

    game.isTeeMode = false;
    game.teeReason = "";

    game.inputHistory = [];

    game.draft.runs = "";
    game.draft.rbi = "0";
    game.draft.note = "";
  }

  function clearBases() {
    BASES.forEach(base => {
      game.baseState[base] = false;
      game.runners[base] = "";
    });
  }

  function finishHalf() {
    if (game.isTopInning) {
      game.isTopInning = false;
    } else {
      game.currentInning++;
      game.isTopInning = true;
    }

    game.outCount = 0;

    clearBases();
    resetPlate();
    setCurrentBatter();
  }

  function changeInning(direction) {
    if (
      direction < 0 &&
      game.currentInning === 1 &&
      game.isTopInning
    ) {
      return;
    }

    if (
      !confirm(
        "이닝을 이동하면 현재 투구·주자·아웃 상황을 초기화합니다. 이동할까요?"
      )
    ) {
      return;
    }

    checkpoint();

    if (direction > 0) {
      finishHalf();
    } else {
      if (game.isTopInning) {
        game.currentInning--;
        game.isTopInning = false;
      } else {
        game.isTopInning = true;
      }

      game.outCount = 0;

      clearBases();
      resetPlate();
      setCurrentBatter();
    }

    commit("inning");
  }

  /* =====================================================
     투구 / 티바 / 마지막 입력 취소
  ===================================================== */

  function pitchState(sequence, hbp = false) {
    let balls = 0;
    let strikes = 0;

    let tee = hbp;
    let reason = hbp ? "데드볼" : "";
    let result = "";

    for (const pitch of sequence) {
      if (pitch === "B") {
        balls = Math.min(
          4,
          balls + 1
        );

        if (balls === 4) {
          tee = true;
          reason = "볼넷";
        }
      } else if (pitch === "F") {
        strikes = Math.min(
          2,
          strikes + 1
        );
      } else if (pitch === "TF") {
        strikes = Math.min(
          3,
          strikes + 1
        );

        if (strikes === 3) {
          result = "티바 파울 아웃";
        }
      } else if (
        pitch === "S" ||
        pitch === "SW"
      ) {
        strikes = Math.min(
          3,
          strikes + 1
        );

        if (strikes === 3) {
          result = "삼진";
        }
      }
    }

    return {
      balls,
      strikes,
      tee,
      reason,
      result
    };
  }

  function addPitch(type) {
    if (
      !["S", "B", "F", "SW"].includes(type)
    ) {
      return;
    }

    if (game.selectedPlateResult) {
      return alert(
        "선택한 결과를 저장하거나 마지막 입력을 취소해주세요."
      );
    }

    if (
      game.isTeeMode &&
      type !== "F"
    ) {
      return alert(
        "티바에서는 파울 또는 타격 결과를 입력해주세요."
      );
    }

    rememberInput();

    if (game.isTeeMode) {
      game.currentPitchSequence.push("TF");

      game.strikeCount = Math.min(
        3,
        game.strikeCount + 1
      );

      if (game.strikeCount === 3) {
        game.selectedPlateResult =
          "티바 파울 아웃";
      }
    } else {
      game.currentPitchSequence.push(type);

      if (type === "B") {
        game.ballCount = Math.min(
          4,
          game.ballCount + 1
        );

        if (game.ballCount === 4) {
          game.isTeeMode = true;
          game.teeReason = "볼넷";
        }
      } else if (type === "F") {
        game.strikeCount = Math.min(
          2,
          game.strikeCount + 1
        );
      } else {
        game.strikeCount = Math.min(
          3,
          game.strikeCount + 1
        );

        if (game.strikeCount === 3) {
          game.selectedPlateResult = "삼진";
        }
      }
    }

    render();
    saveGame();
  }

  function setResult(result) {
    if (
      ["삼진", "티바 파울 아웃"].includes(
        game.selectedPlateResult
      )
    ) {
      return alert(
        "자동 확정된 결과를 바꾸려면 마지막 입력을 취소해주세요."
      );
    }

    if (
      game.isTeeMode &&
      ["홈런", "데드볼"].includes(result)
    ) {
      return;
    }

    rememberInput();

    if (result === "데드볼") {
      game.isTeeMode = true;
      game.teeReason = "데드볼";
      game.selectedPlateResult = "";
    } else {
      game.selectedPlateResult = game.isTeeMode
        ? `티바 ${result}`
        : result;
    }

    render();
    saveGame();
  }

  function undoInput() {
    const snapshot =
      game.inputHistory.pop();

    if (snapshot) {
      Object.assign(game, snapshot);
    } else if (
      game.selectedPlateResult &&
      !["삼진", "티바 파울 아웃"].includes(
        game.selectedPlateResult
      )
    ) {
      game.selectedPlateResult = "";
    } else if (
      game.isTeeMode &&
      game.teeReason === "데드볼" &&
      !game.currentPitchSequence.includes("TF")
    ) {
      game.isTeeMode = false;
      game.teeReason = "";
      game.selectedPlateResult = "";
    } else if (
      game.currentPitchSequence.length
    ) {
      game.currentPitchSequence.pop();

      const state = pitchState(
        game.currentPitchSequence,
        game.isTeeMode &&
        game.teeReason === "데드볼"
      );

      game.ballCount = state.balls;
      game.strikeCount = state.strikes;
      game.isTeeMode = state.tee;
      game.teeReason = state.reason;
      game.selectedPlateResult = state.result;
    } else {
      return;
    }

    render();
    saveGame();
  }

  // 4번 코드를 바로 아래에 이어 붙여주세요.
  /* =====================================================
     점수 / 주자
  ===================================================== */

  function toggleBase(base) {
    checkpoint();

    game.baseState[base] =
      !game.baseState[base];

    game.runners[base] =
      game.baseState[base] ? "주자" : "";

    commit("base");
  }

  function applySituation() {
    checkpoint();

    [
      "dvRunnerFirst",
      "dvRunnerSecond",
      "dvRunnerThird"
    ].forEach((id, index) => {
      const name = $(id).value.trim();

      game.runners[BASES[index]] = name;
      game.baseState[BASES[index]] = Boolean(name);
    });

    game.outCount = Math.min(
      2,
      integer($("dvManualOuts").value)
    );

    commit("situation");
  }

  function addRuns(team, inning, delta) {
    game[`${team}Score`] += delta;

    game.inningScores[team][inning] =
      number(game.inningScores[team][inning]) + delta;
  }

  function changeScore(team, delta) {
    if (
      delta < 0 &&
      game[`${team}Score`] < 1
    ) {
      return;
    }

    let inning = game.currentInning;

    if (
      delta < 0 &&
      number(game.inningScores[team][inning]) < 1
    ) {
      inning = Object.keys(game.inningScores[team])
        .map(Number)
        .filter(value =>
          number(game.inningScores[team][value]) > 0
        )
        .sort((a, b) => b - a)[0];

      if (!inning) {
        return alert(
          "이닝별 점수 수정에서 점수를 먼저 확인해주세요."
        );
      }
    }

    checkpoint();

    addRuns(team, inning, delta);

    game.events.push({
      inning: inningText(),

      text:
        `${teamName(team)} ${inning}회 점수 ` +
        `${delta > 0 ? "+" : ""}${delta}`
    });

    commit("score");
  }

  function editInningScore() {
    const team = prompt(
      "수정할 팀: home 또는 away",
      offense()
    );

    if (!TEAMS.includes(team)) return;

    const inningInput = prompt(
      "수정할 이닝",
      String(game.currentInning)
    );

    if (inningInput === null) return;

    const inning = Number(inningInput);

    if (
      !Number.isInteger(inning) ||
      inning < 1 ||
      inning > 99
    ) {
      return alert(
        "이닝은 1~99 사이 정수로 입력해주세요."
      );
    }

    const previous =
      number(game.inningScores[team][inning]);

    const valueInput = prompt(
      `${teamName(team)} ${inning}회 득점`,
      String(previous)
    );

    if (valueInput === null) return;

    const value = Number(valueInput);

    if (
      !Number.isInteger(value) ||
      value < 0
    ) {
      return alert(
        "득점은 0 이상의 정수로 입력해주세요."
      );
    }

    if (
      game[`${team}Score`] + value - previous < 0
    ) {
      return alert(
        "총점과 이닝 점수가 맞지 않습니다. 기록을 확인해주세요."
      );
    }

    checkpoint();

    addRuns(
      team,
      inning,
      value - previous
    );

    game.events.push({
      inning: inningText(),

      text:
        `${teamName(team)} ${inning}회 득점 ` +
        `${previous} → ${value}`
    });

    commit("score");
  }

  function baseText() {
    return BASES
      .map((base, index) =>
        game.baseState[base]
          ? `${index + 1}루`
          : ""
      )
      .filter(Boolean)
      .join(", ") || "주자 없음";
  }

  /* =====================================================
     타격 결과에 따른 주자 이동
  ===================================================== */

  function advanceRunners(
    bases,
    names,
    result,
    batter,
    outs
  ) {
    const nextBases = { ...bases };
    const nextNames = { ...names };

    let runs = 0;
    let addedOuts = 0;

    const normalized =
      normalizeResult(result);

    const step =
      HIT_BASES[normalized];

    if (step) {
      BASES.forEach(base => {
        nextBases[base] = false;
        nextNames[base] = "";
      });

      BASES.forEach((base, index) => {
        if (!bases[base]) return;

        const destination = index + step;

        if (destination >= 3) {
          runs++;
        } else {
          nextBases[BASES[destination]] = true;

          nextNames[BASES[destination]] =
            names[base] || "주자";
        }
      });

      if (step === 4) {
        runs++;
      } else {
        nextBases[BASES[step - 1]] = true;
        nextNames[BASES[step - 1]] = batter;
      }
    } else if (normalized === "희생플라이") {
      addedOuts = 1;

      if (
        outs < 2 &&
        nextBases.third
      ) {
        runs++;

        nextBases.third = false;
        nextNames.third = "";
      }
    } else if (
      [
        "삼진",
        "파울 아웃",
        "땅볼",
        "뜬공",
        "라인드라이브",
        "번트"
      ].includes(normalized)
    ) {
      addedOuts = 1;
    } else if (
      ["실책", "야수선택"].includes(normalized) &&
      !nextBases.first
    ) {
      nextBases.first = true;
      nextNames.first = batter;
    }

    return {
      bases: nextBases,
      names: nextNames,
      runs,
      addedOuts
    };
  }

  /* =====================================================
     타석 저장
  ===================================================== */

  function savePlate(
    doublePlay = false,
    caughtBase = null
  ) {
    const draft = game.draft;

    if (
      !draft.pitcher ||
      !draft.batter
    ) {
      return alert(
        "투수와 타자 이름을 입력해주세요."
      );
    }

    if (
      !doublePlay &&
      !game.selectedPlateResult
    ) {
      return alert(
        "타석 결과를 선택해주세요."
      );
    }

    const enteredRuns =
      String(draft.runs).trim() === ""
        ? null
        : Number(draft.runs);

    const rbi =
      Number(draft.rbi || 0);

    if (
      (
        enteredRuns !== null &&
        (
          !Number.isInteger(enteredRuns) ||
          enteredRuns < 0
        )
      ) ||
      !Number.isInteger(rbi) ||
      rbi < 0
    ) {
      return alert(
        "득점·타점은 0 이상의 정수로 입력해주세요."
      );
    }

    checkpoint();

    const before =
      situationSnapshot();

    const team = offense();
    const inning = game.currentInning;

    const result = doublePlay
      ? "땅볼"
      : game.selectedPlateResult;

    const beforeBases = baseText();

    const beforeScore =
      `${game.awayScore} : ${game.homeScore}`;

    const advancement = advanceRunners(
      game.baseState,
      game.runners,
      result,
      draft.batter,
      game.outCount
    );

    game.baseState = advancement.bases;
    game.runners = advancement.names;

    let addedOuts =
      advancement.addedOuts;

    let runs =
      enteredRuns ?? advancement.runs;

    if (doublePlay) {
      addedOuts = 2;
      runs = 0;

      game.baseState[caughtBase] = false;
      game.runners[caughtBase] = "";
    }

    game.outCount = Math.min(
      3,
      game.outCount + addedOuts
    );

    addRuns(team, inning, runs);

    const players =
      validLineup(team);

    const current = players.length
      ? players[
          game.battingOrderIndex[team] %
          players.length
        ]
      : null;

    game.plateAppearances.push({
      id: uid(),

      beforeState: before,

      date: game.date,
      inning: inningText(),
      inningNumber: inning,

      half: game.isTopInning
        ? "top"
        : "bottom",

      offenseTeam: team,
      teamName: teamName(team),

      battingOrder:
        current?.order || null,

      position:
        current?.position || "",

      pitcher: draft.pitcher,
      batter: draft.batter,
      batterSide: draft.side,

      pitches: [
        ...game.currentPitchSequence
      ],

      countAtResult: {
        balls: game.ballCount,
        strikes: game.strikeCount
      },

      result,

      teeMode: game.isTeeMode,
      teeReason: game.teeReason,

      baseBefore: beforeBases,
      baseAfter: baseText(),

      outsBefore: before.outCount,
      outsAfter: game.outCount,

      extraOuts: doublePlay ? 1 : 0,

      runs,
      rbi,

      scoreBefore: beforeScore,

      scoreAfter:
        `${game.awayScore} : ${game.homeScore}`,

      note:
        `${doublePlay ? "땅볼 병살 · " : ""}` +
        `${draft.note || ""}`,

      videoTime:
        currentVideoTime(),

      videoSource: isYouTube()
        ? youtubeId
        : ($("dvVideo").src ? "local" : "")
    });

    if (players.length) {
      game.battingOrderIndex[team] =
        (
          game.battingOrderIndex[team] + 1
        ) % players.length;
    }

    resetPlate();

    if (game.outCount >= 3) {
      finishHalf();
    } else {
      setCurrentBatter();
    }

    $("dvRecordDetail").innerHTML = "";

    commit("plate");
  }

  /* =====================================================
     도루 / 도루 실패 / 견제 / 병살
  ===================================================== */

  function runnerAction(kind) {
    const base =
      $("dvRunnerBase").value;

    const index =
      BASES.indexOf(base);

    if (!game.baseState[base]) {
      return alert(
        "선택한 베이스에 주자가 없어요."
      );
    }

    if (kind === "DP") {
      if (game.outCount > 1) {
        return alert(
          "병살은 0아웃 또는 1아웃에서 입력해주세요."
        );
      }

      if (
        game.isTeeMode ||
        game.selectedPlateResult
      ) {
        return alert(
          "일반 타석에서 결과 선택을 비운 뒤 병살을 입력해주세요."
        );
      }

      return savePlate(true, base);
    }

    if (
      kind === "SB" &&
      index < 2 &&
      game.baseState[BASES[index + 1]]
    ) {
      return alert(
        "다음 베이스에 주자가 있어요. 상황을 먼저 수정해주세요."
      );
    }

    checkpoint();

    const name =
      game.runners[base] || "주자";

    const label = {
      SB: "도루 성공",
      CS: "도루 실패",
      PO: "견제 아웃"
    }[kind];

    game.events.push({
      inning: inningText(),

      text:
        `${name} · ${index + 1}루에서 ${label}`
    });

    game.baseState[base] = false;
    game.runners[base] = "";

    if (kind === "SB") {
      if (index === 2) {
        addRuns(
          offense(),
          game.currentInning,
          1
        );
      } else {
        game.baseState[BASES[index + 1]] = true;
        game.runners[BASES[index + 1]] = name;
      }
    } else {
      game.outCount++;

      if (game.outCount >= 3) {
        finishHalf();
      }
    }

    commit("runner");
  }

  /* =====================================================
     최근 타석 취소
  ===================================================== */

  function undoPlate() {
    const record =
      game.plateAppearances.at(-1);

    if (!record) {
      return alert(
        "취소할 타석 기록이 없어요."
      );
    }

    if (
      game.lastKind &&
      game.lastKind !== "plate"
    ) {
      return alert(
        "타석 저장 후 다른 작업이 있어요. " +
        "‘최근 작업 취소’로 먼저 되돌려주세요."
      );
    }

    if (
      game.currentPitchSequence.length ||
      game.selectedPlateResult
    ) {
      return alert(
        "현재 진행 중인 타석 입력을 먼저 정리해주세요."
      );
    }

    if (!record.beforeState) {
      return alert(
        "이전 기록에 복원 정보가 없어요. " +
        "기록 수정 기능을 이용해주세요."
      );
    }

    checkpoint();

    game.plateAppearances.pop();

    const state =
      record.beforeState;

    [
      "currentInning",
      "isTopInning",
      "outCount",
      "homeScore",
      "awayScore",
      "baseState",
      "battingOrderIndex",
      "inningScores",
      "runners"
    ].forEach(key => {
      if (state[key] !== undefined) {
        game[key] = clone(state[key]);
      }
    });

    game.currentPitchSequence = [
      ...(
        state.currentPitchSequence ||
        record.pitches ||
        []
      )
    ];

    game.ballCount =
      integer(state.ballCount);

    game.strikeCount =
      integer(state.strikeCount);

    game.isTeeMode = Boolean(
      state.isTeeMode ?? record.teeMode
    );

    game.teeReason =
      state.teeReason ??
      record.teeReason ??
      "";

    game.selectedPlateResult =
      state.selectedPlateResult ||
      record.result;

    game.inputHistory = clone(
      state.inputHistory || []
    );

    game.draft = {
      ...game.draft,
      ...(state.draft || {}),

      pitcher: record.pitcher,
      batter: record.batter,

      side:
        record.batterSide || "우타",

      runs:
        String(record.runs || 0),

      rbi:
        String(record.rbi || 0),

      note:
        record.note || ""
    };

    BASES.forEach(base => {
      game.runners[base] = game.baseState[base]
        ? game.runners[base] || "주자"
        : "";
    });

    commit("undoPlate");
  }

  function clearRecords() {
    if (
      !confirm(
        "현재 경기의 타석·점수·주루·위치 기록을 초기화할까요? " +
        "다른 경기는 유지됩니다."
      )
    ) {
      return;
    }

    checkpoint();

    const next = blankGame();

    next.id = game.id;
    next.date = game.date;

    next.homeTeamName =
      game.homeTeamName;

    next.awayTeamName =
      game.awayTeamName;

    next.lineups =
      clone(game.lineups);

    game = next;

    setCurrentBatter();

    $("dvRecordDetail").innerHTML = "";

    commit("clear");
  }

  /* =====================================================
     라인업
  ===================================================== */

  function renderLineups() {
    TEAMS.forEach(team => {
      const target = team === "home"
        ? "dvHomeLineup"
        : "dvAwayLineup";

      $(target).innerHTML = Array.from(
        { length: 9 },
        (_, index) => {
          const player = game.lineups[team].find(
            item =>
              Number(item.order) === index + 1
          ) || {};

          return `
            <div class="dv-lineup-row">
              <b>${index + 1}</b>

              <input
                id="dv-${team}-player-${index}"
                value="${escape(player.name || "")}"
                placeholder="${index + 1}번 타자"
              >

              <select
                id="dv-${team}-position-${index}"
              >
                ${POSITIONS.map(position => `
                  <option
                    value="${position}"
                    ${position === player.position ? "selected" : ""}
                  >
                    ${position || "포지션"}
                  </option>
                `).join("")}
              </select>
            </div>
          `;
        }
      ).join("");
    });
  }

  function saveLineups() {
    checkpoint();

    TEAMS.forEach(team => {
      game.lineups[team] = Array.from(
        { length: 9 },
        (_, index) => ({
          order: index + 1,

          name:
            $(`dv-${team}-player-${index}`)
              .value
              .trim(),

          position:
            $(`dv-${team}-position-${index}`)
              .value
        })
      );
    });

    setCurrentBatter();
    commit("lineup");
  }

  function clearLineups() {
    if (
      !confirm("양 팀 라인업을 비울까요?")
    ) {
      return;
    }

    checkpoint();

    game.lineups = {
      home: [],
      away: []
    };

    game.battingOrderIndex = {
      home: 0,
      away: 0
    };

    renderLineups();
    setCurrentBatter();
    commit("lineup");
  }

  /* =====================================================
     타석 상세
  ===================================================== */

  function pitchChips(pitches) {
    return (pitches || []).map(pitch => `
      <span class="dv-chip ${
        ["B", "F", "TF", "SW"].includes(pitch)
          ? pitch
          : ""
      }">
        ${
          escape(
            pitch === "TF"
              ? "티바 파울"
              : pitch
          )
        }
      </span>
    `).join("") || "투구 기록 없음";
  }

  function showRecord(index) {
    const record =
      game.plateAppearances[index];

    if (!record) return;

    const results = [...new Set([
      record.result,

      ...RESULTS.filter(
        value => value !== "데드볼"
      ),

      "삼진",

      ...RESULTS
        .filter(value =>
          !["홈런", "데드볼"].includes(value)
        )
        .map(value =>
          `티바 ${value}`
        ),

      "티바 파울 아웃"
    ])];

    $("dvRecordDetail").innerHTML = `
      <div class="dv-detail">
        <h3>
          ${escape(record.inning)}
          ·
          ${escape(record.batter)}
        </h3>

        <div>
          ${pitchChips(record.pitches)}
        </div>

        <p>
          종료 카운트:
          ${
            record.countAtResult
              ? (
                  `${integer(record.countAtResult.balls)}B ` +
                  `${integer(record.countAtResult.strikes)}S`
                )
              : "이전 기록에는 저장되지 않음"
          }

          · 시작 상황:
          ${escape(record.baseBefore || "미기록")}
          /
          ${integer(record.outsBefore)}아웃
        </p>

        <div class="dv-form">
          <label>
            타자
            <input
              id="dvEditBatter"
              value="${escape(record.batter)}"
            >
          </label>

          <label>
            투수
            <input
              id="dvEditPitcher"
              value="${escape(record.pitcher)}"
            >
          </label>

          <label>
            결과
            <select id="dvEditResult">
              ${results.map(result => `
                <option
                  ${result === record.result ? "selected" : ""}
                >
                  ${escape(result)}
                </option>
              `).join("")}
            </select>
          </label>

          <label>
            티바 사유
            <select id="dvEditReason">
              <option value="">없음</option>

              <option
                ${record.teeReason === "볼넷" ? "selected" : ""}
              >볼넷</option>

              <option
                ${record.teeReason === "데드볼" ? "selected" : ""}
              >데드볼</option>
            </select>
          </label>

          <label>
            득점
            <input
              id="dvEditRuns"
              type="number"
              min="0"
              step="1"
              value="${integer(record.runs)}"
            >
          </label>

          <label>
            타점
            <input
              id="dvEditRbi"
              type="number"
              min="0"
              step="1"
              value="${integer(record.rbi)}"
            >
          </label>

          <label>
            메모
            <input
              id="dvEditNote"
              value="${escape(record.note || "")}"
            >
          </label>
        </div>

        <div class="dv-toolbar">
          ${button(
            "수정 저장",
            "editRecord",
            `data-index="${index}"`,
            true
          )}

          ${button(
            "영상 해당 시점",
            "jump",
            `data-index="${index}"`
          )}
        </div>

        <p class="dv-note">
          득점 수정은 총점·이닝 점수·이후 스코어에 반영합니다.
          결과 변경에 따른 주자·아웃·타순은 자동 재구성하지 않으므로
          경기 상황에서 함께 수정해주세요.
        </p>
      </div>
    `;
  }

  function recordOffense(record) {
    if (
      TEAMS.includes(record.offenseTeam)
    ) {
      return record.offenseTeam;
    }

    return (
      record.half === "bottom" ||
      String(record.inning).includes("말")
    )
      ? "home"
      : "away";
  }

  function shiftScore(text, team, delta) {
    const match = String(text || "").match(
      /^(\d+)\s*:\s*(\d+)$/
    );

    if (!match) return text;

    let away = Number(match[1]);
    let home = Number(match[2]);

    if (team === "home") {
      home += delta;
    } else {
      away += delta;
    }

    return `${away} : ${home}`;
  }

  /* =====================================================
     기록 수정
  ===================================================== */

  function editRecord(index) {
    const record =
      game.plateAppearances[index];

    if (!record) return;

    const batter =
      $("dvEditBatter").value.trim();

    const pitcher =
      $("dvEditPitcher").value.trim();

    const result =
      $("dvEditResult").value.trim();

    const teeReason =
      $("dvEditReason").value;

    const runs =
      Number($("dvEditRuns").value);

    const rbi =
      Number($("dvEditRbi").value);

    const tee =
      result.startsWith("티바 ");

    if (!batter || !pitcher) {
      return alert(
        "선수 이름을 입력해주세요."
      );
    }

    if (
      ![runs, rbi].every(value =>
        Number.isInteger(value) &&
        value >= 0
      )
    ) {
      return alert(
        "득점·타점은 0 이상의 정수로 입력해주세요."
      );
    }

    if (tee && !teeReason) {
      return alert(
        "티바 전환 사유를 선택해주세요."
      );
    }

    if (!tee && teeReason) {
      return alert(
        "일반 타석은 티바 사유를 ‘없음’으로 선택해주세요."
      );
    }

    const team =
      recordOffense(record);

    const inning =
      record.inningNumber ||
      parseInt(record.inning, 10) ||
      1;

    const delta =
      runs - integer(record.runs);

    if (
      game[`${team}Score`] + delta < 0 ||
      number(game.inningScores[team][inning]) + delta < 0
    ) {
      return alert(
        "수동 점수 수정 내역과 충돌합니다. " +
        "이닝별 점수를 먼저 확인해주세요."
      );
    }

    checkpoint();

    Object.assign(record, {
      batter,
      pitcher,
      result,
      teeMode: tee,
      teeReason,
      runs,
      rbi,

      note:
        $("dvEditNote").value.trim()
    });

    addRuns(team, inning, delta);

    game.plateAppearances.forEach(
      (item, itemIndex) => {
        if (itemIndex < index) return;

        item.scoreAfter = shiftScore(
          item.scoreAfter,
          team,
          delta
        );

        if (itemIndex > index) {
          item.scoreBefore = shiftScore(
            item.scoreBefore,
            team,
            delta
          );

          if (item.beforeState) {
            item.beforeState[`${team}Score`] =
              number(
                item.beforeState[`${team}Score`]
              ) + delta;

            if (
              item.beforeState.inningScores?.[team]
            ) {
              item.beforeState.inningScores[team][inning] =
                number(
                  item.beforeState.inningScores[team][inning]
                ) + delta;
            }
          }
        }
      }
    );

    commit("edit");
    showRecord(index);
  }

  // 5번 코드를 바로 아래에 이어 붙여주세요.
  /* =====================================================
     SBO 타석 분류
  ===================================================== */

  function classify(record) {
    const result =
      normalizeResult(record.result);

    const tee = Boolean(
      record.teeMode ||
      String(record.result).startsWith("티바 ")
    );

    const bases =
      HIT_BASES[result] || 0;

    const hit =
      !tee && bases > 0;

    const teeHit =
      tee && bases > 0;

    const strikeout =
      !tee && result === "삼진";

    const walk =
      record.teeReason === "볼넷" ||
      result === "볼넷";

    const hbp =
      record.teeReason === "데드볼" ||
      result === "데드볼";

    const free =
      walk || hbp;

    return {
      result,
      tee,
      bases,
      hit,
      teeHit,
      strikeout,
      walk,
      hbp,
      free,

      ab:
        Number(hit || strikeout),

      pa:
        Number(
          hit ||
          strikeout ||
          free ||
          tee
        ),

      credited:
        Number(hit || free || tee),

      actual:
        Number(
          hit ||
          teeHit ||
          (hbp && !tee)
        )
    };
  }

  /* =====================================================
     타자 통계
  ===================================================== */

  function battingStats(records) {
    const stats = {
      completed: records.length,

      ab: 0,
      pa: 0,

      hits: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      totalBases: 0,

      strikeouts: 0,
      walks: 0,
      hbp: 0,

      tee: 0,
      teeHits: 0,
      teeOuts: 0,

      credited: 0,
      actual: 0,
      rbi: 0,

      normal: 0,
      normalContact: 0
    };

    records.forEach(record => {
      const item =
        classify(record);

      stats.ab += item.ab;
      stats.pa += item.pa;

      stats.hits +=
        Number(item.hit);

      stats.strikeouts +=
        Number(item.strikeout);

      stats.walks +=
        Number(item.walk);

      stats.hbp +=
        Number(item.hbp);

      stats.tee +=
        Number(item.tee);

      stats.teeHits +=
        Number(item.teeHit);

      stats.credited +=
        item.credited;

      stats.actual +=
        item.actual;

      stats.rbi +=
        integer(record.rbi);

      stats.teeOuts += Number(
        item.tee &&
        !item.teeHit &&
        [
          "파울 아웃",
          "삼진",
          "땅볼",
          "뜬공",
          "라인드라이브",
          "번트",
          "희생플라이"
        ].includes(item.result)
      );

      if (item.hit) {
        stats.totalBases +=
          item.bases;

        stats.doubles +=
          Number(item.bases === 2);

        stats.triples +=
          Number(item.bases === 3);

        stats.homeRuns +=
          Number(item.bases === 4);
      }

      if (
        !item.tee &&
        !item.free
      ) {
        stats.normal++;

        stats.normalContact +=
          Number(!item.strikeout);
      }
    });

    stats.avg = rate(
      stats.hits,
      stats.ab
    );

    stats.obp = rate(
      stats.credited,
      stats.pa
    );

    stats.actualObp = rate(
      stats.actual,
      stats.pa
    );

    stats.slg = rate(
      stats.totalBases,
      stats.ab
    );

    stats.ops =
      stats.obp === null ||
      stats.slg === null
        ? null
        : stats.obp + stats.slg;

    stats.axes = [
      [
        stats.hits,
        stats.ab
      ],
      [
        stats.walks + stats.hbp,
        stats.completed
      ],
      [
        stats.actual,
        stats.pa
      ],
      [
        stats.totalBases,
        4 * stats.ab
      ],
      [
        stats.teeHits,
        stats.tee
      ],
      [
        stats.normalContact,
        stats.normal
      ]
    ];

    stats.raw = stats.axes.map(
      ([numerator, denominator]) =>
        rate(numerator, denominator)
    );

    stats.adjusted = stats.axes.map(
      ([numerator, denominator]) =>
        adjustedRate(numerator, denominator)
    );

    const weights = [
      0.20,
      0.10,
      0.25,
      0.15,
      0.20,
      0.10
    ];

    stats.attack = stats.adjusted.reduce(
      (sum, value, index) =>
        sum + value * weights[index],
      0
    ) * 100;

    return stats;
  }

  /* =====================================================
     투수 통계
  ===================================================== */

  function pitchingStats(records) {
    const stats = {
      faced: records.length,

      pitches: 0,
      strikes: 0,
      balls: 0,

      strikeouts: 0,
      hits: 0,
      tee: 0,
      runs: 0,

      types: {
        S: 0,
        B: 0,
        F: 0,
        SW: 0
      }
    };

    records.forEach(record => {
      const item =
        classify(record);

      stats.strikeouts +=
        Number(item.strikeout);

      stats.hits +=
        Number(item.hit);

      stats.tee +=
        Number(item.tee);

      stats.runs +=
        integer(record.runs);

      const pitches = Array.isArray(record.pitches)
        ? record.pitches
        : [];

      pitches.forEach(pitch => {
        /*
          티바 파울 TF는 투수가 던진 공이 아니므로
          투구수와 스트라이크 비율에서 제외합니다.
        */
        if (
          !Object.prototype.hasOwnProperty.call(
            stats.types,
            pitch
          )
        ) {
          return;
        }

        stats.types[pitch]++;
        stats.pitches++;

        if (pitch === "B") {
          stats.balls++;
        } else {
          stats.strikes++;
        }
      });
    });

    stats.strikeRate = rate(
      stats.strikes,
      stats.pitches
    );

    stats.score = (
      0.5 * adjustedRate(
        stats.strikes,
        stats.pitches
      ) +

      0.3 * adjustedRate(
        stats.faced - stats.hits,
        stats.faced
      ) +

      0.2 * adjustedRate(
        stats.strikeouts,
        stats.faced
      )
    ) * 100;

    return stats;
  }

  /* =====================================================
     리포트 날짜 범위
  ===================================================== */

  function selectedGames(scope = "range") {
    if (scope === "current") {
      return [game];
    }

    const from =
      $("dvFrom").value;

    const to =
      $("dvTo").value;

    return allGames().filter(saved =>
      (!from || saved.date >= from) &&
      (!to || saved.date <= to)
    );
  }

  function validRange() {
    const from =
      $("dvFrom").value;

    const to =
      $("dvTo").value;

    if (
      from &&
      to &&
      from > to
    ) {
      alert(
        "시작일이 종료일보다 늦어요."
      );

      return false;
    }

    return true;
  }

  /* =====================================================
     선수별 누적 프로필
  ===================================================== */

  function profiles(scope = "range") {
    const map = new Map();

    function get(team, name, position = "") {
      name =
        String(name || "").trim();

      if (!name) return null;

      const key =
        JSON.stringify([team, name]);

      if (!map.has(key)) {
        map.set(key, {
          key,
          team,
          name,

          role: "other",

          bat: [],
          pitch: [],

          spray: [],
          zone: [],

          games: []
        });
      }

      const player =
        map.get(key);

      if (position === "투수") {
        player.role = "P";
      } else if (
        position === "포수" &&
        player.role !== "P"
      ) {
        player.role = "C";
      }

      return player;
    }

    selectedGames(scope).forEach(saved => {
      TEAMS.forEach(team => {
        saved.lineups[team].forEach(player => {
          get(
            teamName(team, saved),
            player.name,
            player.position
          );
        });
      });

      saved.plateAppearances.forEach(record => {
        const team =
          recordOffense(record);

        const batter = get(
          teamName(team, saved),
          record.batter,
          record.position
        );

        if (batter) {
          batter.bat.push(record);
        }

        const pitchingTeam =
          team === "home"
            ? "away"
            : "home";

        const pitcher = get(
          teamName(pitchingTeam, saved),
          record.pitcher
        );

        if (pitcher) {
          pitcher.pitch.push(record);
          pitcher.role = "P";
        }
      });

      map.forEach(player => {
        const records =
          saved.plateAppearances.filter(record =>
            record.batter === player.name &&
            teamName(
              recordOffense(record),
              saved
            ) === player.team
          );

        if (records.length) {
          player.games.push({
            label:
              `${saved.date} ` +
              `${saved.awayTeamName}–${saved.homeTeamName}`,

            date: saved.date,

            stats:
              battingStats(records)
          });
        }
      });

      ["spray", "zone"].forEach(kind => {
        saved[`${kind}Points`].forEach(point => {
          if (
            !point ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y)
          ) {
            return;
          }

          const name = kind === "spray"
            ? point.batter
            : point.pitcher;

          if (!name) return;

          let team = point.team;

          if (!team && point.half) {
            const battingTeam =
              point.half === "top"
                ? "away"
                : "home";

            const fieldingTeam =
              battingTeam === "home"
                ? "away"
                : "home";

            team = teamName(
              kind === "spray"
                ? battingTeam
                : fieldingTeam,
              saved
            );
          }

          if (!team) return;

          const player =
            get(team, name);

          if (player) {
            player[kind].push(point);
          }
        });
      });
    });

    return [...map.values()]
      .map(player => {
        player.stats =
          battingStats(player.bat);

        player.pitchStats =
          pitchingStats(player.pitch);

        player.total =
          0.75 * player.stats.attack +
          0.25 * (
            player.pitchStats.faced
              ? player.pitchStats.score
              : 50
          );

        return player;
      })
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          "ko"
        )
      );
  }

  /* =====================================================
     통계 카드 / 막대그래프
  ===================================================== */

  function statCards(items) {
    return `
      <div class="dv-stats">
        ${items.map(([label, value]) => `
          <div>
            <span>${escape(label)}</span>
            <strong>${escape(value)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function bars(
    items,
    fixedMax = null,
    color = "#ff4057"
  ) {
    if (!items.length) {
      return `
        <p class="dv-note">
          기록이 없습니다.
        </p>
      `;
    }

    const max = fixedMax ?? Math.max(
      1,
      ...items.map(item =>
        number(item[1])
      )
    );

    return items.map(
      ([label, value, text]) => `
        <div class="dv-bar">
          <span>${escape(label)}</span>

          <div class="dv-track">
            <div
              class="dv-fill"
              style="
                width:${
                  Math.max(
                    0,
                    Math.min(
                      100,
                      number(value) / max * 100
                    )
                  )
                }%;
                background:${color};
              "
            ></div>
          </div>

          <b>${escape(text ?? value)}</b>
        </div>
      `
    ).join("");
  }

  function resultBars(records) {
    const counts = new Map();

    records.forEach(record => {
      const result =
        record.result || "미분류";

      counts.set(
        result,
        (counts.get(result) || 0) + 1
      );
    });

    return bars([...counts]);
  }

  function inningBars(saved = game) {
    const max = Math.max(
      saved.currentInning,

      ...TEAMS.flatMap(team =>
        Object.keys(
          saved.inningScores[team]
        ).map(Number)
      ),

      1
    );

    const awayItems = Array.from(
      { length: max },
      (_, index) => [
        `${index + 1}회 ${saved.awayTeamName}`,

        number(
          saved.inningScores.away[index + 1]
        )
      ]
    );

    const homeItems = Array.from(
      { length: max },
      (_, index) => [
        `${index + 1}회 ${saved.homeTeamName}`,

        number(
          saved.inningScores.home[index + 1]
        )
      ]
    );

    /*
      양 팀 그래프에 동일한 최대값을 적용하여
      같은 득점이 같은 길이로 표시되도록 합니다.
    */
    const sharedMax = Math.max(
      1,
      ...awayItems.map(item => item[1]),
      ...homeItems.map(item => item[1])
    );

    return (
      bars(
        awayItems,
        sharedMax,
        "#2e6cff"
      ) +

      bars(
        homeItems,
        sharedMax,
        "#ff4057"
      )
    );
  }

  /* =====================================================
     SBO 육각형
  ===================================================== */

  function radar(stats) {
    const centerX = 210;
    const centerY = 165;
    const radius = 105;

    function point(index, value) {
      const angle =
        -Math.PI / 2 +
        index * Math.PI / 3;

      return [
        centerX +
        Math.cos(angle) * radius * value,

        centerY +
        Math.sin(angle) * radius * value
      ];
    }

    const polygon = values =>
      values.map(
        (value, index) =>
          point(index, value).join(",")
      ).join(" ");

    return `
      <svg
        viewBox="0 0 420 335"
        role="img"
        aria-label="SBO 육각형 분석"
      >
        ${
          [0.2, 0.4, 0.6, 0.8, 1]
            .map(level => `
              <polygon
                points="${
                  polygon(
                    Array(6).fill(level)
                  )
                }"
                fill="none"
                stroke="#d4dce6"
              />

              <text
                x="${centerX + 5}"
                y="${centerY - radius * level + 4}"
                font-size="9"
                fill="#8190a4"
              >
                ${Math.round(level * 100)}
              </text>
            `)
            .join("")
        }

        ${
          AXIS_NAMES.map((name, index) => {
            const [x, y] =
              point(index, 1);

            const [textX, textY] =
              point(index, 1.3);

            return `
              <line
                x1="${centerX}"
                y1="${centerY}"
                x2="${x}"
                y2="${y}"
                stroke="#d4dce6"
              />

              <text
                x="${textX}"
                y="${textY}"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="12"
                fill="#243247"
              >
                ${escape(name)}
              </text>
            `;
          }).join("")
        }

        <polygon
          points="${polygon(stats.adjusted)}"
          fill="#2e6cff25"
          stroke="#2e6cff"
          stroke-width="2"
        />

        <polygon
          points="${
            polygon(
              stats.raw.map(value =>
                value ?? 0
              )
            )
          }"
          fill="#ff405725"
          stroke="#ff4057"
          stroke-width="2"
        />

        <text
          x="210"
          y="319"
          text-anchor="middle"
          font-size="10"
          fill="#526176"
        >
          빨강: 실제 비율 / 파랑: 표본 보정
        </text>

        <text
          x="210"
          y="332"
          text-anchor="middle"
          font-size="9"
          fill="#526176"
        >
          미기록 실제값은 0 위치, 표에서는 — 표시
        </text>
      </svg>
    `;
  }

  /* =====================================================
     타구 / 투구 위치 기록
  ===================================================== */

  function drawPoints(kind) {
    const element = $(
      kind === "spray"
        ? "dvSpray"
        : "dvZone"
    );

    element
      .querySelectorAll(".dv-point")
      .forEach(point => {
        point.remove();
      });

    game[`${kind}Points`].forEach(point => {
      if (
        !point ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y)
      ) {
        return;
      }

      const dot =
        document.createElement("i");

      dot.className = "dv-point";

      dot.style.left = `${
        Math.max(
          0,
          Math.min(1, point.x)
        ) * 100
      }%`;

      dot.style.top = `${
        Math.max(
          0,
          Math.min(1, point.y)
        ) * 100
      }%`;

      element.appendChild(dot);
    });
  }

  function recordPoint(event, kind) {
    readDraft();

    const name = kind === "spray"
      ? game.draft.batter
      : game.draft.pitcher;

    if (!name) {
      return alert(
        "타자·투수 이름을 먼저 입력해주세요."
      );
    }

    checkpoint();

    const rect =
      event.currentTarget.getBoundingClientRect();

    const battingTeam =
      offense();

    const fieldingTeam =
      battingTeam === "home"
        ? "away"
        : "home";

    game[`${kind}Points`].push({
      x: Math.max(
        0,
        Math.min(
          1,
          (event.clientX - rect.left) / rect.width
        )
      ),

      y: Math.max(
        0,
        Math.min(
          1,
          (event.clientY - rect.top) / rect.height
        )
      ),

      batter:
        game.draft.batter,

      pitcher:
        game.draft.pitcher,

      team: teamName(
        kind === "spray"
          ? battingTeam
          : fieldingTeam
      ),

      half: game.isTopInning
        ? "top"
        : "bottom",

      inning:
        game.currentInning
    });

    commit("point");
  }

  function clearPoints(kind) {
    if (
      !confirm(
        "현재 경기의 해당 위치 기록을 모두 지울까요?"
      )
    ) {
      return;
    }

    checkpoint();

    game[`${kind}Points`] = [];

    commit("point");
  }

  /* =====================================================
     리포트용 위치 그래프
  ===================================================== */

  function locationChart(
    points,
    zone = false
  ) {
    if (!points.length) {
      return `
        <p class="dv-note">
          선수 정보가 연결된 위치 기록이 없습니다.
        </p>
      `;
    }

    if (zone) {
      const counts =
        Array(9).fill(0);

      points.forEach(point => {
        const column = Math.max(
          0,
          Math.min(
            2,
            Math.floor(point.x * 3)
          )
        );

        const row = Math.max(
          0,
          Math.min(
            2,
            Math.floor(point.y * 3)
          )
        );

        counts[row * 3 + column]++;
      });

      const max = Math.max(
        1,
        ...counts
      );

      return `
        <svg
          viewBox="0 0 300 300"
          role="img"
          aria-label="투구 위치 열지도"
        >
          ${
            counts.map((count, index) => {
              const x =
                index % 3 * 100;

              const y =
                Math.floor(index / 3) * 100;

              return `
                <rect
                  x="${x}"
                  y="${y}"
                  width="100"
                  height="100"
                  fill="rgba(255,64,87,${
                    0.05 + 0.75 * count / max
                  })"
                  stroke="#73849a"
                />

                <text
                  x="${x + 50}"
                  y="${y + 55}"
                  text-anchor="middle"
                  font-size="22"
                  fill="#172033"
                >
                  ${count}
                </text>
              `;
            }).join("")
          }
        </svg>
      `;
    }

    return `
      <svg
        viewBox="0 0 400 300"
        role="img"
        aria-label="타구 위치"
      >
        <path
          d="M20 290 Q0 15 200 10 Q400 15 380 290 Z"
          fill="#e3efdf"
          stroke="#80a079"
        />

        <path
          d="M200 280 L70 60 M200 280 L330 60"
          stroke="#8fab87"
          fill="none"
        />

        <text
          x="200"
          y="297"
          text-anchor="middle"
          font-size="12"
        >
          HOME
        </text>

        ${
          points.map(point => `
            <circle
              cx="${
                Math.max(
                  0,
                  Math.min(1, point.x)
                ) * 400
              }"
              cy="${
                Math.max(
                  0,
                  Math.min(1, point.y)
                ) * 280
              }"
              r="5"
              fill="#e82e50"
              opacity=".75"
            />
          `).join("")
        }
      </svg>
    `;
  }

  /* =====================================================
     실시간 화면 갱신
  ===================================================== */

  function render() {
    $("dvToday").textContent =
      game.date.replaceAll("-", ". ");

    $("dvInning").textContent =
      inningText();

    $("dvHomeScore").textContent =
      game.homeScore;

    $("dvAwayScore").textContent =
      game.awayScore;

    $("dvBalls").textContent =
      game.ballCount;

    $("dvStrikes").textContent =
      game.strikeCount;

    $("dvOuts").textContent =
      game.outCount;

    BASES.forEach((base, index) => {
      $(`dvBase${index + 1}`)
        .classList
        .toggle(
          "active",
          game.baseState[base]
        );

      const inputId = [
        "dvRunnerFirst",
        "dvRunnerSecond",
        "dvRunnerThird"
      ][index];

      $(inputId).value =
        game.runners[base] || "";
    });

    $("dvManualOuts").value =
      Math.min(2, game.outCount);

    const team =
      offense();

    const players =
      validLineup(team);

    const index =
      game.battingOrderIndex[team];

    $("dvOffense").textContent =
      `${team.toUpperCase()} · ${teamName(team)}`;

    $("dvCurrentBatter").textContent =
      players.length
        ? (
            `${players[index % players.length].order}번 ` +
            `${players[index % players.length].name}`
          )
        : game.draft.batter || "라인업 없음";

    $("dvNextBatter").textContent =
      players.length
        ? players[
            (index + 1) % players.length
          ].name
        : "—";

    $("dvHomeLineupTitle").textContent =
      game.homeTeamName;

    $("dvAwayLineupTitle").textContent =
      game.awayTeamName;

    $("dvSequence").innerHTML =
      pitchChips(game.currentPitchSequence);

    $("dvSelectedResult").textContent =
      game.selectedPlateResult
        ? `선택 결과: ${game.selectedPlateResult}`
        : game.isTeeMode
          ? (
              `${game.teeReason} → 티바 · ` +
              `${game.strikeCount}스트라이크`
            )
          : "선택 결과: 없음";

    $("dvResultButtons")
      .querySelectorAll("button")
      .forEach(element => {
        element.disabled =
          game.isTeeMode &&
          ["홈런", "데드볼"].includes(
            element.dataset.value
          );
      });

    $("dvRecordBody").innerHTML =
      game.plateAppearances.length
        ? game.plateAppearances
            .map((record, recordIndex) => `
              <tr>
                <td>
                  ${escape(record.inning)}
                </td>

                <td>
                  ${escape(record.pitcher)}
                </td>

                <td>
                  ${button(
                    escape(record.batter),
                    "showRecord",
                    `data-index="${recordIndex}"`
                  )}
                </td>

                <td>
                  ${escape(record.result)}
                  ${record.extraOuts ? " · 병살" : ""}
                </td>

                <td>
                  ${integer(record.runs)}
                </td>

                <td>
                  ${escape(record.scoreAfter)}
                </td>
              </tr>
            `)
            .reverse()
            .join("")
        : `
          <tr>
            <td colspan="6">
              아직 기록이 없습니다.
            </td>
          </tr>
        `;

    $("dvRunnerLog").innerHTML =
      game.events
        .slice(-5)
        .reverse()
        .map(event => `
          <p class="dv-note">
            ${escape(event.inning)}
            ·
            ${escape(event.text)}
          </p>
        `)
        .join("");

    drawPoints("spray");
    drawPoints("zone");

    renderAnalysis();
  }

  /* =====================================================
     실시간 타자 / 투수 / 팀 분석
  ===================================================== */

  function renderAnalysis() {
    const people =
      profiles("current");

    const hitters =
      people.filter(player =>
        player.bat.length
      );

    const pitchers =
      people.filter(player =>
        player.pitch.length
      );

    $("dvBatterStats").innerHTML =
      hitters.map(player => {
        const stats =
          player.stats;

        return `
          <div class="dv-card">
            <h3>
              ${escape(player.name)}
              ·
              ${escape(player.team)}
            </h3>

            ${statCards([
              [
                "타석 / 타수",
                `${stats.pa} / ${stats.ab}`
              ],
              [
                "타율",
                decimal(stats.avg)
              ],
              [
                "출루율",
                decimal(stats.obp)
              ],
              [
                "실출루율",
                decimal(stats.actualObp)
              ],
              [
                "일반 안타",
                stats.hits
              ],
              [
                "티바 안타",
                stats.teeHits
              ],
              [
                "타점",
                stats.rbi
              ],
              [
                "삼진",
                stats.strikeouts
              ]
            ])}
          </div>
        `;
      }).join("") ||
      "타석을 저장하면 표시됩니다.";

    $("dvPitcherStats").innerHTML =
      pitchers.map(player => {
        const stats =
          player.pitchStats;

        return `
          <div class="dv-card">
            <h3>
              ${escape(player.name)}
              ·
              ${escape(player.team)}
            </h3>

            ${statCards([
              [
                "상대 타자",
                stats.faced
              ],
              [
                "투구수",
                stats.pitches
              ],
              [
                "스트라이크",
                percentage(stats.strikeRate)
              ],
              [
                "삼진",
                stats.strikeouts
              ],
              [
                "일반 피안타",
                stats.hits
              ],
              [
                "티바 전환",
                stats.tee
              ],
              [
                "타석 발생 득점",
                stats.runs
              ],
              [
                "볼",
                stats.balls
              ]
            ])}
          </div>
        `;
      }).join("") ||
      "타석을 저장하면 표시됩니다.";

    $("dvInningChart").innerHTML =
      inningBars();

    $("dvResultChart").innerHTML =
      resultBars(
        game.plateAppearances
      );

    const mvp = [...hitters].sort((a, b) =>
      (
        b.stats.hits * 3 +
        b.stats.teeHits +
        b.stats.rbi * 2
      ) -
      (
        a.stats.hits * 3 +
        a.stats.teeHits +
        a.stats.rbi * 2
      )
    )[0];

    $("dvMvp").innerHTML = mvp
      ? `
        <h3>
          ${escape(mvp.name)}
          ·
          ${escape(mvp.team)}
        </h3>

        <p>
          일반 안타 ${mvp.stats.hits}
          · 티바 안타 ${mvp.stats.teeHits}
          · 타점 ${mvp.stats.rbi}
        </p>

        <p class="dv-note">
          참고 선정:
          일반 안타×3 + 티바 안타 + 타점×2
        </p>
      `
      : "경기 기록이 없습니다.";

    $("dvTeamCompare").innerHTML =
      TEAMS.map(team => {
        const records =
          game.plateAppearances.filter(record =>
            recordOffense(record) === team
          );

        const stats =
          battingStats(records);

        return `
          <h3>
            ${escape(teamName(team))}
          </h3>

          ${statCards([
            [
              "득점",
              game[`${team}Score`]
            ],
            [
              "일반 안타",
              stats.hits
            ],
            [
              "티바 안타",
              stats.teeHits
            ],
            [
              "실출루율",
              decimal(stats.actualObp)
            ]
          ])}
        `;
      }).join("");

    const highlights =
      game.plateAppearances
        .map((record, index) => ({
          record,
          index
        }))
        .filter(({ record }) =>
          ["홈런", "3루타"].includes(
            normalizeResult(record.result)
          ) ||
          integer(record.runs) >= 2 ||
          integer(record.rbi) >= 2
        )
        .slice(-5)
        .reverse();

    $("dvHighlights").innerHTML = `
      <h3>주요 장면</h3>

      ${
        highlights.map(({ record, index }) => `
          <p>
            ${escape(record.inning)}
            ·
            ${escape(record.batter)}
            ·
            ${escape(record.result)}

            ${button(
              "영상",
              "jump",
              `data-index="${index}"`
            )}
          </p>
        `).join("") ||
        `
          <p class="dv-note">
            주요 장면이 없습니다.
          </p>
        `
      }
    `;
  }

  // 6번 코드를 바로 아래에 이어 붙여주세요.
  /* =====================================================
     리포트 선택 목록
  ===================================================== */

  function fillSelect(id, options) {
    const select = $(id);
    const previous = select.value;

    select.innerHTML = `
      <option value="">선택해주세요</option>
    `;

    options.forEach(([value, label]) => {
      const option =
        document.createElement("option");

      option.value = value;
      option.textContent = label;

      select.appendChild(option);
    });

    if (
      options.some(
        ([value]) => value === previous
      )
    ) {
      select.value = previous;
    }
  }

  function refreshReportSelectors() {
    fillSelect(
      "dvCurrentPlayer",

      profiles("current").map(player => [
        player.key,
        `${player.name} · ${player.team}`
      ])
    );

    fillSelect(
      "dvReportPlayer",

      profiles("range").map(player => [
        player.key,
        `${player.name} · ${player.team}`
      ])
    );

    const names = [...new Set(
      selectedGames().flatMap(saved => [
        saved.homeTeamName,
        saved.awayTeamName
      ])
    )];

    fillSelect(
      "dvReportTeam",

      names.map(name => [
        name,
        name
      ])
    );
  }

  /* =====================================================
     리포트 공통 지표
  ===================================================== */

  function metricCards(stats) {
    return statCards([
      [
        "전체 완료 타석",
        stats.completed
      ],
      [
        "요청 타석 / 타수",
        `${stats.pa} / ${stats.ab}`
      ],
      [
        "타율",
        decimal(stats.avg)
      ],
      [
        "출루율",
        decimal(stats.obp)
      ],
      [
        "실출루율",
        decimal(stats.actualObp)
      ],
      [
        "장타율",
        decimal(stats.slg)
      ],
      [
        "OPS",
        decimal(stats.ops)
      ],
      [
        "타점",
        stats.rbi
      ]
    ]);
  }

  function rulesHTML() {
    return `
      <div class="dv-rules">
        <b>SBO 요청 지표 기준</b>
        <br>

        타수 = 일반 안타 + 일반 삼진.
        <br>

        요청 타석 =
        일반 안타 + 일반 삼진 +
        볼넷·사구·티바 전환 타석.
        일반 땅볼·뜬공 등은 이 요청 타수·타석에서 제외하고
        ‘전체 완료 타석’에 따로 표시합니다.
        <br>

        타율 = 일반 안타 ÷ 요청 타수.
        <br>

        출루율 =
        일반 안타 또는 볼넷·사구·티바 전환이 발생한 타석
        ÷ 요청 타석.
        <br>

        실출루율 =
        일반 안타 또는 티바 안타 또는
        티바를 거치지 않은 사구 출루
        ÷ 요청 타석.
        한 타석은 분자에 한 번만 반영합니다.
        실책·야수선택 출루는 이 요청 지표에서 제외합니다.
        <br>

        티바 안타는 일반 안타·장타율에서 분리합니다.
        장타율 = 일반 타격 총루타 ÷ 요청 타수.
        OPS = 출루율 + 장타율.
        <br>

        투수 투구수에서 티바 파울(TF)은 제외합니다.
        ‘타석 발생 득점’은 해당 투수 상대 타석에서 발생한
        팀 득점이며, 주자 책임을 추적한
        공식 실점·자책점 지표가 아닙니다.
      </div>
    `;
  }

  /* =====================================================
     육각형 세부 계산표
  ===================================================== */

  function axisTable(stats) {
    const formulas = [
      "일반 안타 / 요청 타수",
      "(볼넷 + 사구) / 전체 완료 타석",
      "실제 출루 / 요청 타석",
      "일반 총루타 / (요청 타수 × 4)",
      "티바 안타 / 티바 타석",
      "(일반 타격 타석 − 일반 삼진) / 일반 타격 타석"
    ];

    return `
      <div class="dv-scroll">
        <table>
          <thead>
            <tr>
              <th>축</th>
              <th>계산</th>
              <th>표본</th>
              <th>실제 비율</th>
              <th>보정 점수</th>
            </tr>
          </thead>

          <tbody>
            ${
              stats.axes.map(
                ([numerator, denominator], index) => `
                  <tr>
                    <td>
                      ${AXIS_NAMES[index]}
                    </td>

                    <td>
                      ${formulas[index]}
                    </td>

                    <td>
                      ${numerator}/${denominator}
                    </td>

                    <td>
                      ${percentage(stats.raw[index])}
                    </td>

                    <td>
                      ${
                        (
                          stats.adjusted[index] * 100
                        ).toFixed(1)
                      }
                    </td>
                  </tr>
                `
              ).join("")
            }
          </tbody>
        </table>
      </div>

      <p class="dv-note">
        보정 = (분자 + 5) ÷ (분모 + 10) × 100.
        미기록 지표는 중립값 50점으로 시작합니다.
        일반 타격 타석은 티바·볼넷·사구를 제외한
        완료 타석입니다.
      </p>
    `;
  }

  /* =====================================================
     리포트용 타석 상세표
  ===================================================== */

  function playTable(records) {
    return `
      <div class="dv-scroll">
        <table>
          <thead>
            <tr>
              <th>회차</th>
              <th>타자</th>
              <th>투수</th>
              <th>결과</th>
              <th>득점</th>
              <th>타점</th>
              <th>메모</th>
            </tr>
          </thead>

          <tbody>
            ${
              records.map(record => `
                <tr>
                  <td>
                    ${escape(record.inning)}
                  </td>

                  <td>
                    ${escape(record.batter)}
                  </td>

                  <td>
                    ${escape(record.pitcher)}
                  </td>

                  <td>
                    ${escape(record.result)}
                    ${record.extraOuts ? " · 병살" : ""}
                  </td>

                  <td>
                    ${integer(record.runs)}
                  </td>

                  <td>
                    ${integer(record.rbi)}
                  </td>

                  <td>
                    ${escape(record.note || "—")}
                  </td>
                </tr>
              `).join("") ||
              `
                <tr>
                  <td colspan="7">
                    기록 없음
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      </div>
    `;
  }

  /* =====================================================
     선수별 요약표
  ===================================================== */

  function playerSummaryTable(people) {
    return `
      <div class="dv-scroll">
        <table>
          <thead>
            <tr>
              <th>선수</th>
              <th>팀</th>
              <th>타석/타수</th>
              <th>일반 안타</th>
              <th>티바 안타</th>
              <th>타율</th>
              <th>실출루율</th>
              <th>타점</th>
            </tr>
          </thead>

          <tbody>
            ${
              people.map(player => `
                <tr>
                  <td>
                    ${escape(player.name)}
                  </td>

                  <td>
                    ${escape(player.team)}
                  </td>

                  <td>
                    ${player.stats.pa}/${player.stats.ab}
                  </td>

                  <td>
                    ${player.stats.hits}
                  </td>

                  <td>
                    ${player.stats.teeHits}
                  </td>

                  <td>
                    ${decimal(player.stats.avg)}
                  </td>

                  <td>
                    ${decimal(player.stats.actualObp)}
                  </td>

                  <td>
                    ${player.stats.rbi}
                  </td>
                </tr>
              `).join("") ||
              `
                <tr>
                  <td colspan="8">
                    선수 기록이 없습니다.
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      </div>
    `;
  }

  /* =====================================================
     상황별 타격
  ===================================================== */

  function splitStats(records) {
    return [
      [
        "주자 없음",

        records.filter(record =>
          record.baseBefore === "주자 없음"
        )
      ],
      [
        "주자 있음",

        records.filter(record =>
          /[123]루/.test(
            record.baseBefore || ""
          )
        )
      ],
      [
        "득점권",

        records.filter(record =>
          /[23]루/.test(
            record.baseBefore || ""
          )
        )
      ],
      [
        "2아웃",

        records.filter(record =>
          Number(record.outsBefore) === 2
        )
      ]
    ].map(([label, list]) => [
      label,
      battingStats(list)
    ]);
  }

  /* =====================================================
     선수 리포트
     current: 현재 경기
     range: 날짜 범위 누적
  ===================================================== */

  function playerReport(scope) {
    if (
      scope === "range" &&
      !validRange()
    ) {
      return;
    }

    const selectId =
      scope === "current"
        ? "dvCurrentPlayer"
        : "dvReportPlayer";

    const key =
      $(selectId).value;

    const player =
      profiles(scope).find(item =>
        item.key === key
      );

    if (!player) {
      return alert(
        "리포트 선수를 선택해주세요."
      );
    }

    const stats =
      player.stats;

    const pitching =
      player.pitchStats;

    const splits =
      splitStats(player.bat);

    const dateLabel =
      scope === "current"
        ? game.date
        : (
            `${$("dvFrom").value || "전체 시작"} ~ ` +
            `${$("dvTo").value || "전체 종료"}`
          );

    $("dvReportOutput").innerHTML = `
      <article class="dv-paper">
        <h1>
          DIAMOND VISION · 선수 리포트
        </h1>

        <p>
          <b>${escape(player.name)}</b>
          ·
          ${escape(player.team)}
          ·
          ${escape(dateLabel)}
        </p>

        ${metricCards(stats)}

        <h2>SBO 육각형 분석</h2>

        <div class="dv-grid">
          <div class="dv-chart">
            ${radar(stats)}
          </div>

          <div class="dv-chart">
            <h3>타석 결과 분포</h3>

            ${resultBars(player.bat)}
          </div>
        </div>

        ${axisTable(stats)}

        <h2>일반 타격 · 티바 구분</h2>

        ${statCards([
          [
            "일반 안타",
            stats.hits
          ],
          [
            "2루타",
            stats.doubles
          ],
          [
            "3루타",
            stats.triples
          ],
          [
            "홈런",
            stats.homeRuns
          ],
          [
            "일반 삼진",
            stats.strikeouts
          ],
          [
            "볼넷",
            stats.walks
          ],
          [
            "사구",
            stats.hbp
          ],
          [
            "티바 타석",
            stats.tee
          ],
          [
            "티바 안타",
            stats.teeHits
          ],
          [
            "티바 아웃",
            stats.teeOuts
          ],
          [
            "티바 안타율",
            percentage(
              rate(
                stats.teeHits,
                stats.tee
              )
            )
          ],
          [
            "일반 총루타",
            stats.totalBases
          ]
        ])}

        <h2>경기별 변화</h2>

        <div class="dv-grid">
          <div class="dv-chart">
            <h3>타율</h3>

            ${
              bars(
                player.games.map(saved => [
                  saved.label,
                  saved.stats.avg ?? 0,
                  decimal(saved.stats.avg)
                ]),
                1
              )
            }
          </div>

          <div class="dv-chart">
            <h3>실출루율</h3>

            ${
              bars(
                player.games.map(saved => [
                  saved.label,
                  saved.stats.actualObp ?? 0,
                  decimal(saved.stats.actualObp)
                ]),
                1,
                "#2e6cff"
              )
            }
          </div>
        </div>

        <h2>상황별 타격</h2>

        ${
          bars(
            splits.map(([label, item]) => [
              label,
              item.actualObp ?? 0,
              decimal(item.actualObp)
            ]),
            1
          )
        }

        <div class="dv-scroll">
          <table>
            <thead>
              <tr>
                <th>상황</th>
                <th>완료 타석</th>
                <th>요청 타석</th>
                <th>일반 안타</th>
                <th>티바 안타</th>
                <th>실출루율</th>
              </tr>
            </thead>

            <tbody>
              ${
                splits.map(([label, item]) => `
                  <tr>
                    <td>${label}</td>
                    <td>${item.completed}</td>
                    <td>${item.pa}</td>
                    <td>${item.hits}</td>
                    <td>${item.teeHits}</td>
                    <td>${decimal(item.actualObp)}</td>
                  </tr>
                `).join("")
              }
            </tbody>
          </table>
        </div>

        <p class="dv-note">
          각 상황은 서로 겹칠 수 있습니다.
          주자 정보가 없는 이전 기록은
          주자별 분류에서 제외합니다.
        </p>

        <h2>투수 분석</h2>

        ${statCards([
          [
            "상대 타자",
            pitching.faced
          ],
          [
            "투구수",
            pitching.pitches
          ],
          [
            "스트라이크 비율",
            percentage(pitching.strikeRate)
          ],
          [
            "일반 삼진",
            pitching.strikeouts
          ],
          [
            "일반 피안타",
            pitching.hits
          ],
          [
            "티바 전환",
            pitching.tee
          ],
          [
            "볼",
            pitching.balls
          ],
          [
            "타석 발생 득점",
            pitching.runs
          ]
        ])}

        ${
          bars(
            Object.entries(pitching.types),
            null,
            "#2e6cff"
          )
        }

        <p class="dv-note">
          S: 스트라이크 · B: 볼 · F: 파울 · SW: 헛스윙.
          티바 파울은 투수의 투구 기록에서 제외합니다.
        </p>

        <h2>타구 · 투구 위치</h2>

        <div class="dv-grid">
          <div class="dv-chart">
            <h3>
              타구 위치 · ${player.spray.length}개
            </h3>

            ${locationChart(player.spray)}
          </div>

          <div class="dv-chart">
            <h3>
              투구 열지도 · ${player.zone.length}개
            </h3>

            ${locationChart(player.zone, true)}
          </div>
        </div>

        <p class="dv-note">
          선수에게 연결된 수동 위치 기록만 표시합니다.
        </p>

        <h2>팀 편성 평가</h2>

        ${statCards([
          [
            "공격 점수",
            stats.attack.toFixed(1)
          ],
          [
            "투구 점수",
            pitching.faced
              ? pitching.score.toFixed(1)
              : "미기록 · 50"
          ],
          [
            "종합 점수",
            player.total.toFixed(1)
          ],
          [
            "타격 / 투구 표본",
            `${stats.completed} / ${pitching.faced}`
          ]
        ])}

        <p class="dv-note">
          공격 점수는 육각형 보정 지표를 순서대로
          20·10·25·15·20·10% 반영합니다.
          투구 점수는 보정 스트라이크율 50%,
          일반 피안타 회피율 30%, 삼진율 20%입니다.
          종합 점수는 공격 75% + 투구 25%이며,
          투구 미기록은 50점을 사용합니다.
          수비·주력·상대 수준을 포함하지 않은
          앱 내부 참고 평가입니다.
        </p>

        <h2>타자 타석 상세</h2>

        ${playTable(player.bat)}

        <h2>투수 상대 타석 상세</h2>

        ${playTable(player.pitch)}

        ${rulesHTML()}
      </article>
    `;
  }

  /* =====================================================
     현재 경기 리포트
  ===================================================== */

  function gameReport() {
    const home = battingStats(
      game.plateAppearances.filter(record =>
        recordOffense(record) === "home"
      )
    );

    const away = battingStats(
      game.plateAppearances.filter(record =>
        recordOffense(record) === "away"
      )
    );

    const people =
      profiles("current").filter(player =>
        player.bat.length
      );

    $("dvReportOutput").innerHTML = `
      <article class="dv-paper">
        <h1>
          DIAMOND VISION · 경기 리포트
        </h1>

        <p>
          ${escape(game.date)}
          ·
          ${escape(game.awayTeamName)}
          ${game.awayScore}
          :
          ${game.homeScore}
          ${escape(game.homeTeamName)}
        </p>

        <p>
          기록 시점:
          ${escape(inningText())}
          · 저장된 경기 상황 기준
        </p>

        ${statCards([
          [
            "HOME 득점",
            game.homeScore
          ],
          [
            "AWAY 득점",
            game.awayScore
          ],
          [
            "전체 완료 타석",
            game.plateAppearances.length
          ],
          [
            "일반 / 티바 안타",
            (
              `${home.hits + away.hits} / ` +
              `${home.teeHits + away.teeHits}`
            )
          ]
        ])}

        <h2>이닝별 득점 흐름</h2>

        ${inningBars()}

        <h2>팀별 SBO 육각형</h2>

        <div class="dv-grid">
          <div class="dv-chart">
            <h3>
              ${escape(game.homeTeamName)}
            </h3>

            ${radar(home)}
          </div>

          <div class="dv-chart">
            <h3>
              ${escape(game.awayTeamName)}
            </h3>

            ${radar(away)}
          </div>
        </div>

        <h2>팀 지표 비교</h2>

        <div class="dv-scroll">
          <table>
            <thead>
              <tr>
                <th>팀</th>
                <th>완료 타석</th>
                <th>타석/타수</th>
                <th>타율</th>
                <th>출루율</th>
                <th>실출루율</th>
                <th>티바 안타</th>
              </tr>
            </thead>

            <tbody>
              ${
                [
                  ["home", home],
                  ["away", away]
                ].map(([team, stats]) => `
                  <tr>
                    <td>
                      ${escape(teamName(team))}
                    </td>

                    <td>
                      ${stats.completed}
                    </td>

                    <td>
                      ${stats.pa}/${stats.ab}
                    </td>

                    <td>
                      ${decimal(stats.avg)}
                    </td>

                    <td>
                      ${decimal(stats.obp)}
                    </td>

                    <td>
                      ${decimal(stats.actualObp)}
                    </td>

                    <td>
                      ${stats.teeHits}
                    </td>
                  </tr>
                `).join("")
              }
            </tbody>
          </table>
        </div>

        <h2>타석 결과 분포</h2>

        ${resultBars(game.plateAppearances)}

        <h2>선수별 타격 요약</h2>

        ${playerSummaryTable(people)}

        <h2>타석 상세</h2>

        ${playTable(game.plateAppearances)}

        <h2>주루 · 점수 수정 기록</h2>

        ${
          game.events.map(event => `
            <p>
              ${escape(event.inning)}
              ·
              ${escape(event.text)}
            </p>
          `).join("") ||
          "<p>별도 기록 없음</p>"
        }

        ${rulesHTML()}
      </article>
    `;
  }

  /* =====================================================
     팀 누적 리포트
  ===================================================== */

  function teamReport() {
    if (!validRange()) return;

    const name =
      $("dvReportTeam").value;

    if (!name) {
      return alert(
        "팀을 선택해주세요."
      );
    }

    const rows = [];
    const records = [];

    selectedGames().forEach(saved => {
      TEAMS.forEach(team => {
        if (
          teamName(team, saved) !== name
        ) {
          return;
        }

        const own =
          saved.plateAppearances.filter(record =>
            recordOffense(record) === team
          );

        const opponentTeam =
          team === "home"
            ? "away"
            : "home";

        records.push(...own);

        rows.push({
          date: saved.date,

          opponent:
            teamName(opponentTeam, saved),

          runs:
            saved[`${team}Score`],

          allowed:
            saved[`${opponentTeam}Score`],

          stats:
            battingStats(own)
        });
      });
    });

    const stats =
      battingStats(records);

    const people =
      profiles().filter(player =>
        player.team === name &&
        player.bat.length
      );

    $("dvReportOutput").innerHTML = `
      <article class="dv-paper">
        <h1>
          DIAMOND VISION · 팀 누적 리포트
        </h1>

        <p>
          ${escape(name)}
          ·
          ${escape($("dvFrom").value || "전체 시작")}
          ~
          ${escape($("dvTo").value || "전체 종료")}
        </p>

        ${statCards([
          [
            "기록 경기 수",
            rows.length
          ],
          [
            "총 득점",
            rows.reduce(
              (sum, row) =>
                sum + row.runs,
              0
            )
          ],
          [
            "상대 득점",
            rows.reduce(
              (sum, row) =>
                sum + row.allowed,
              0
            )
          ],
          [
            "타격 기록 선수",
            people.length
          ]
        ])}

        <h2>누적 타격 지표</h2>

        ${metricCards(stats)}

        <div
          class="dv-grid"
          style="margin-top:18px"
        >
          <div class="dv-chart">
            <h3>SBO 육각형</h3>

            ${radar(stats)}
          </div>

          <div class="dv-chart">
            <h3>결과 분포</h3>

            ${resultBars(records)}
          </div>
        </div>

        ${axisTable(stats)}

        <h2>경기별 득점</h2>

        ${
          bars(
            rows.map(row => [
              `${row.date} · ${row.opponent}`,
              row.runs
            ])
          )
        }

        <h2>경기별 실출루율</h2>

        ${
          bars(
            rows.map(row => [
              `${row.date} · ${row.opponent}`,
              row.stats.actualObp ?? 0,
              decimal(row.stats.actualObp)
            ]),
            1,
            "#2e6cff"
          )
        }

        <h2>선수 비교</h2>

        ${playerSummaryTable(people)}

        <p class="dv-note">
          진행 중 경기도 포함될 수 있어
          승패를 자동 확정하지 않습니다.
        </p>

        ${rulesHTML()}
      </article>
    `;
  }

  /* =====================================================
     리포트 인쇄
  ===================================================== */

  function printReport() {
    if (
      !$("dvReportOutput").querySelector(".dv-paper")
    ) {
      return alert(
        "먼저 리포트를 생성해주세요."
      );
    }

    window.print();
  }

  // 7번 코드를 바로 아래에 이어 붙여주세요.
  /* =====================================================
     리포트 기반 균형 팀 편성
  ===================================================== */

  function loadRoster() {
    if (!validRange()) return;

    const people = profiles();

    rosterKeys = people.map(player => player.key);

    $("dvRoster").innerHTML = people.map((player, index) => `
      <tr>
        <td>
          <input
            id="dvJoin${index}"
            type="checkbox"
            checked
            aria-label="${escape(player.name)} 참가"
          >
        </td>

        <td>${escape(player.name)}</td>
        <td>${escape(player.team)}</td>
        <td>${player.stats.completed}</td>
        <td>${player.total.toFixed(1)}</td>

        <td>
          <select id="dvRole${index}">
            <option
              value="other"
              ${player.role === "other" ? "selected" : ""}
            >
              야수
            </option>

            <option
              value="P"
              ${player.role === "P" ? "selected" : ""}
            >
              투수
            </option>

            <option
              value="C"
              ${player.role === "C" ? "selected" : ""}
            >
              포수
            </option>
          </select>
        </td>
      </tr>
    `).join("") || `
      <tr>
        <td colspan="6">
          해당 기간의 선수 기록이 없습니다.
        </td>
      </tr>
    `;
  }

  function teamMean(team) {
    return team.length
      ? team.reduce(
          (sum, player) => sum + number(player.total),
          0
        ) / team.length
      : 0;
  }

  function teamCost(teams) {
    const means = teams.map(teamMean);

    let cost =
      Math.max(...means) -
      Math.min(...means);

    ["P", "C"].forEach(role => {
      const counts = teams.map(team =>
        team.filter(player => player.role === role).length
      );

      cost += (
        Math.max(...counts) -
        Math.min(...counts)
      ) * 150;
    });

    return cost;
  }

  function makeTeams() {
    if (!validRange()) return;

    if (!rosterKeys.length) {
      return alert(
        "먼저 리포트 선수를 불러와주세요."
      );
    }

    const fresh = new Map(
      profiles().map(player => [
        player.key,
        player
      ])
    );

    const selected = rosterKeys.flatMap((key, index) => {
      const player = fresh.get(key);

      if (
        !$(`dvJoin${index}`)?.checked ||
        !player
      ) {
        return [];
      }

      return [{
        key,

        name: player.name,
        team: player.team,

        total: player.total,
        attack: player.stats.attack,

        pitch: player.pitchStats.faced
          ? player.pitchStats.score
          : 50,

        sample: player.stats.completed,
        role: $(`dvRole${index}`).value
      }];
    });

    const count = Number(
      $("dvTeamCount").value
    );

    if (selected.length < count) {
      return alert(
        "팀 수보다 참가 선수가 적어요."
      );
    }

    selected.sort((a, b) =>
      b.total - a.total ||
      a.name.localeCompare(b.name, "ko")
    );

    const teams = Array.from(
      { length: count },
      () => []
    );

    /*
      지그재그 배분으로 팀별 인원 차이를
      최대 1명으로 맞춥니다.
    */
    selected.forEach((player, index) => {
      const row = Math.floor(index / count);
      const column = index % count;

      const target = row % 2
        ? count - 1 - column
        : column;

      teams[target].push(player);
    });

    /*
      선수끼리 교환하여 인원수를 유지하면서
      점수와 투수·포수 분배 편차를 줄입니다.
    */
    for (let pass = 0; pass < 40; pass++) {
      let bestCost = teamCost(teams);
      let bestSwap = null;

      for (let a = 0; a < count; a++) {
        for (let b = a + 1; b < count; b++) {
          for (let i = 0; i < teams[a].length; i++) {
            for (let j = 0; j < teams[b].length; j++) {
              [teams[a][i], teams[b][j]] = [
                teams[b][j],
                teams[a][i]
              ];

              const cost = teamCost(teams);

              [teams[a][i], teams[b][j]] = [
                teams[b][j],
                teams[a][i]
              ];

              if (cost < bestCost - 0.0001) {
                bestCost = cost;
                bestSwap = [a, b, i, j];
              }
            }
          }
        }
      }

      if (!bestSwap) break;

      const [a, b, i, j] = bestSwap;

      [teams[a][i], teams[b][j]] = [
        teams[b][j],
        teams[a][i]
      ];
    }

    database.teamPlan = {
      createdAt: new Date().toISOString(),
      from: $("dvFrom").value,
      to: $("dvTo").value,
      teams
    };

    saveGame();
    renderTeams(database.teamPlan);
  }

  function renderTeams(plan) {
    if (
      !Array.isArray(plan?.teams) ||
      !plan.teams.every(team =>
        Array.isArray(team) &&
        team.every(player =>
          player &&
          typeof player === "object"
        )
      )
    ) {
      return alert(
        "저장된 팀 편성 형식을 읽지 못했어요."
      );
    }

    const teams = plan.teams;

    if (!teams.length) return;

    const means = teams.map(teamMean);

    const gap =
      Math.max(...means) -
      Math.min(...means);

    const all = teams.flat();

    const warning = ["P", "C"]
      .map(role => {
        const count = all.filter(
          player => player.role === role
        ).length;

        return count < teams.length
          ? (
              `${role === "P" ? "투수" : "포수"}가 ` +
              "팀 수보다 적어 모든 팀에 배치할 수 없습니다."
            )
          : "";
      })
      .filter(Boolean)
      .join(" ");

    $("dvTeamOutput").innerHTML = `
      <p>
        팀 평균 점수 차이:
        <b>${gap.toFixed(1)}</b>점

        ·
        ${escape(plan.from || "전체")}
        ~
        ${escape(plan.to || "전체")}
      </p>

      <div class="dv-grid">
        ${teams.map((team, index) => `
          <div class="dv-team-plan">
            <h3>
              ${String.fromCharCode(65 + index)}팀
              · ${team.length}명
            </h3>

            <p>
              평균 ${teamMean(team).toFixed(1)}점

              · 투수 ${
                team.filter(
                  player => player.role === "P"
                ).length
              }

              · 포수 ${
                team.filter(
                  player => player.role === "C"
                ).length
              }
            </p>

            <ul>
              ${team.map(player => `
                <li>
                  ${escape(player.name)}
                  · ${escape(player.team)}

                  · ${
                    {
                      P: "투수",
                      C: "포수",
                      other: "야수"
                    }[player.role] || "야수"
                  }

                  · ${number(player.total).toFixed(1)}점

                  ${
                    number(player.sample) < 5
                      ? " · 소표본"
                      : ""
                  }
                </li>
              `).join("")}
            </ul>
          </div>
        `).join("")}
      </div>

      ${
        warning
          ? `<p class="dv-note">${escape(warning)}</p>`
          : ""
      }

      <p class="dv-note">
        인원 차이는 최대 1명으로 맞추고
        투수·포수 분배와 평균 점수 차이를 줄인 제안입니다.
        가능한 모든 조합의 최적해를 보장하지 않습니다.
        표본이 적거나 수비·주력 정보가 없는 선수는
        실제 경기력과 차이가 날 수 있습니다.
        위 결과는 생성 당시 리포트 점수로 저장됩니다.
      </p>
    `;
  }

  /* =====================================================
     로컬 영상
  ===================================================== */

  function loadLocalVideo(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    youtubePlayer?.pauseVideo?.();

    if (localVideoURL) {
      URL.revokeObjectURL(localVideoURL);
    }

    localVideoURL =
      URL.createObjectURL(file);

    $("dvVideo").src = localVideoURL;
    $("dvVideo").hidden = false;
    $("dvYoutubeWrap").hidden = true;

    $("dvVideo").load();
  }

  /* =====================================================
     유튜브
  ===================================================== */

  function extractYouTubeId(value) {
    const text =
      String(value || "").trim();

    if (/^[A-Za-z0-9_-]{11}$/.test(text)) {
      return text;
    }

    try {
      const url = new URL(text);

      const host = url.hostname.replace(
        /^www\./,
        ""
      );

      let id = "";

      if (host === "youtu.be") {
        id = url.pathname.split("/")[1];
      } else if (
        [
          "youtube.com",
          "m.youtube.com",
          "youtube-nocookie.com"
        ].includes(host)
      ) {
        id =
          url.searchParams.get("v") ||
          url.pathname.match(
            /^\/(?:embed|shorts|live)\/([^/]+)/
          )?.[1] ||
          "";
      }

      return /^[A-Za-z0-9_-]{11}$/.test(id)
        ? id
        : "";
    } catch {
      return "";
    }
  }

  function setupYouTube() {
    if (
      !window.YT?.Player ||
      youtubePlayer ||
      !$("dvYoutubePlayer")
    ) {
      return;
    }

    youtubePlayer = new window.YT.Player(
      "dvYoutubePlayer",
      {
        width: "100%",
        height: "100%",

        playerVars: {
          playsinline: 1,
          controls: 1,
          rel: 0
        },

        events: {
          onReady() {
            youtubeReady = true;

            if (youtubeId) {
              youtubePlayer.cueVideoById(
                youtubeId
              );
            }
          },

          onError() {
            alert(
              "유튜브 주소 또는 영상의 외부 재생 허용 여부를 확인해주세요."
            );
          }
        }
      }
    );
  }

  window.onYouTubeIframeAPIReady =
    setupYouTube;

  function loadYouTube() {
    const id = extractYouTubeId(
      $("dvYoutubeUrl").value
    );

    if (!id) {
      return alert(
        "유튜브 영상 주소를 확인해주세요."
      );
    }

    youtubeId = id;

    $("dvVideo").pause();
    $("dvVideo").hidden = true;
    $("dvYoutubeWrap").hidden = false;

    if (youtubeReady) {
      youtubePlayer.cueVideoById(id);
    } else if (window.YT?.Player) {
      setupYouTube();
    } else if (
      !document.querySelector(
        'script[src*="youtube.com/iframe_api"]'
      )
    ) {
      const script =
        document.createElement("script");

      script.src =
        "https://www.youtube.com/iframe_api";

      script.onerror = () => {
        alert(
          "유튜브 연결을 불러오지 못했어요."
        );
      };

      document.head.appendChild(script);
    }

    saveGame();
  }

  function isYouTube() {
    return (
      !$("dvYoutubeWrap").hidden &&
      youtubeReady
    );
  }

  function currentVideoTime() {
    return isYouTube()
      ? number(
          youtubePlayer.getCurrentTime()
        )
      : number(
          $("dvVideo").currentTime
        );
  }

  function seekVideo(delta) {
    const time = Math.max(
      0,
      currentVideoTime() + delta
    );

    if (isYouTube()) {
      youtubePlayer.seekTo(time, true);
    } else if ($("dvVideo").src) {
      const end =
        Number.isFinite($("dvVideo").duration)
          ? $("dvVideo").duration
          : time;

      $("dvVideo").currentTime =
        Math.min(time, end);
    }
  }

  function playPause() {
    if (isYouTube()) {
      if (
        youtubePlayer.getPlayerState() === 1
      ) {
        youtubePlayer.pauseVideo();
      } else {
        youtubePlayer.playVideo();
      }
    } else {
      const video = $("dvVideo");

      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }

  function setSpeed(speed) {
    if (isYouTube()) {
      youtubePlayer.setPlaybackRate(speed);
    } else {
      $("dvVideo").playbackRate = speed;
    }
  }

  function jumpToRecord(index) {
    const record =
      game.plateAppearances[index];

    if (!record) return;

    if (
      record.videoSource &&
      record.videoSource !== "local"
    ) {
      if (
        !isYouTube() ||
        youtubeId !== record.videoSource
      ) {
        $("dvYoutubeUrl").value =
          record.videoSource;

        loadYouTube();

        return alert(
          "해당 영상을 불러왔어요. " +
          "준비되면 영상 버튼을 다시 눌러주세요."
        );
      }

      youtubePlayer.seekTo(
        number(record.videoTime),
        true
      );
    } else {
      if (!$("dvVideo").src) {
        return alert(
          "이 경기의 원본 영상 파일을 먼저 불러와주세요."
        );
      }

      youtubePlayer?.pauseVideo?.();

      $("dvYoutubeWrap").hidden = true;
      $("dvVideo").hidden = false;

      const video = $("dvVideo");
      const time = number(record.videoTime);

      if (video.readyState >= 1) {
        video.currentTime = Math.min(
          time,
          Number.isFinite(video.duration)
            ? video.duration
            : time
        );
      } else {
        video.addEventListener(
          "loadedmetadata",
          () => {
            video.currentTime = Math.min(
              time,
              Number.isFinite(video.duration)
                ? video.duration
                : time
            );
          },
          { once: true }
        );
      }
    }

    $("dvVideoSection").scrollIntoView({
      behavior: "smooth"
    });
  }

  /* =====================================================
     버튼 연결
  ===================================================== */

  function handleAction(event) {
    const target =
      event.target.closest("[data-action]");

    if (
      !target ||
      target.disabled
    ) {
      return;
    }

    readDraft();

    const data = target.dataset;
    const value = Number(data.value);
    const index = Number(data.index);

    switch (data.action) {
      case "save":
        saveGame(true);
        break;

      case "newGame":
        newGame();
        break;

      case "load":
        loadGame();
        break;

      case "export":
        exportBackup();
        break;

      case "import":
        $("dvImportFile").click();
        break;

      case "allDates":
        $("dvDateFilter").value = "";
        renderArchives();
        break;

      case "score":
        changeScore(data.team, value);
        break;

      case "editScore":
        editInningScore();
        break;

      case "inning":
        changeInning(value);
        break;

      case "base":
        toggleBase(data.base);
        break;

      case "situation":
        applySituation();
        break;

      case "runner":
        runnerAction(data.kind);
        break;

      case "undoAction":
        undoAction();
        break;

      case "pitch":
        addPitch(data.value);
        break;

      case "result":
        setResult(data.value);
        break;

      case "undoInput":
        undoInput();
        break;

      case "savePlate":
        savePlate();
        break;

      case "saveLineups":
        saveLineups();
        break;

      case "clearLineups":
        clearLineups();
        break;

      case "undoPlate":
        undoPlate();
        break;

      case "clearRecords":
        clearRecords();
        break;

      case "showRecord":
        showRecord(index);
        break;

      case "editRecord":
        editRecord(index);
        break;

      case "clearPoints":
        clearPoints(data.kind);
        break;

      case "gameReport":
        gameReport();
        break;

      case "playerReport":
        playerReport(data.scope);
        break;

      case "teamReport":
        teamReport();
        break;

      case "print":
        printReport();
        break;

      case "roster":
        loadRoster();
        break;

      case "makeTeams":
        makeTeams();
        break;

      case "restoreTeams":
        if (database.teamPlan) {
          renderTeams(database.teamPlan);
        } else {
          alert(
            "저장된 팀 편성이 없어요."
          );
        }
        break;

      case "youtube":
        loadYouTube();
        break;

      case "seek":
        seekVideo(value);
        break;

      case "play":
        playPause();
        break;

      case "speed":
        setSpeed(value);
        break;

      case "jump":
        jumpToRecord(index);
        break;
    }
  }

  /* =====================================================
     프로그램 시작
  ===================================================== */

  function start() {
    buildInterface();

    let initial;

    try {
      initial = initializeStorage();
    } catch (error) {
      storageBlocked = true;

      storageError =
        "기존 데이터를 읽지 못했습니다. " +
        "원본 보호를 위해 저장을 중단했어요. " +
        "백업을 내보내주세요.";

      initial = blankGame();

      console.error(error);
    }

    ready = true;

    installGame(initial);
    renderArchives();

    if (!storageBlocked) {
      saveGame();
    } else {
      status(storageError, true);
    }

    $("dvRoot").addEventListener(
      "click",
      handleAction
    );

    $("dvImportFile").addEventListener(
      "change",
      importBackup
    );

    $("dvVideoFile").addEventListener(
      "change",
      loadLocalVideo
    );

    $("dvDateFilter").addEventListener(
      "change",
      renderArchives
    );

    $("dvDate").addEventListener(
      "change",
      () => {
        if (
          !validDate($("dvDate").value)
        ) {
          return;
        }

        game.date =
          $("dvDate").value;

        invalidateReport();
        render();
        saveGame();
        refreshReportSelectors();
      }
    );

    [
      "dvHomeName",
      "dvAwayName"
    ].forEach(id => {
      $(id).addEventListener(
        "change",
        () => {
          readDraft();

          invalidateReport();
          render();
          saveGame();
          refreshReportSelectors();
        }
      );
    });

    Object.values(DRAFT_IDS).forEach(id => {
      $(id).addEventListener(
        "input",
        () => {
          clearTimeout(saveTimer);

          saveTimer = setTimeout(
            () => saveGame(),
            350
          );
        }
      );

      $(id).addEventListener(
        "change",
        () => saveGame()
      );
    });

    [
      "dvFrom",
      "dvTo"
    ].forEach(id => {
      $(id).addEventListener(
        "change",
        () => {
          refreshReportSelectors();

          rosterKeys = [];
          $("dvRoster").innerHTML = "";
        }
      );
    });

    $("dvSpray").addEventListener(
      "click",
      event => recordPoint(
        event,
        "spray"
      )
    );

    $("dvZone").addEventListener(
      "click",
      event => recordPoint(
        event,
        "zone"
      )
    );

    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.visibilityState === "hidden"
        ) {
          saveGame();
        }
      }
    );

    window.addEventListener(
      "pagehide",
      () => saveGame()
    );

    window.addEventListener(
      "storage",
      event => {
        if (
          (event.key === DB_KEY || event.key === null) &&
          ready
        ) {
          storageBlocked = true;

          storageError =
            "다른 탭에서 저장 데이터가 변경되었습니다. " +
            "현재 내용을 백업한 뒤 새로고침해주세요.";

          status(storageError, true);
        }
      }
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }

})();