/* =========================================================
   DIAMOND VISION 확장 기능
   기존 app.js 맨 아래에 추가
========================================================= */

(() => {
    "use strict";

    const ARCHIVE = "diamondVisionGamesV3";
    const ACTIVE = "diamondVisionActiveGameV3";
    const clone = value => JSON.parse(JSON.stringify(value));
    const el = id => document.getElementById(id);
    const esc = value => escapeHtml(value);
    const hitResults = ["안타", "2루타", "3루타", "홈런"];
    const outResults = [
        "삼진", "파울 아웃", "땅볼", "뜬공",
        "라인드라이브", "희생플라이", "번트"
    ];

    function today() {
        const date = new Date();
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function uid() {
        return globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function readJSON(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch {
            return fallback;
        }
    }

    function integer(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number)
            ? Math.max(0, Math.floor(number))
            : fallback;
    }

    let extension = {
        id: localStorage.getItem(ACTIVE) || uid(),
        date: today(),
        rule: "sbo",
        inputHistory: [],
        corrections: [],
        runners: { first: "", second: "", third: "" }
    };

    let ready = false;
    let storageFailed = false;
    let openedRecord = -1;
    let currentReport = null;

    const original = {
        save: saveGameState,
        load: loadGameState,
        draw: drawAllResults,
        savePlate: savePlateAppearance,
        snapshot: createGameSnapshot,
        resetPlate: resetCurrentPlateAppearance,
        applyResult: applyPlateResult,
        undoPlate: undoLastPlateAppearance,
        clearRecords: clearAllPlateAppearances,
        video: loadVideo,
        spray: recordSpray,
        zone: recordZone
    };

    /* -----------------------------------------------------
       추가 화면과 스타일
    ----------------------------------------------------- */

    function installUI() {
        // 기존 HTML의 중복 ID와 중복 제목 정리
        document.querySelectorAll("#pitchSequence")
            .forEach((node, index) => {
                if (index > 0) node.remove();
            });

        const resultTitles = [
            ...document.querySelectorAll(".scoring-panel h3")
        ].filter(node => node.textContent.trim() === "타석 결과");

        resultTitles.slice(1).forEach(node => node.remove());

        const style = document.createElement("style");

        style.textContent = `
            .dv-toolbar {
                display:flex; flex-wrap:wrap; gap:10px;
                align-items:end; margin:14px 0;
            }
            .dv-toolbar label {
                display:grid; gap:6px;
                color:var(--muted); font-size:13px;
            }
            .dv-toolbar input,.dv-toolbar select,
            .dv-editor input,.dv-editor select,
            .dv-editor textarea {
                min-width:0; max-width:100%;
                border:1px solid #31445f;
                border-radius:10px; padding:11px;
                background:#081425; color:#eef4ff;
                font:inherit;
            }
            .dv-toolbar button,.dv-button,.dv-editor button {
                border:1px solid #31445f;
                border-radius:10px; padding:11px 14px;
                background:#142238; color:#eef4ff;
                font:inherit; cursor:pointer;
            }
            .dv-note {color:var(--muted);line-height:1.65;font-size:13px}
            .dv-status {color:#36e68b;font-size:13px}
            .dv-error {color:#ff8592}
            .dv-archive {margin-bottom:18px}
            .dv-score-controls {display:flex;gap:5px;flex-wrap:wrap}
            .dv-score-controls button {
                border:1px solid #ffffff50;border-radius:8px;
                background:#00000025;color:white;padding:7px 10px;
            }
            .dv-editor {
                margin-top:16px;padding:16px;border:1px solid #31445f;
                border-radius:14px;background:#07111f;
            }
            .dv-editor-grid {
                display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
                gap:10px;
            }
            .dv-editor-grid label {display:grid;gap:6px;font-size:13px}
            .dv-record-button {
                background:transparent;border:0;color:#8bb8ff;
                padding:0;text-decoration:underline;
            }
            .dv-report-grid {
                display:grid;grid-template-columns:1fr 1fr;
                gap:16px;margin:18px 0;
            }
            .dv-chart {
                border:1px solid #cbd5e1;border-radius:10px;
                padding:14px;break-inside:avoid;
            }
            .dv-chart h3 {margin:0 0 12px;font-size:15px}
            .dv-bar-row {
                display:grid;grid-template-columns:minmax(70px,1fr) 2fr 55px;
                gap:8px;align-items:center;margin:9px 0;
                font-size:12px;
            }
            .dv-track {height:13px;background:#e2e8f0;border-radius:8px}
            .dv-fill {height:100%;border-radius:8px;background:#e73553}
            .dv-bar-row b {text-align:right}
            .dv-report-note {font-size:12px;color:#64748b}
            .dv-report-paper {white-space:normal}
            .dv-report-paper table {table-layout:auto}
            .dv-report-paper td,.dv-report-paper th {
                white-space:normal;overflow-wrap:anywhere;
            }
            .dv-report-paper svg {width:100%;height:auto;display:block}
            .dv-report-paper h2 {break-after:avoid}
            .dv-runner-row {display:flex;gap:8px;flex-wrap:wrap}
            .dv-runner-row label {flex:1;min-width:110px}
            #dvRecordDetail [hidden] {display:none}
            @media(max-width:760px) {
                .dv-editor-grid,.dv-report-grid {grid-template-columns:1fr}
                .dv-toolbar>* {max-width:100%}
                .team {flex-wrap:wrap}
                .dv-score-controls {width:100%}
                .dv-report-paper {padding:16px}
            }
            @media print {
                .dv-chart,.report-stat-grid {break-inside:avoid}
                .dv-track,.dv-fill {
                    -webkit-print-color-adjust:exact;
                    print-color-adjust:exact;
                }
                .dv-report-paper {white-space:normal}
                .report-output {white-space:normal}
                .dv-report-grid {grid-template-columns:1fr 1fr}
            }
        `;

        document.head.appendChild(style);

        const archive = document.createElement("section");
        archive.className = "panel dv-archive";
        archive.id = "dvArchive";

        archive.innerHTML = `
            <div class="section-kicker">GAME ARCHIVE</div>
            <h2>경기 저장 · 불러오기</h2>

            <div class="dv-toolbar">
                <label>현재 경기 날짜
                    <input id="dvGameDate" type="date">
                </label>
                <button id="dvSaveGame" type="button">현재 경기 저장</button>
                <button id="dvNewGame" type="button">새 경기</button>
                <button id="dvBackup" type="button">전체 백업 저장</button>
                <button id="dvImportButton" type="button">백업 불러오기</button>
                <input id="dvImport" type="file" accept=".json,application/json" hidden>
            </div>

            <div class="dv-toolbar">
                <label>저장 경기 날짜 검색
                    <input id="dvDateFilter" type="date">
                </label>
                <button id="dvShowAll" type="button">전체 날짜</button>
                <label style="flex:1;min-width:200px">저장된 경기
                    <select id="dvSavedGames"></select>
                </label>
                <button id="dvLoadGame" type="button">선택 경기 열기</button>
            </div>

            <div class="dv-toolbar">
                <label>통계 계산 기준
                    <select id="dvRule">
                        <option value="sbo">SBO 요청식</option>
                        <option value="baseball">일반 타수 기준</option>
                    </select>
                </label>
            </div>

            <p id="dvRuleDescription" class="dv-note"></p>
            <p class="dv-note">
                이 브라우저에 자동 저장됩니다.
                다른 기기로 옮기려면 전체 백업을 저장한 뒤 불러오세요.
                로컬 영상 파일은 백업에 포함되지 않습니다.
            </p>
            <div id="dvSaveStatus" class="dv-status" role="status"></div>
        `;

        document.querySelector("main.content")?.prepend(archive);

        ["home", "away"].forEach(team => {
            const controls = document.createElement("div");
            controls.className = "dv-score-controls";
            controls.innerHTML = `
                <button type="button" data-score-team="${team}" data-delta="-1">−1</button>
                <button type="button" data-score-team="${team}" data-delta="1">+1</button>
                <button type="button" data-score-edit="${team}">점수 수정</button>
            `;
            el(`${team}Score`)?.parentElement.appendChild(controls);
        });

        const runners = document.createElement("section");
        runners.className = "panel";
        runners.style.marginTop = "18px";
        runners.innerHTML = `
            <div class="section-kicker">BASE RUNNERS</div>
            <h2>주자 · 아웃 상황 수정</h2>
            <div class="dv-toolbar dv-runner-row">
                <label>1루 주자<input id="dvRunnerFirst" placeholder="이름 또는 주자"></label>
                <label>2루 주자<input id="dvRunnerSecond" placeholder="이름 또는 주자"></label>
                <label>3루 주자<input id="dvRunnerThird" placeholder="이름 또는 주자"></label>
                <label>아웃
                    <select id="dvOuts">
                        <option value="0">0아웃</option>
                        <option value="1">1아웃</option>
                        <option value="2">2아웃</option>
                    </select>
                </label>
                <button id="dvApplyRunners" type="button">현재 상황 적용</button>
            </div>
            <p class="dv-note">
                빈칸은 주자 없음입니다. 도루·주루 아웃·추가 진루는 여기서 수정하세요.
                타석의 득점은 팀 득점이며 개인 득점으로 계산하지 않습니다.
            </p>
        `;

        document.querySelector(".current-strip")?.after(runners);

        const detail = document.createElement("div");
        detail.id = "dvRecordDetail";
        detail.className = "dv-editor";
        detail.textContent = "최근 타석에서 선수 이름을 누르면 투구 순서와 상세 기록을 확인할 수 있습니다.";
        el("recordTableBody")?.closest(".table-wrap")?.after(detail);

        const runInput = getRunInputElement();

        if (runInput) {
            runInput.placeholder = "빈칸이면 자동 계산";
            runInput.value = "";
            runInput.title = "빈칸: 자동 득점 / 숫자: 직접 지정한 득점";
        }

        // 표의 열 수는 기존 6개 유지
        const head = el("recordTableBody")?.closest("table")?.querySelector("thead tr");
        if (head) {
            head.innerHTML = `
                <th>회차</th><th>투수</th><th>타자</th>
                <th>결과</th><th>득점</th><th>스코어</th>
            `;
        }

        el("dvGameDate").value = extension.date;
        el("dvRule").value = extension.rule;

        el("dvGameDate").addEventListener("change", event => {
            if (!event.target.value) return;
            extension.date = event.target.value;
            updateDateLabel();
            saveGameState();
        });

        el("dvRule").addEventListener("change", event => {
            extension.rule = event.target.value;
            explainRules();
            rebuildStatistics();
            drawAllResults();
            saveGameState();
        });

        el("dvSaveGame").onclick = () => saveGameState();
        el("dvNewGame").onclick = newGame;
        el("dvBackup").onclick = exportBackup;
        el("dvImportButton").onclick = () => el("dvImport").click();
        el("dvImport").onchange = importBackup;
        el("dvDateFilter").onchange = renderArchive;
        el("dvShowAll").onclick = () => {
            el("dvDateFilter").value = "";
            renderArchive();
        };
        el("dvLoadGame").onclick = loadArchivedGame;

        document.querySelectorAll("[data-score-team]").forEach(button => {
            button.onclick = () => changeScore(
                button.dataset.scoreTeam,
                Number(button.dataset.delta)
            );
        });

        document.querySelectorAll("[data-score-edit]").forEach(button => {
            button.onclick = () => editScore(button.dataset.scoreEdit);
        });

        el("dvApplyRunners").onclick = () => {
            extension.runners = {
                first: el("dvRunnerFirst").value.trim(),
                second: el("dvRunnerSecond").value.trim(),
                third: el("dvRunnerThird").value.trim()
            };

            for (const base of ["first", "second", "third"]) {
                baseState[base] = Boolean(extension.runners[base]);
            }

            outCount = Number(el("dvOuts").value);
            updateBaseDisplay();
            updateCountDisplay();
            saveGameState();
        };

        const targets = [
            "liveSection", "recordSection", "teamSection", "reportSection"
        ];

        document.querySelectorAll(".topnav button").forEach((button, index) => {
            button.onclick = () => el(targets[index])?.scrollIntoView({
                behavior: "smooth"
            });
        });

        document.querySelectorAll('[data-scroll="lineupSection"]').forEach(button => {
            button.addEventListener("click", () => {
                el("lineupSection")?.classList.remove("hidden");
            });
        });

        el("recordTableBody")?.addEventListener("click", event => {
            const button = event.target.closest("[data-dv-record]");
            if (button) showDetail(Number(button.dataset.dvRecord));
        });
    }

    function updateDateLabel() {
        if (el("todayDate")) {
            el("todayDate").textContent = extension.date.replaceAll("-", ". ");
        }
    }

    function explainRules() {
        const text = extension.rule === "sbo"
            ? "SBO 요청식: 타수 = 일반 안타 + 일반 삼진. 타석 = 타수 + 볼넷·사구 전환 타석. 일반 땅볼·뜬공 등은 요청식의 분모에서 제외됩니다."
            : "일반 타수 기준: 타석 = 모든 완료 타석. 타수에서는 볼넷·사구·희생플라이·희생번트를 제외합니다. 기존 ‘번트’ 기록은 희생번트로 처리합니다.";

        if (el("dvRuleDescription")) {
            el("dvRuleDescription").textContent = `${text}
                티바 타격은 최초 볼넷·사구로 분류하고 일반 안타와 구분합니다.
                출루율은 일반 안타 또는 볼넷·사구가 발생한 타석의 비율,
                실출루율은 일반 안타·직접 사구 출루·티바 안타로 실제 출루한 타석의 비율입니다.
                한 타석은 각 지표에서 한 번만 계산합니다.`;
        }
    }

    function syncRunners() {
        const ids = {
            first: "dvRunnerFirst",
            second: "dvRunnerSecond",
            third: "dvRunnerThird"
        };

        for (const base of Object.keys(ids)) {
            if (!baseState[base]) extension.runners[base] = "";
            if (baseState[base] && !extension.runners[base]) {
                extension.runners[base] = "주자";
            }
            if (el(ids[base])) el(ids[base]).value = extension.runners[base];
        }

        if (el("dvOuts")) el("dvOuts").value = String(Math.min(2, outCount));
    }

    /* -----------------------------------------------------
       저장 · 날짜별 경기 · 백업
    ----------------------------------------------------- */

    function getArchives() {
        const data = readJSON(ARCHIVE, []);
        return Array.isArray(data) ? data : [];
    }

    function status(message, failed = false) {
        const node = el("dvSaveStatus");
        if (!node) return;
        node.textContent = message;
        node.classList.toggle("dv-error", failed);
    }

    function currentState() {
        return {
            currentInning, isTopInning,
            ballCount, strikeCount, outCount,
            homeScore, awayScore,
            baseState, currentPitchSequence, selectedPlateResult,
            isTeeMode, teeReason, plateAppearances,
            lineups, battingOrderIndex, inningScores,
            homeTeamName: getHomeTeamName(),
            awayTeamName: getAwayTeamName(),
            sprayPoints, zonePoints,
            dvExtension: extension,
            dvDraft: {
                pitcher: el("pitcherName")?.value || "",
                batter: el("batterName")?.value || "",
                side: el("batterSide")?.value || "우타",
                runs: getRunInputElement()?.value ?? "",
                rbi: el("rbi")?.value || "0",
                note: el("playNote")?.value || "",
                youtube: el("youtubeUrl")?.value || ""
            }
        };
    }

    saveGameState = function () {
        if (!ready) return;

        try {
            const state = clone(currentState());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            localStorage.setItem(ACTIVE, extension.id);

            const games = getArchives();
            const item = {
                id: extension.id,
                date: extension.date,
                updated: new Date().toISOString(),
                state
            };
            const index = games.findIndex(game => game.id === extension.id);
            if (index >= 0) games[index] = item;
            else games.push(item);

            localStorage.setItem(ARCHIVE, JSON.stringify(games));
            storageFailed = false;
            status(`저장됨 · ${new Date().toLocaleTimeString("ko-KR")}`);
            renderArchive();
            return true;
        } catch (error) {
            storageFailed = true;
            status("브라우저 저장에 실패했습니다. 전체 백업으로 기록을 보관해 주세요.", true);
            console.error(error);
            return false;
        }
    };

    function renderArchive() {
        const select = el("dvSavedGames");
        if (!select) return;

        const previous = select.value;
        const date = el("dvDateFilter")?.value || "";

        select.replaceChildren();

        const games = getArchives()
            .filter(game => !date || game.date === date)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));

        games.forEach(game => {
            const state = game.state;
            const option = document.createElement("option");
            option.value = game.id;
            option.textContent =
                `${game.date} · ${state.awayTeamName || "AWAY"} ` +
                `${state.awayScore || 0} : ${state.homeScore || 0} ` +
                `${state.homeTeamName || "HOME"} · ` +
                `${state.plateAppearances?.length || 0}타석`;
            select.appendChild(option);
        });

        if (!games.length) {
            select.add(new Option("저장된 경기가 없습니다", ""));
        } else if (games.some(game => game.id === previous)) {
            select.value = previous;
        } else if (games.some(game => game.id === extension.id)) {
            select.value = extension.id;
        }
    }

    function loadArchivedGame() {
        const id = el("dvSavedGames").value;
        if (!id || id === extension.id) return;

        const game = getArchives().find(item => item.id === id);
        if (!game) return;
        if (!saveGameState()) return;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(game.state));
            localStorage.setItem(ACTIVE, game.id);
            location.reload();
        } catch {
            status("경기를 불러오지 못했습니다.", true);
        }
    }

    function newGame() {
        if (!saveGameState()) return;

        const date = el("dvGameDate").value || today();
        const id = uid();

        const state = {
            currentInning: 1,
            isTopInning: true,
            ballCount: 0, strikeCount: 0, outCount: 0,
            homeScore: 0, awayScore: 0,
            baseState: { first: false, second: false, third: false },
            currentPitchSequence: [],
            selectedPlateResult: "",
            isTeeMode: false, teeReason: "",
            plateAppearances: [],
            lineups: clone(lineups),
            battingOrderIndex: { home: 0, away: 0 },
            inningScores: { home: {}, away: {} },
            homeTeamName: getHomeTeamName(),
            awayTeamName: getAwayTeamName(),
            sprayPoints: [], zonePoints: [],
            dvExtension: {
                id, date, rule: extension.rule,
                inputHistory: [], corrections: [],
                runners: { first: "", second: "", third: "" }
            }
        };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            localStorage.setItem(ACTIVE, id);
            location.reload();
        } catch {
            status("새 경기를 만들지 못했습니다.", true);
        }
    }

    function exportBackup() {
        const games = getArchives();
        const current = {
            id: extension.id,
            date: extension.date,
            updated: new Date().toISOString(),
            state: clone(currentState())
        };
        const index = games.findIndex(game => game.id === current.id);
        if (index >= 0) games[index] = current;
        else games.push(current);

        const blob = new Blob([
            JSON.stringify({
                format: "diamond-vision",
                version: 3,
                exportedAt: new Date().toISOString(),
                games
            }, null, 2)
        ], { type: "application/json" });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `diamond-vision-${today()}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function importBackup(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const data = JSON.parse(await file.text());
            if (
                data.format !== "diamond-vision" ||
                !Array.isArray(data.games) ||
                data.games.some(game =>
                    !game.state ||
                    !Array.isArray(game.state.plateAppearances) ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(game.date || "")
                )
            ) {
                throw new Error("백업 형식이 올바르지 않습니다.");
            }

            const games = getArchives();

            // 현재 기록을 덮어쓰지 않고 별도 경기로 가져오기
            data.games.forEach(game => {
                const copy = clone(game);
                copy.id = uid();
                copy.state.dvExtension = {
                    ...(copy.state.dvExtension || {}),
                    id: copy.id,
                    date: copy.date
                };
                games.push(copy);
            });

            localStorage.setItem(ARCHIVE, JSON.stringify(games));
            renderArchive();
            status(`${data.games.length}개 경기를 가져왔습니다.`);
        } catch (error) {
            alert(`백업 불러오기 실패: ${error.message}`);
        } finally {
            event.target.value = "";
        }
    }

    /* -----------------------------------------------------
       입력 취소: 입력 전 상태를 그대로 복원
    ----------------------------------------------------- */

    function inputSnapshot() {
        return {
            ballCount, strikeCount,
            currentPitchSequence: [...currentPitchSequence],
            selectedPlateResult, isTeeMode, teeReason
        };
    }

    function rememberInput() {
        extension.inputHistory.push(inputSnapshot());
        if (extension.inputHistory.length > 300) {
            extension.inputHistory.shift();
        }
    }

    function refreshInput() {
        updateCountDisplay();
        updatePitchSequence();
        updateSelectedResult();
        updateTeeButtons();
        saveGameState();
    }

    function restoreInput(state) {
        ballCount = state.ballCount;
        strikeCount = state.strikeCount;
        currentPitchSequence = [...state.currentPitchSequence];
        selectedPlateResult = state.selectedPlateResult;
        isTeeMode = state.isTeeMode;
        teeReason = state.teeReason;
    }

    addPitch = function (type) {
        if (!["S", "B", "F", "SW"].includes(type)) return;

        if (selectedPlateResult) {
            alert("선택된 결과를 취소하거나 타석을 저장해 주세요.");
            return;
        }

        if (isTeeMode && type !== "F") {
            alert("티바 모드에서는 파울 또는 타격 결과를 입력해 주세요.");
            return;
        }

        rememberInput();

        if (isTeeMode) {
            currentPitchSequence.push("TF");
            strikeCount = Math.min(3, strikeCount + 1);
            if (strikeCount === 3) {
                selectedPlateResult = "티바 파울 아웃";
            }
        } else {
            currentPitchSequence.push(type);

            if (type === "B") {
                ballCount = Math.min(4, ballCount + 1);
                if (ballCount === 4) {
                    isTeeMode = true;
                    teeReason = "볼넷";
                }
            } else if (type === "F") {
                strikeCount = Math.min(2, strikeCount + 1);
            } else {
                strikeCount = Math.min(3, strikeCount + 1);
                if (strikeCount === 3) {
                    selectedPlateResult = "삼진";
                }
            }
        }

        refreshInput();
    };

    setPlateResult = function (result) {
        if (
            selectedPlateResult === "삼진" ||
            selectedPlateResult === "티바 파울 아웃"
        ) {
            alert("확정된 결과를 바꾸려면 마지막 입력 취소를 눌러 주세요.");
            return;
        }

        if (isTeeMode && ["홈런", "데드볼"].includes(result)) return;

        rememberInput();

        if (result === "데드볼") {
            isTeeMode = true;
            teeReason = "데드볼";
            selectedPlateResult = "";
        } else {
            selectedPlateResult = isTeeMode ? `티바 ${result}` : result;
        }

        refreshInput();
    };

    function replayPitches(sequence, hbp = false) {
        ballCount = 0;
        strikeCount = 0;
        isTeeMode = false;
        teeReason = "";
        selectedPlateResult = "";

        for (const pitch of sequence) {
            if (pitch === "B") {
                ballCount = Math.min(4, ballCount + 1);
                if (ballCount === 4) {
                    isTeeMode = true;
                    teeReason = "볼넷";
                }
            } else if (pitch === "F") {
                strikeCount = Math.min(2, strikeCount + 1);
            } else if (pitch === "TF") {
                isTeeMode = true;
                if (!teeReason) teeReason = hbp ? "데드볼" : "볼넷";
                strikeCount = Math.min(3, strikeCount + 1);
            } else if (pitch === "S" || pitch === "SW") {
                strikeCount = Math.min(3, strikeCount + 1);
            }
        }

        if (hbp) {
            isTeeMode = true;
            teeReason = "데드볼";
        }

        if (strikeCount >= 3) {
            selectedPlateResult = isTeeMode ? "티바 파울 아웃" : "삼진";
        }
    }

    undoCurrentInput = function () {
        const previous = extension.inputHistory.pop();

        if (previous) {
            restoreInput(previous);
            refreshInput();
            return;
        }

        // 확장 기능 설치 전에 저장된 타석도 처리
        const automatic = ["삼진", "티바 파울 아웃"].includes(selectedPlateResult);

        if (selectedPlateResult && !automatic) {
            selectedPlateResult = "";
        } else if (
            isTeeMode &&
            teeReason === "데드볼" &&
            !currentPitchSequence.includes("TF")
        ) {
            isTeeMode = false;
            teeReason = "";
            selectedPlateResult = "";
        } else if (currentPitchSequence.length) {
            const hbp = teeReason === "데드볼";
            currentPitchSequence.pop();
            replayPitches(currentPitchSequence, hbp);
        }

        refreshInput();
    };

    resetCurrentPlateAppearance = function () {
        original.resetPlate();
        extension.inputHistory = [];
        if (getRunInputElement()) getRunInputElement().value = "";
    };

    /* -----------------------------------------------------
       타석 저장 · 주자 이동 · 수동 득점
    ----------------------------------------------------- */

    createGameSnapshot = function () {
        return {
            ...original.snapshot(),
            dvInput: inputSnapshot(),
            dvRunners: clone(extension.runners),
            dvCorrectionCount: extension.corrections.length
        };
    };

    applyPlateResult = function (result, enteredRuns, tee) {
        const normalized = normalizeResult(result);
        const old = { ...baseState };
        const names = { ...extension.runners };
        const batter = el("batterName")?.value.trim() || "타자";
        const beforeHome = homeScore;
        const beforeAway = awayScore;
        const beforeInning = Number(
            inningScores[getCurrentOffenseKey()][currentInning] || 0
        );

        // 원본의 티바 파울 아웃 정규화 오류 보정
        const resultForOriginal =
            normalized === "파울 아웃" ? "삼진" : result;

        let automatic = original.applyResult(resultForOriginal, 0, tee);

        // 2아웃 희생플라이에서 득점 불인정
        if (normalized === "희생플라이" && outCount >= 3) {
            automatic = 0;
        }

        const input = getRunInputElement();
        const manual = input?.value.trim() !== "";
        const runs = manual ? integer(input.value) : automatic;
        const team = getCurrentOffenseKey();

        homeScore = beforeHome;
        awayScore = beforeAway;
        inningScores[team][currentInning] = beforeInning;

        if (team === "home") homeScore += runs;
        else awayScore += runs;

        inningScores[team][currentInning] += runs;

        if (normalized === "안타") {
            extension.runners = {
                first: batter,
                second: old.first ? names.first || "주자" : "",
                third: old.second ? names.second || "주자" : ""
            };
        } else if (normalized === "2루타") {
            extension.runners = {
                first: "",
                second: batter,
                third: old.first ? names.first || "주자" : ""
            };
        } else if (normalized === "3루타") {
            extension.runners = { first: "", second: "", third: batter };
        } else if (normalized === "홈런") {
            extension.runners = { first: "", second: "", third: "" };
        } else if (["실책", "야수선택"].includes(normalized)) {
            extension.runners.first = batter;
        } else if (normalized === "희생플라이") {
            extension.runners.third = "";
        }

        updateScoreDisplay();
        updateBaseDisplay();
        return runs;
    };

    savePlateAppearance = function () {
        const count = plateAppearances.length;
        const input = inputSnapshot();
        const draft = {
            pitcher: el("pitcherName")?.value || "",
            batter: el("batterName")?.value || "",
            side: el("batterSide")?.value || "우타",
            note: el("playNote")?.value || "",
            rbi: el("rbi")?.value || "0",
            runs: getRunInputElement()?.value ?? ""
        };
        const outs = outCount;

        original.savePlate();

        if (plateAppearances.length === count) return;

        const record = plateAppearances[plateAppearances.length - 1];
        record.id = uid();
        record.date = extension.date;
        record.countAtResult = {
            balls: input.ballCount,
            strikes: input.strikeCount,
            outs
        };
        record.dvDraft = draft;
        record.dvInput = input;

        syncRunners();
        rebuildStatistics();
        drawAllResults();
        saveGameState();
    };

    undoLastPlateAppearance = function () {
        if (!plateAppearances.length) {
            alert("취소할 타석이 없습니다.");
            return;
        }

        const record = clone(plateAppearances[plateAppearances.length - 1]);

        if (!record.beforeState) {
            alert("이전 상태가 없는 오래된 기록입니다. 상세 기록에서 수정해 주세요.");
            return;
        }

        const correctionStart = record.beforeState.dvCorrectionCount ?? 0;
        const laterCorrections = extension.corrections.slice(correctionStart);

        original.undoPlate();

        // 타석 저장 후 수동으로 정정한 점수는 유지
        for (const correction of laterCorrections) {
            applyScoreDelta(correction.team, correction.delta, correction.inning);
        }

        extension.runners = record.beforeState.dvRunners || {
            first: "", second: "", third: ""
        };

        if (record.dvInput || record.beforeState.dvInput) {
            restoreInput(record.dvInput || record.beforeState.dvInput);
        } else {
            currentPitchSequence = [...(record.pitches || [])];
            replayPitches(currentPitchSequence, record.teeReason === "데드볼");
            selectedPlateResult = record.result || selectedPlateResult;
        }

        extension.inputHistory = [];
        const draft = record.dvDraft || {};

        if (el("pitcherName")) el("pitcherName").value = draft.pitcher || record.pitcher;
        if (el("batterName")) el("batterName").value = draft.batter || record.batter;
        if (el("batterSide")) el("batterSide").value = draft.side || record.batterSide || "우타";
        if (el("playNote")) el("playNote").value = draft.note || record.note || "";
        if (el("rbi")) el("rbi").value = draft.rbi ?? record.rbi ?? 0;
        if (getRunInputElement()) getRunInputElement().value = draft.runs ?? "";

        openedRecord = -1;
        refreshInput();
        updateScoreDisplay();
        syncRunners();
        drawAllResults();
        saveGameState();
    };

    /* -----------------------------------------------------
       점수 수정
    ----------------------------------------------------- */

    function applyScoreDelta(team, delta, inning) {
        if (team === "home") homeScore += delta;
        else awayScore += delta;

        inningScores[team][inning] =
            Number(inningScores[team][inning] || 0) + delta;
    }

    function changeScore(team, delta) {
        const total = team === "home" ? homeScore : awayScore;
        if (total + delta < 0) return;

        let inning = currentInning;

        if (delta < 0) {
            const candidates = Object.keys(inningScores[team])
                .map(Number)
                .sort((a, b) => b - a);

            inning = candidates.find(value =>
                Number(inningScores[team][value]) >= -delta
            );

            if (!inning) {
                alert("이닝별 점수와 총점이 일치하지 않습니다. 점수 수정에서 이닝별 점수를 입력해 주세요.");
                return;
            }
        }

        applyScoreDelta(team, delta, inning);
        extension.corrections.push({
            team, delta, inning, at: new Date().toISOString()
        });

        updateScoreDisplay();
        drawAllResults();
        saveGameState();
    }

    function editScore(team) {
        const inningText = prompt("수정할 이닝을 입력해 주세요.", String(currentInning));
        if (inningText === null) return;

        const inning = Number(inningText);
        if (!Number.isInteger(inning) || inning < 1 || inning > 99) {
            alert("1~99 사이의 이닝을 입력해 주세요.");
            return;
        }

        const previous = integer(inningScores[team][inning]);
        const value = prompt(
            `${getTeamName(team)} ${inning}회 득점`,
            String(previous)
        );
        if (value === null) return;

        const number = Number(value);
        if (!Number.isInteger(number) || number < 0) {
            alert("0 이상의 정수를 입력해 주세요.");
            return;
        }

        const delta = number - previous;
        const total = team === "home" ? homeScore : awayScore;
        if (total + delta < 0) return;

        applyScoreDelta(team, delta, inning);
        extension.corrections.push({
            team, delta, inning, at: new Date().toISOString()
        });

        updateScoreDisplay();
        drawAllResults();
        saveGameState();
    }

    /* -----------------------------------------------------
       타수 · 타석 · 출루율
    ----------------------------------------------------- */

    function flags(record) {
        const result = normalizeResult(record.result);
        const tee = Boolean(record.teeMode) || /^티바\s/.test(record.result || "");
        const hit = hitResults.includes(result);
        const hbp = ["데드볼", "사구"].includes(record.teeReason) ||
            (!tee && ["데드볼", "사구"].includes(result));
        const walk = record.teeReason === "볼넷" ||
            (!tee && result === "볼넷");
        const free = walk || hbp || tee;
        const normalHit = hit && !tee;
        const normalK = result === "삼진" && !tee;

        const ab = extension.rule === "sbo"
            ? Number(normalHit || normalK)
            : Number(!free && !["희생플라이", "번트"].includes(result));

        const pa = extension.rule === "sbo"
            ? Number(normalHit || normalK || free)
            : 1;

        return {
            result, tee, hit, hbp, walk, free,
            normalHit, normalK, ab, pa,
            creditedReach: normalHit || free,
            actualReach: normalHit || (tee && hit) || (!tee && hbp)
        };
    }

    function blankBatter(team = "") {
        return {
            team, pa: 0, ab: 0,
            hits: 0, singles: 0, doubles: 0, triples: 0, homeRuns: 0,
            runs: 0, rbi: 0, strikeouts: 0,
            teeAppearances: 0, teeHits: 0,
            walks: 0, hitByPitch: 0,
            creditedReach: 0, actualReach: 0,
            records: 0
        };
    }

    updateBatterStatistic = function (record) {
        const name = record.batter;
        if (!name) return;

        if (!Object.prototype.hasOwnProperty.call(batterStats, name)) {
            batterStats[name] = blankBatter(record.teamName || "");
        }

        const stats = batterStats[name];
        const f = flags(record);

        stats.records++;
        stats.pa += f.pa;
        stats.ab += f.ab;
        stats.rbi += integer(record.rbi);
        stats.strikeouts += Number(f.normalK);
        stats.teeAppearances += Number(f.tee);
        stats.teeHits += Number(f.tee && f.hit);
        stats.walks += Number(f.walk || (f.tee && !f.hbp));
        stats.hitByPitch += Number(f.hbp);
        stats.creditedReach += Number(f.creditedReach);
        stats.actualReach += Number(f.actualReach);

        if (f.normalHit) {
            stats.hits++;
            const key = {
                "안타": "singles",
                "2루타": "doubles",
                "3루타": "triples",
                "홈런": "homeRuns"
            }[f.result];
            stats[key]++;
        }
    };

    updatePitcherStatistic = function (record) {
        const name = record.pitcher;
        if (!name) return;

        if (!Object.prototype.hasOwnProperty.call(pitcherStats, name)) {
            pitcherStats[name] = {
                battersFaced: 0, pitches: 0,
                strikes: 0, balls: 0, hitsAllowed: 0,
                runsAllowed: 0, strikeouts: 0, teeBatters: 0
            };
        }

        const stats = pitcherStats[name];
        const f = flags(record);
        const pitches = (record.pitches || []).filter(pitch => pitch !== "TF");

        stats.battersFaced++;
        stats.pitches += pitches.length;
        stats.strikes += pitches.filter(pitch =>
            ["S", "F", "SW"].includes(pitch)
        ).length;
        stats.balls += pitches.filter(pitch => pitch === "B").length;
        stats.hitsAllowed += Number(f.normalHit);
        stats.strikeouts += Number(f.normalK);
        stats.teeBatters += Number(f.tee);
        stats.runsAllowed += integer(record.runs);
    };

    rebuildStatistics = function () {
        batterStats = Object.create(null);
        pitcherStats = Object.create(null);
        plateAppearances.forEach(record => {
            updateBatterStatistic(record);
            updatePitcherStatistic(record);
        });
    };

    calculateBatterMetrics = function (stats) {
        const totalBases =
            stats.singles + stats.doubles * 2 +
            stats.triples * 3 + stats.homeRuns * 4;

        const average = stats.ab ? stats.hits / stats.ab : 0;
        const onBase = stats.pa ? stats.creditedReach / stats.pa : 0;
        const actualOnBase = stats.pa ? stats.actualReach / stats.pa : 0;
        const slugging = stats.ab ? totalBases / stats.ab : 0;

        return {
            average, onBase, actualOnBase,
            slugging, ops: onBase + slugging
        };
    };

    function cards(items) {
        return `<div class="mini-grid">${
            items.map(([label, value]) => `
                <div><span>${esc(label)}</span><b>${esc(value)}</b></div>
            `).join("")
        }</div>`;
    }

    drawBatterStats = function () {
        if (!el("batterStats")) return;

        el("batterStats").innerHTML = Object.entries(batterStats)
            .map(([name, stats]) => {
                const metrics = calculateBatterMetrics(stats);
                return `
                    <div class="stat-card">
                        <h3>${esc(name)}</h3>
                        <p>${esc(stats.team)}</p>
                        ${cards([
                            ["타석", stats.pa],
                            ["타수", stats.ab],
                            ["타율", stats.ab ? metrics.average.toFixed(3) : "-"],
                            ["출루율", stats.pa ? metrics.onBase.toFixed(3) : "-"],
                            ["실출루율", stats.pa ? metrics.actualOnBase.toFixed(3) : "-"],
                            ["장타율", stats.ab ? metrics.slugging.toFixed(3) : "-"],
                            ["일반 안타", stats.hits],
                            ["티바 안타", stats.teeHits],
                            ["볼넷", stats.walks],
                            ["사구", stats.hitByPitch],
                            ["타점", stats.rbi],
                            ["일반 삼진", stats.strikeouts]
                        ])}
                    </div>
                `;
            }).join("") || "타석을 저장하면 표시됩니다.";
    };

    /* -----------------------------------------------------
       최근 타석 상세 · 수정
    ----------------------------------------------------- */

    drawRecordTable = function () {
        const body = el("recordTableBody");
        if (!body) return;

        body.innerHTML = plateAppearances.map((record, index) => `
            <tr>
                <td>${esc(record.inning)}</td>
                <td>${esc(record.pitcher)}</td>
                <td>
                    <button class="dv-record-button"
                        type="button" data-dv-record="${index}">
                        ${esc(record.batter)}
                    </button>
                </td>
                <td>${esc(record.result)}</td>
                <td>${integer(record.runs)}</td>
                <td>${esc(record.scoreAfter)}</td>
            </tr>
        `).reverse().join("") ||
            '<tr><td colspan="6">아직 기록이 없습니다.</td></tr>';
    };

    function showDetail(index) {
        const record = plateAppearances[index];
        if (!record || !el("dvRecordDetail")) return;

        openedRecord = index;
        const count = record.countAtResult;
        const pitches = record.pitches || [];
        const resultOptions = [
            "안타", "2루타", "3루타", "홈런", "삼진",
            "땅볼", "뜬공", "라인드라이브", "희생플라이",
            "번트", "실책", "야수선택", "볼넷", "데드볼",
            "티바 안타", "티바 2루타", "티바 3루타",
            "티바 땅볼", "티바 뜬공", "티바 라인드라이브",
            "티바 희생플라이", "티바 번트",
            "티바 실책", "티바 야수선택", "티바 파울 아웃"
        ];

        if (!resultOptions.includes(record.result)) {
            resultOptions.push(record.result);
        }

        el("dvRecordDetail").innerHTML = `
            <h3>${esc(record.inning)} · ${esc(record.batter)}</h3>
            <p>
                저장 시 카운트:
                ${count
                    ? `${count.balls}볼 ${count.strikes}스트라이크 ${count.outs}아웃`
                    : "이전 기록에는 최종 카운트가 저장되지 않았습니다."}
            </p>
            <div class="sequence">
                ${pitches.length
                    ? pitches.map((pitch, i) =>
                        `<span class="pitch-chip">${i + 1}. ${esc(pitch)}</span>`
                    ).join("")
                    : "투구 기록 없음"}
            </div>
            <p class="dv-note">
                티바 전환: ${esc(record.teeReason || "없음")} ·
                주자: ${esc(record.baseBefore || "기록 없음")} ·
                영상: ${Math.floor(Number(record.videoTime) || 0)}초
            </p>

            <div class="dv-editor-grid">
                <label>타자<input id="dvEditBatter" value="${esc(record.batter)}"></label>
                <label>투수<input id="dvEditPitcher" value="${esc(record.pitcher)}"></label>
                <label>결과
                    <select id="dvEditResult">
                        ${resultOptions.map(result =>
                            `<option ${result === record.result ? "selected" : ""}>${esc(result)}</option>`
                        ).join("")}
                    </select>
                </label>
                <label>팀 득점
                    <input id="dvEditRuns" type="number" min="0"
                        value="${integer(record.runs)}">
                </label>
                <label>타점
                    <input id="dvEditRbi" type="number" min="0"
                        value="${integer(record.rbi)}">
                </label>
                <label>티바 전환 이유
                    <select id="dvEditReason">
                        <option value="">없음</option>
                        <option value="볼넷">볼넷</option>
                        <option value="데드볼">데드볼</option>
                    </select>
                </label>
                <label style="grid-column:1/-1">메모
                    <input id="dvEditNote" value="${esc(record.note || "")}">
                </label>
            </div>

            <p class="dv-note">
                기록 수정 시 통계와 점수를 갱신합니다.
                현재 주자·아웃·이닝은 자동으로 다시 진행하지 않으므로
                필요한 경우 상황 수정에서 맞춰 주세요.
            </p>

            <div class="dv-toolbar">
                <button id="dvApplyEdit" type="button">기록 수정 저장</button>
                <button id="dvSeekRecord" type="button">영상 위치로 이동</button>
            </div>
        `;

        el("dvEditReason").value = record.teeReason || "";
        el("dvApplyEdit").onclick = saveRecordEdit;
        el("dvSeekRecord").onclick = () => {
            const time = Math.max(0, Number(record.videoTime) || 0);
            if (isYouTubeMode()) window.youtubePlayer.seekTo(time, true);
            else if (el("video")) el("video").currentTime = time;
        };
    }

    function shiftScoreText(text, team, delta) {
        const parts = String(text || "").split(":").map(Number);
        if (parts.length !== 2 || parts.some(value => !Number.isFinite(value))) {
            return text;
        }
        parts[team === "away" ? 0 : 1] += delta;
        return `${parts[0]} : ${parts[1]}`;
    }

    function saveRecordEdit() {
        const record = plateAppearances[openedRecord];
        if (!record) return;

        const batter = el("dvEditBatter").value.trim();
        const pitcher = el("dvEditPitcher").value.trim();
        const runs = Number(el("dvEditRuns").value);
        const rbi = Number(el("dvEditRbi").value);
        const result = el("dvEditResult").value;
        const tee = result.startsWith("티바 ");
        const reason = tee ? el("dvEditReason").value : "";

        if (!batter || !pitcher) {
            alert("타자와 투수 이름을 입력해 주세요.");
            return;
        }

        if (
            !Number.isInteger(runs) || runs < 0 ||
            !Number.isInteger(rbi) || rbi < 0
        ) {
            alert("득점과 타점은 0 이상의 정수로 입력해 주세요.");
            return;
        }

        if (tee && !reason) {
            alert("티바 전환 이유를 선택해 주세요.");
            return;
        }

        const delta = runs - integer(record.runs);
        const team = record.offenseTeam;
        const inning = integer(record.inningNumber, 1);
        const total = team === "home" ? homeScore : awayScore;

        if (
            total + delta < 0 ||
            Number(inningScores[team][inning] || 0) + delta < 0
        ) {
            alert("수정 결과 점수가 음수가 됩니다. 먼저 이닝별 점수를 확인해 주세요.");
            return;
        }

        record.batter = batter;
        record.pitcher = pitcher;
        record.result = result;
        record.teeMode = tee;
        record.teeReason = reason;
        record.runs = runs;
        record.rbi = rbi;
        record.note = el("dvEditNote").value.trim();

        if (record.dvInput) {
            record.dvInput.selectedPlateResult = result;
            record.dvInput.isTeeMode = tee;
            record.dvInput.teeReason = reason;
        }

        if (record.dvDraft) {
            Object.assign(record.dvDraft, {
                batter, pitcher, runs: String(runs),
                rbi: String(rbi), note: record.note
            });
        }

        applyScoreDelta(team, delta, inning);

        // 이후 타석의 점수와 되돌리기용 점수도 함께 정정
        for (let index = openedRecord; index < plateAppearances.length; index++) {
            const item = plateAppearances[index];
            item.scoreAfter = shiftScoreText(item.scoreAfter, team, delta);

            if (index > openedRecord) {
                item.scoreBefore = shiftScoreText(item.scoreBefore, team, delta);

                if (item.beforeState) {
                    const key = team === "home" ? "homeScore" : "awayScore";
                    item.beforeState[key] += delta;
                    item.beforeState.inningScores ||= { home: {}, away: {} };
                    item.beforeState.inningScores[team] ||= {};
                    item.beforeState.inningScores[team][inning] =
                        Number(item.beforeState.inningScores[team][inning] || 0) + delta;
                }
            }
        }

        rebuildStatistics();
        updateScoreDisplay();
        drawAllResults();
        showDetail(openedRecord);
        saveGameState();
    }

    /* -----------------------------------------------------
       리포트 그래프: CSS 막대 + SVG 득점 추이
       Chart.js 로딩 여부와 관계없이 인쇄 가능
    ----------------------------------------------------- */

    function barChart(title, entries, color = "#e73553", maximum = null) {
        if (!entries.length) {
            return `<section class="dv-chart"><h3>${esc(title)}</h3><p>기록 없음</p></section>`;
        }

        const max = maximum ?? Math.max(1, ...entries.map(item => Number(item[1]) || 0));

        return `
            <section class="dv-chart">
                <h3>${esc(title)}</h3>
                ${entries.map(([label, value, suffix = ""]) => `
                    <div class="dv-bar-row">
                        <span>${esc(label)}</span>
                        <div class="dv-track">
                            <div class="dv-fill" style="
                                background:${color};
                                width:${Math.max(0, Math.min(100, Number(value) / max * 100))}%">
                            </div>
                        </div>
                        <b>${esc(value)}${esc(suffix)}</b>
                    </div>
                `).join("")}
            </section>
        `;
    }

    function resultEntries(records) {
        const counts = new Map();
        records.forEach(record => {
            const name = record.result || "미기록";
            counts.set(name, (counts.get(name) || 0) + 1);
        });
        return [...counts.entries()];
    }

    function pitchEntries(records) {
        const counts = { S: 0, B: 0, F: 0, SW: 0, TF: 0 };
        records.forEach(record => {
            (record.pitches || []).forEach(pitch => {
                if (Object.hasOwn(counts, pitch)) counts[pitch]++;
            });
        });

        return [
            ["스트라이크", counts.S],
            ["볼", counts.B],
            ["파울", counts.F],
            ["헛스윙", counts.SW],
            ["티바 파울", counts.TF]
        ];
    }

    function scoreLine() {
        const innings = Math.max(
            currentInning,
            ...Object.keys(inningScores.home).map(Number),
            ...Object.keys(inningScores.away).map(Number),
            1
        );

        let home = 0;
        let away = 0;
        const homeData = [0];
        const awayData = [0];

        for (let inning = 1; inning <= innings; inning++) {
            home += Number(inningScores.home[inning] || 0);
            away += Number(inningScores.away[inning] || 0);
            homeData.push(home);
            awayData.push(away);
        }

        const max = Math.max(1, ...homeData, ...awayData);
        const x = index => 35 + index / innings * 440;
        const y = value => 180 - value / max * 145;
        const points = values => values.map((value, index) =>
            `${x(index)},${y(value)}`
        ).join(" ");

        return `
            <section class="dv-chart" style="grid-column:1/-1">
                <h3>이닝별 누적 득점</h3>
                <svg viewBox="0 0 510 225" role="img" aria-label="이닝별 누적 득점 그래프">
                    <line x1="35" y1="180" x2="480" y2="180" stroke="#94a3b8"/>
                    <line x1="35" y1="30" x2="35" y2="180" stroke="#94a3b8"/>
                    <text x="5" y="40" fill="#475569" font-size="12">${max}</text>
                    <text x="15" y="184" fill="#475569" font-size="12">0</text>
                    <polyline points="${points(homeData)}" fill="none" stroke="#e73553" stroke-width="3"/>
                    <polyline points="${points(awayData)}" fill="none" stroke="#2563eb" stroke-width="3"/>
                    ${Array.from({ length: innings + 1 }, (_, i) => `
                        <text x="${x(i)}" y="201" text-anchor="middle"
                            fill="#475569" font-size="11">${i === 0 ? "시작" : `${i}회`}</text>
                    `).join("")}
                </svg>
                <p class="dv-report-note">
                    <span style="color:#e73553">● ${esc(getHomeTeamName())}</span>
                    &nbsp;
                    <span style="color:#2563eb">● ${esc(getAwayTeamName())}</span>
                    · 수동 점수 정정 포함
                </p>
            </section>
        `;
    }

    function reportStats(items) {
        return `<div class="report-stat-grid">${
            items.map(([name, value]) => `
                <div><span>${esc(name)}</span><strong>${esc(value)}</strong></div>
            `).join("")
        }</div>`;
    }

    function reportTable(records) {
        return `
            <table class="report-table">
                <thead>
                    <tr>
                        <th>회차</th><th>타자</th><th>투수</th>
                        <th>결과</th><th>팀 득점</th><th>타점</th><th>투구</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => `
                        <tr>
                            <td>${esc(record.inning)}</td>
                            <td>${esc(record.batter)}</td>
                            <td>${esc(record.pitcher)}</td>
                            <td>${esc(record.result)}</td>
                            <td>${integer(record.runs)}</td>
                            <td>${integer(record.rbi)}</td>
                            <td>${esc((record.pitches || []).join(" → "))}</td>
                        </tr>
                    `).join("") || '<tr><td colspan="7">기록 없음</td></tr>'}
                </tbody>
            </table>
        `;
    }

    function reportHeader(title) {
        return `
            <h1>${esc(title)}</h1>
            <p>
                ${esc(extension.date)} ·
                ${esc(getAwayTeamName())} ${awayScore} :
                ${homeScore} ${esc(getHomeTeamName())}
            </p>
            <p class="dv-report-note">
                계산 기준: ${extension.rule === "sbo" ? "SBO 요청식" : "일반 타수 기준"}.
                티바 안타는 일반 안타와 별도로 집계합니다.
                기록된 시점의 경기 상황이며 경기 종료 판정은 포함하지 않습니다.
            </p>
        `;
    }

    generateGameReport = function () {
        rebuildStatistics();
        currentReport = { type: "game" };

        const homeRecords = plateAppearances.filter(r => r.offenseTeam === "home");
        const awayRecords = plateAppearances.filter(r => r.offenseTeam === "away");
        const count = (records, key) =>
            records.reduce((sum, record) => sum + Number(flags(record)[key]), 0);

        const inningEntries = team => Object.entries(inningScores[team])
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([inning, runs]) => [`${inning}회`, runs]);

        el("reportOutput").innerHTML = `
            <article class="report-paper dv-report-paper">
                ${reportHeader("DIAMOND VISION 경기 리포트")}
                ${reportStats([
                    ["기록 타석", plateAppearances.length],
                    ["HOME 득점", homeScore],
                    ["AWAY 득점", awayScore],
                    ["티바 전환", plateAppearances.filter(r => flags(r).tee).length]
                ])}

                <h2>경기 그래프</h2>
                <div class="dv-report-grid">
                    ${scoreLine()}
                    ${barChart(`${getHomeTeamName()} 이닝별 득점`, inningEntries("home"))}
                    ${barChart(`${getAwayTeamName()} 이닝별 득점`, inningEntries("away"), "#2563eb")}
                    ${barChart("타석 결과 분포", resultEntries(plateAppearances))}
                    ${barChart("투구 기록 구성", pitchEntries(plateAppearances), "#2563eb")}
                    ${barChart("일반 안타 비교", [
                        [getHomeTeamName(), count(homeRecords, "normalHit")],
                        [getAwayTeamName(), count(awayRecords, "normalHit")]
                    ])}
                    ${barChart("실제 출루 타석 비교", [
                        [getHomeTeamName(), count(homeRecords, "actualReach")],
                        [getAwayTeamName(), count(awayRecords, "actualReach")]
                    ], "#16a34a")}
                </div>

                <h2>타자별 기록</h2>
                <table class="report-table">
                    <thead><tr>
                        <th>선수</th><th>타석</th><th>타수</th>
                        <th>안타</th><th>티바 안타</th><th>타율</th>
                        <th>출루율</th><th>실출루율</th><th>타점</th>
                    </tr></thead>
                    <tbody>
                        ${Object.entries(batterStats).map(([name, stats]) => {
                            const m = calculateBatterMetrics(stats);
                            return `<tr>
                                <td>${esc(name)}</td>
                                <td>${stats.pa}</td><td>${stats.ab}</td>
                                <td>${stats.hits}</td><td>${stats.teeHits}</td>
                                <td>${stats.ab ? m.average.toFixed(3) : "-"}</td>
                                <td>${stats.pa ? m.onBase.toFixed(3) : "-"}</td>
                                <td>${stats.pa ? m.actualOnBase.toFixed(3) : "-"}</td>
                                <td>${stats.rbi}</td>
                            </tr>`;
                        }).join("")}
                    </tbody>
                </table>

                <h2>타석별 기록</h2>
                ${reportTable(plateAppearances)}
                <p class="dv-report-note">
                    투수 투구 수에는 티바 파울을 포함하지 않습니다.
                    팀 득점은 개별 주자의 득점 기록과 다릅니다.
                </p>
            </article>
        `;
    };

    generatePlayerReport = function () {
        rebuildStatistics();

        const name = el("reportPlayerSelect")?.value;
        if (!name) {
            alert("선수를 먼저 선택해 주세요.");
            return;
        }

        currentReport = { type: "player", name };

        const batting = plateAppearances.filter(record => record.batter === name);
        const pitching = plateAppearances.filter(record => record.pitcher === name);
        const stats = batterStats[name];
        const pitcher = pitcherStats[name];
        const metrics = stats ? calculateBatterMetrics(stats) : null;
        const strikeRate = pitcher?.pitches
            ? pitcher.strikes / pitcher.pitches * 100
            : 0;

        const battingGraphs = stats ? `
            <h2>타자 분석</h2>
            ${reportStats([
                ["타석", stats.pa], ["타수", stats.ab],
                ["일반 안타", stats.hits], ["티바 안타", stats.teeHits],
                ["볼넷", stats.walks], ["사구", stats.hitByPitch],
                ["타점", stats.rbi], ["일반 삼진", stats.strikeouts]
            ])}

            <div class="dv-report-grid">
                ${barChart("타율 · 출루율 · 실출루율", [
                    ["타율", Number(metrics.average.toFixed(3))],
                    ["출루율", Number(metrics.onBase.toFixed(3))],
                    ["실출루율", Number(metrics.actualOnBase.toFixed(3))]
                ], "#e73553", 1)}
                ${barChart("타석 결과 분포", resultEntries(batting), "#2563eb")}
                ${barChart("안타 구성", [
                    ["일반 단타", stats.singles],
                    ["일반 2루타", stats.doubles],
                    ["일반 3루타", stats.triples],
                    ["일반 홈런", stats.homeRuns],
                    ["티바 안타", stats.teeHits]
                ], "#16a34a")}
                ${barChart("상대한 투구 구성", pitchEntries(batting), "#7c3aed")}
            </div>

            <p class="dv-report-note">
                타율 ${stats.ab ? metrics.average.toFixed(3) : "-"} ·
                출루율 ${stats.pa ? metrics.onBase.toFixed(3) : "-"} ·
                실출루율 ${stats.pa ? metrics.actualOnBase.toFixed(3) : "-"} ·
                장타율 ${stats.ab ? metrics.slugging.toFixed(3) : "-"}.
                분모가 없는 그래프 항목은 0으로 표시합니다.
            </p>
        ` : "";

        const pitchingGraphs = pitcher ? `
            <h2>투수 분석</h2>
            ${reportStats([
                ["상대 타자", pitcher.battersFaced],
                ["투구 수", pitcher.pitches],
                ["스트라이크 비율", `${strikeRate.toFixed(1)}%`],
                ["일반 삼진", pitcher.strikeouts],
                ["일반 피안타", pitcher.hitsAllowed],
                ["타석 중 팀 실점", pitcher.runsAllowed],
                ["티바 전환", pitcher.teeBatters],
                ["볼", pitcher.balls]
            ])}
            <div class="dv-report-grid">
                ${barChart("투구 구성", pitchEntries(pitching), "#2563eb")}
                ${barChart("상대 타석 결과", resultEntries(pitching))}
                ${barChart("스트라이크 · 볼 비율", [
                    ["스트라이크", Number(strikeRate.toFixed(1)), "%"],
                    ["볼", pitcher.pitches
                        ? Number((pitcher.balls / pitcher.pitches * 100).toFixed(1))
                        : 0, "%"]
                ], "#16a34a", 100)}
                ${barChart("투수 주요 기록", [
                    ["삼진", pitcher.strikeouts],
                    ["피안타", pitcher.hitsAllowed],
                    ["티바 전환", pitcher.teeBatters],
                    ["타석 중 실점", pitcher.runsAllowed]
                ], "#7c3aed")}
            </div>
            <p class="dv-report-note">
                실점은 해당 투수의 타석 기록 중 발생한 팀 득점 합계입니다.
                승계 주자 책임 실점 및 자책점은 별도로 판정하지 않습니다.
            </p>
        ` : "";

        el("reportOutput").innerHTML = `
            <article class="report-paper dv-report-paper">
                ${reportHeader(`${name} 선수 개인 리포트`)}
                ${battingGraphs}
                ${pitchingGraphs}
                <h2>선수 관련 타석</h2>
                ${reportTable(plateAppearances.filter(record =>
                    record.batter === name || record.pitcher === name
                ))}
            </article>
        `;
    };

    /* -----------------------------------------------------
       타구 · 존 기록에 선수 정보 연결
    ----------------------------------------------------- */

    recordSpray = function (event) {
        original.spray(event);
        const point = sprayPoints[sprayPoints.length - 1];
        if (point) {
            point.batter = el("batterName")?.value.trim() || "";
            point.pitcher = el("pitcherName")?.value.trim() || "";
            point.inning = currentInning;
            point.half = isTopInning ? "top" : "bottom";
            saveGameState();
        }
    };

    recordZone = function (event) {
        original.zone(event);
        const point = zonePoints[zonePoints.length - 1];
        if (point) {
            point.batter = el("batterName")?.value.trim() || "";
            point.pitcher = el("pitcherName")?.value.trim() || "";
            point.inning = currentInning;
            point.half = isTopInning ? "top" : "bottom";
            saveGameState();
        }
    };

    loadVideo = function (event) {
        window.youtubePlayer?.pauseVideo?.();
        original.video(event);
    };

    /* -----------------------------------------------------
       갱신 · 초기화 · HTML onclick 재연결
    ----------------------------------------------------- */

    drawAllResults = function () {
        original.draw();
        syncRunners();

        // 기록 변경 후 리포트가 이전 통계를 계속 보여주지 않도록 갱신
        if (ready && currentReport) {
            if (currentReport.type === "game") {
                generateGameReport();
            } else if (el("reportPlayerSelect")) {
                el("reportPlayerSelect").value = currentReport.name;
                if (el("reportPlayerSelect").value) generatePlayerReport();
                else {
                    currentReport = null;
                    el("reportOutput").textContent = "선수 기록이 없어 리포트를 초기화했습니다.";
                }
            }
        }
    };

    clearAllPlateAppearances = function () {
        if (!confirm("현재 경기의 타석·점수·타구·존 기록을 초기화할까요?")) return;

        plateAppearances = [];
        sprayPoints = [];
        zonePoints = [];
        currentInning = 1;
        isTopInning = true;
        homeScore = 0;
        awayScore = 0;
        outCount = 0;
        inningScores = { home: {}, away: {} };
        battingOrderIndex = { home: 0, away: 0 };
        baseState = { first: false, second: false, third: false };
        extension.runners = { first: "", second: "", third: "" };
        extension.corrections = [];
        extension.inputHistory = [];
        currentReport = null;
        openedRecord = -1;

        resetCurrentPlateAppearance();
        rebuildStatistics();
        updateInningDisplay();
        updateScoreDisplay();
        updateBaseDisplay();
        drawSprayPoints();
        drawZonePoints();
        drawAllResults();

        if (el("reportOutput")) {
            el("reportOutput").textContent = "경기 기록을 저장한 뒤 리포트를 생성해 주세요.";
        }
        if (el("dvRecordDetail")) {
            el("dvRecordDetail").textContent = "타석을 선택하면 상세 기록이 표시됩니다.";
        }

        saveGameState();
    };

    // 이전 코드의 window 함수 참조를 새 함수로 교체
    Object.assign(window, {
        addPitch,
        setPlateResult,
        undoCurrentInput,
        savePlateAppearance,
        undoLastPlateAppearance,
        clearAllPlateAppearances,
        generateGameReport,
        generatePlayerReport,
        recordSpray,
        recordZone,
        loadVideo
    });

    window.addEventListener("load", () => {
        const saved = readJSON(STORAGE_KEY, null);
        const extra = saved?.dvExtension;

        if (extra) {
            extension = {
                ...extension,
                ...extra,
                inputHistory: Array.isArray(extra.inputHistory) ? extra.inputHistory : [],
                corrections: Array.isArray(extra.corrections) ? extra.corrections : [],
                runners: extra.runners || { first: "", second: "", third: "" }
            };
        }

        if (!["sbo", "baseball"].includes(extension.rule)) {
            extension.rule = "sbo";
        }

        installUI();
        updateDateLabel();
        explainRules();

        const draft = saved?.dvDraft;
        if (draft) {
            if (el("pitcherName")) el("pitcherName").value = draft.pitcher || "";
            if (el("batterName")) el("batterName").value = draft.batter || "";
            if (el("batterSide")) el("batterSide").value = draft.side || "우타";
            if (getRunInputElement()) getRunInputElement().value = draft.runs ?? "";
            if (el("rbi")) el("rbi").value = draft.rbi ?? "0";
            if (el("playNote")) el("playNote").value = draft.note || "";
            if (el("youtubeUrl")) el("youtubeUrl").value = draft.youtube || "";
        }

        ready = true;
        rebuildStatistics();
        drawAllResults();
        renderArchive();
        syncRunners();

        [
            "pitcherName", "batterName", "batterSide",
            "runScored", "rbi", "playNote", "youtubeUrl"
        ].forEach(id => {
            el(id)?.addEventListener("change", saveGameState);
        });

        // API가 app.js보다 먼저 로드된 경우 보정
        if (window.YT?.Player && !window.youtubePlayer) {
            window.onYouTubeIframeAPIReady?.();
        }

        saveGameState();
    });

    window.addEventListener("beforeunload", event => {
        if (!ready) return;

        if (!saveGameState() || storageFailed) {
            event.preventDefault();
            event.returnValue = "";
        }
    });
})();