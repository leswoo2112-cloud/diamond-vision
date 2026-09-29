"use strict";

const STORAGE_KEY = "diamondVisionCompleteV2";

const $ = id =>
    document.getElementById(id);


/* =========================================================
   기본 경기 상태
========================================================= */

let currentInning = 1;
let isTopInning = true;

let ballCount = 0;
let strikeCount = 0;
let outCount = 0;

let homeScore = 0;
let awayScore = 0;

let baseState = {
    first: false,
    second: false,
    third: false
};

let currentPitchSequence = [];
let selectedPlateResult = "";

let isTeeMode = false;
let teeReason = "";

let plateAppearances = [];

let lineups = {
    home: [],
    away: []
};

let battingOrderIndex = {
    home: 0,
    away: 0
};

let inningScores = {
    home: {},
    away: {}
};

let batterStats = {};
let pitcherStats = {};

let sprayPoints = [];
let zonePoints = [];

let inningScoreChart = null;
let resultChart = null;

let pendingYouTubeId = "";
let localVideoObjectUrl = "";

window.youtubePlayer = null;


/* =========================================================
   날짜
========================================================= */

function setTodayDate() {
    const element =
        $("todayDate");

    if (!element) {
        return;
    }

    const today =
        new Date();

    const year =
        today.getFullYear();

    const month =
        String(
            today.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            today.getDate()
        ).padStart(2, "0");

    element.textContent =
        `${year}. ${month}. ${day}`;
}


/* =========================================================
   팀 정보
========================================================= */

function getHomeTeamName() {
    return (
        $("homeTeamName")
            ?.value
            .trim() ||
        "HOME"
    );
}


function getAwayTeamName() {
    return (
        $("awayTeamName")
            ?.value
            .trim() ||
        "AWAY"
    );
}


function getTeamName(teamKey) {
    return teamKey === "home"
        ? getHomeTeamName()
        : getAwayTeamName();
}


function getCurrentOffenseKey() {
    return isTopInning
        ? "away"
        : "home";
}


function updateTeamTitles() {
    if ($("homeLineupTitle")) {
        $("homeLineupTitle").textContent =
            getHomeTeamName();
    }

    if ($("awayLineupTitle")) {
        $("awayLineupTitle").textContent =
            getAwayTeamName();
    }

    updateCurrentLineupDisplay();
}


/* =========================================================
   이닝
========================================================= */

function updateInningDisplay() {
    if ($("inningDisplay")) {
        $("inningDisplay").textContent =
            `${currentInning}회${isTopInning ? "초" : "말"}`;
    }

    updateCurrentLineupDisplay();
}


function previousInning() {
    if (!isTopInning) {
        isTopInning = true;
    } else if (currentInning > 1) {
        currentInning -= 1;
        isTopInning = false;
    }

    resetHalfInningSituation();
    updateInningDisplay();
    saveGameState();
}


function nextInning() {
    if (isTopInning) {
        isTopInning = false;
    } else {
        currentInning += 1;
        isTopInning = true;
    }

    resetHalfInningSituation();
    updateInningDisplay();
    saveGameState();
}


/* =========================================================
   카운트·점수
========================================================= */

function updateCountDisplay() {
    if ($("ballCount")) {
        $("ballCount").textContent =
            String(ballCount);
    }

    if ($("strikeCount")) {
        $("strikeCount").textContent =
            String(strikeCount);
    }

    if ($("outCount")) {
        $("outCount").textContent =
            String(outCount);
    }
}


function updateScoreDisplay() {
    if ($("homeScore")) {
        $("homeScore").textContent =
            String(homeScore);
    }

    if ($("awayScore")) {
        $("awayScore").textContent =
            String(awayScore);
    }
}


/* =========================================================
   베이스
========================================================= */

function updateBaseDisplay() {
    $("base1")?.classList.toggle(
        "active",
        baseState.first
    );

    $("base2")?.classList.toggle(
        "active",
        baseState.second
    );

    $("base3")?.classList.toggle(
        "active",
        baseState.third
    );
}


function toggleBase(baseName) {
    if (
        !Object.prototype.hasOwnProperty.call(
            baseState,
            baseName
        )
    ) {
        return;
    }

    baseState[baseName] =
        !baseState[baseName];

    updateBaseDisplay();
    saveGameState();
}


function countBaseRunners() {
    return (
        Number(baseState.first) +
        Number(baseState.second) +
        Number(baseState.third)
    );
}


function getBaseText() {
    const bases = [];

    if (baseState.first) {
        bases.push("1루");
    }

    if (baseState.second) {
        bases.push("2루");
    }

    if (baseState.third) {
        bases.push("3루");
    }

    return bases.length
        ? bases.join(", ")
        : "주자 없음";
}


/* =========================================================
   라인업
========================================================= */

function renderLineupRows() {
    for (
        const teamKey of [
            "home",
            "away"
        ]
    ) {
        const container =
            $(`${teamKey}LineupRows`);

        if (!container) {
            continue;
        }

        container.innerHTML = "";

        for (
            let order = 1;
            order <= 9;
            order += 1
        ) {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "lineup-row";

            row.innerHTML = `
                <b>${order}</b>

                <input
                    id="${teamKey}Player${order}"
                    class="lineup-player-input"
                    data-team="${teamKey}"
                    data-order="${order}"
                    type="text"
                    placeholder="${order}번 타자"
                >

                <select
                    id="${teamKey}Position${order}"
                >
                    <option value="">포지션</option>
                    <option value="투수">투수</option>
                    <option value="포수">포수</option>
                    <option value="1루수">1루수</option>
                    <option value="2루수">2루수</option>
                    <option value="3루수">3루수</option>
                    <option value="유격수">유격수</option>
                    <option value="좌익수">좌익수</option>
                    <option value="중견수">중견수</option>
                    <option value="우익수">우익수</option>
                    <option value="지명타자">지명타자</option>
                </select>
            `;

            container.appendChild(row);
        }
    }
}


function toggleLineupPanel() {
    $("lineupSection")
        ?.classList
        .toggle("hidden");
}


function readLineupFromInputs(teamKey) {
    const players = [];

    for (
        let order = 1;
        order <= 9;
        order += 1
    ) {
        players.push({
            order,

            name:
                $(`${teamKey}Player${order}`)
                    ?.value
                    .trim() || "",

            position:
                $(`${teamKey}Position${order}`)
                    ?.value || ""
        });
    }

    return players;
}


function saveLineups() {
    lineups.home =
        readLineupFromInputs("home");

    lineups.away =
        readLineupFromInputs("away");

    const hasPlayer =
        lineups.home.some(
            player => player.name
        ) ||
        lineups.away.some(
            player => player.name
        );

    if (!hasPlayer) {
        alert(
            "선수 이름을 한 명 이상 입력해줘용."
        );

        return;
    }

    clampBattingOrderIndexes();
    updateTeamTitles();
    updateCurrentLineupDisplay();
    updateReportPlayerSelect();
    saveGameState();

    alert(
        "라인업을 저장했어용."
    );
}


function clearLineups() {
    if (
        !confirm(
            "양 팀 라인업을 초기화할까용?"
        )
    ) {
        return;
    }

    for (
        const teamKey of [
            "home",
            "away"
        ]
    ) {
        for (
            let order = 1;
            order <= 9;
            order += 1
        ) {
            const playerInput =
                $(`${teamKey}Player${order}`);

            const positionInput =
                $(`${teamKey}Position${order}`);

            if (playerInput) {
                playerInput.value = "";
            }

            if (positionInput) {
                positionInput.value = "";
            }
        }
    }

    lineups = {
        home: [],
        away: []
    };

    battingOrderIndex = {
        home: 0,
        away: 0
    };

    updateCurrentLineupDisplay();
    updateReportPlayerSelect();
    saveGameState();
}


function getValidLineupPlayers(teamKey) {
    return (
        lineups[teamKey] || []
    ).filter(
        player =>
            player &&
            player.name
    );
}


function clampBattingOrderIndexes() {
    for (
        const teamKey of [
            "home",
            "away"
        ]
    ) {
        const players =
            getValidLineupPlayers(
                teamKey
            );

        if (
            players.length === 0 ||
            battingOrderIndex[teamKey] >=
                players.length
        ) {
            battingOrderIndex[teamKey] =
                0;
        }
    }
}


function getCurrentBatter(teamKey) {
    const players =
        getValidLineupPlayers(
            teamKey
        );

    if (!players.length) {
        return null;
    }

    return players[
        battingOrderIndex[teamKey] %
        players.length
    ];
}


function getNextBatter(teamKey) {
    const players =
        getValidLineupPlayers(
            teamKey
        );

    if (!players.length) {
        return null;
    }

    return players[
        (
            battingOrderIndex[teamKey] +
            1
        ) % players.length
    ];
}


function advanceBattingOrder(teamKey) {
    const players =
        getValidLineupPlayers(
            teamKey
        );

    if (!players.length) {
        return;
    }

    battingOrderIndex[teamKey] =
        (
            battingOrderIndex[teamKey] +
            1
        ) % players.length;
}


function updateCurrentLineupDisplay() {
    const offenseKey =
        getCurrentOffenseKey();

    const currentBatter =
        getCurrentBatter(
            offenseKey
        );

    const nextBatter =
        getNextBatter(
            offenseKey
        );

    if ($("currentOffenseTeam")) {
        $("currentOffenseTeam")
            .textContent =
            `${offenseKey.toUpperCase()} · ${getTeamName(offenseKey)}`;
    }

    if ($("currentBatterDisplay")) {
        $("currentBatterDisplay")
            .textContent =
            currentBatter
                ? `${currentBatter.order}번 ${currentBatter.name}`
                : "라인업 없음";
    }

    if ($("nextBatterDisplay")) {
        $("nextBatterDisplay")
            .textContent =
            nextBatter
                ? `${nextBatter.order}번 ${nextBatter.name}`
                : "-";
    }

    if (
        $("batterName") &&
        currentBatter
    ) {
        $("batterName").value =
            currentBatter.name;
    }

    document
        .querySelectorAll(
            ".lineup-row"
        )
        .forEach(row => {
            row.classList.remove(
                "current-batter-row"
            );
        });

    if (currentBatter) {
        document.querySelector(
            `.lineup-player-input[data-team="${offenseKey}"][data-order="${currentBatter.order}"]`
        )
            ?.closest(".lineup-row")
            ?.classList.add(
                "current-batter-row"
            );
    }
}


function writeLineupsToInputs() {
    for (
        const teamKey of [
            "home",
            "away"
        ]
    ) {
        for (
            let order = 1;
            order <= 9;
            order += 1
        ) {
            const player =
                (
                    lineups[teamKey] ||
                    []
                ).find(
                    item =>
                        Number(item.order) ===
                        order
                );

            const playerInput =
                $(`${teamKey}Player${order}`);

            const positionInput =
                $(`${teamKey}Position${order}`);

            if (playerInput) {
                playerInput.value =
                    player?.name || "";
            }

            if (positionInput) {
                positionInput.value =
                    player?.position || "";
            }
        }
    }
}


/* =========================================================
   투구·티바 모드
========================================================= */

function enterTeeMode(reason) {
    isTeeMode = true;
    teeReason = reason;
    selectedPlateResult = "";

    updateSelectedResult();
    updateTeeButtons();
    saveGameState();
}


function addPitch(type) {
    if (
        selectedPlateResult === "삼진" ||
        selectedPlateResult === "티바 파울 아웃"
    ) {
        alert(
            "타석 결과가 확정됐어용. 타석 저장을 눌러줘용."
        );

        return;
    }

    if (isTeeMode) {
        if (type !== "F") {
            alert(
                "티바 타격 중에는 파울 또는 타격 결과를 입력해줘용."
            );

            return;
        }

        currentPitchSequence.push(
            "TF"
        );

        strikeCount += 1;

        if (strikeCount >= 3) {
            strikeCount = 3;

            selectedPlateResult =
                "티바 파울 아웃";
        }

        updatePitchSequence();
        updateCountDisplay();
        updateSelectedResult();
        saveGameState();

        return;
    }

    currentPitchSequence.push(type);

    if (type === "B") {
        ballCount += 1;

        if (ballCount >= 4) {
            ballCount = 4;

            enterTeeMode(
                "볼넷"
            );
        }
    }

    if (
        type === "S" ||
        type === "SW"
    ) {
        strikeCount += 1;

        if (strikeCount >= 3) {
            strikeCount = 3;

            selectedPlateResult =
                "삼진";
        }
    }

    if (
        type === "F" &&
        strikeCount < 2
    ) {
        strikeCount += 1;
    }

    updatePitchSequence();
    updateCountDisplay();
    updateSelectedResult();
    updateTeeButtons();
    saveGameState();
}

function undoCurrentInput() {
    if (selectedPlateResult !== "") {
        selectedPlateResult = "";
        updateSelectedResult();
        updateTeeButtons();
        saveGameState();
        return;
    }

    if (currentPitchSequence.length === 0) {
        return;
    }

    const lastPitch = currentPitchSequence.pop();

    switch (lastPitch) {
        case "S":
        case "SW":
            strikeCount = Math.max(0, strikeCount - 1);
            break;

        case "B":
            ballCount = Math.max(0, ballCount - 1);
            break;

        case "F":
            if (strikeCount < 2) {
                strikeCount = Math.max(0, strikeCount - 1);
            }
            break;

        case "TF":
            strikeCount = Math.max(0, strikeCount - 1);
            if (selectedPlateResult === "티바 파울 아웃") {
                selectedPlateResult = "";
            }
            break;
    }

    updatePitchSequence();
    updateCountDisplay();
    updateSelectedResult();
    updateTeeButtons();
    saveGameState();
}

function updatePitchSequence() {
    const element =
        $("pitchSequence");

    if (!element) {
        return;
    }

    if (
        currentPitchSequence.length === 0
    ) {
        element.textContent =
            "아직 투구 기록이 없습니다.";

        return;
    }

    element.innerHTML =
        currentPitchSequence
            .map(pitch => {
                let className =
                    "strike";

                if (pitch === "B") {
                    className = "ball";
                }

                if (
                    pitch === "F" ||
                    pitch === "TF"
                ) {
                    className = "foul";
                }

                if (pitch === "SW") {
                    className = "swing";
                }

                const label =
                    pitch === "TF"
                        ? "티바 파울"
                        : pitch;

                return `
                    <span class="pitch-chip ${className}">
                        ${label}
                    </span>
                `;
            })
            .join("");
}


/* =========================================================
   타석 결과 선택
========================================================= */

function setPlateResult(result) {
    if (result === "데드볼") {
        if (!isTeeMode) {
            enterTeeMode(
                "데드볼"
            );
        }

        return;
    }

    if (
        selectedPlateResult ===
        "티바 파울 아웃"
    ) {
        alert(
            "이미 티바 파울 아웃이 확정됐어용."
        );

        return;
    }

    if (
        isTeeMode &&
        result === "홈런"
    ) {
        alert(
            "티바 타격에서는 홈런을 선택할 수 없어용."
        );

        return;
    }

    selectedPlateResult =
        isTeeMode
            ? `티바 ${result}`
            : result;

    updateSelectedResult();
    updateTeeButtons();
    saveGameState();
}


function updateSelectedResult() {
    const element =
        $("selectedResult");

    if (!element) {
        return;
    }

    if (
        isTeeMode &&
        !selectedPlateResult
    ) {
        element.textContent =
            `${teeReason} → 티바 · 현재 ${strikeCount}스트라이크`;

        return;
    }

    element.textContent =
        `선택 결과: ${
            selectedPlateResult ||
            "없음"
        }`;
}


function updateTeeButtons() {
    document
        .querySelectorAll(
            ".result-buttons button"
        )
        .forEach(button => {
            const text =
                button.textContent
                    .trim();

            button.disabled =
                isTeeMode &&
                (
                    text === "홈런" ||
                    text === "데드볼"
                );
        });
}


function normalizeResult(result) {
    return String(result || "")
        .replace(
            /^티바\s*/,
            ""
        )
        .trim();
}
/* =========================================================
   득점 입력
========================================================= */

function getRunInputElement() {
    return (
        $("runScored") ||
        $("runsScored") ||
        $("runs") ||
        $("scoreRuns") ||
        document.querySelector(
            'input[name="runScored"]'
        ) ||
        document.querySelector(
            'input[name="runs"]'
        )
    );
}


function getEnteredRuns() {
    const input =
        getRunInputElement();

    if (!input) {
        return 0;
    }

    const value =
        Number(input.value);

    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(
        0,
        Math.floor(value)
    );
}


/* =========================================================
   경기 상태 복사
========================================================= */

function createGameSnapshot() {
    return {
        currentInning,
        isTopInning,

        ballCount,
        strikeCount,
        outCount,

        homeScore,
        awayScore,

        baseState: {
            ...baseState
        },

        battingOrderIndex: {
            ...battingOrderIndex
        },

        inningScores: {
            home: {
                ...inningScores.home
            },

            away: {
                ...inningScores.away
            }
        }
    };
}


/* =========================================================
   타석 저장
========================================================= */

function savePlateAppearance() {
    const pitcher =
        $("pitcherName")
            ?.value
            .trim() || "";

    const batter =
        $("batterName")
            ?.value
            .trim() || "";

    if (!pitcher) {
        alert(
            "투수 이름을 입력해줘용."
        );

        return;
    }

    if (!batter) {
        alert(
            "타자 이름을 입력해줘용."
        );

        return;
    }

    if (!selectedPlateResult) {
        alert(
            isTeeMode
                ? "티바 타격 결과를 선택해줘용."
                : "타석 결과를 선택해줘용."
        );

        return;
    }

    const offenseKey =
        getCurrentOffenseKey();

    const currentBatter =
        getCurrentBatter(
            offenseKey
        );

    const snapshot =
        createGameSnapshot();

    const inningText =
        `${currentInning}회${isTopInning ? "초" : "말"}`;

    const scoreBefore =
        `${awayScore} : ${homeScore}`;

    const baseBefore =
        getBaseText();

    const outsBefore =
        outCount;

    const teeModeAtSave =
        isTeeMode;

    const teeReasonAtSave =
        teeReason;

    const manuallyEnteredRuns =
        getEnteredRuns();

    const finalRuns =
        applyPlateResult(
            selectedPlateResult,
            manuallyEnteredRuns,
            teeModeAtSave
        );

    const rbi =
        Math.max(
            0,
            Number(
                $("rbi")
                    ?.value
            ) || 0
        );

    plateAppearances.push({
        beforeState:
            snapshot,

        inning:
            inningText,

        inningNumber:
            currentInning,

        half:
            isTopInning
                ? "top"
                : "bottom",

        offenseTeam:
            offenseKey,

        teamName:
            getTeamName(
                offenseKey
            ),

        battingOrder:
            currentBatter?.order ||
            null,

        position:
            currentBatter?.position ||
            "",

        pitcher,
        batter,

        batterSide:
            $("batterSide")
                ?.value || "우타",

        pitches: [
            ...currentPitchSequence
        ],

        result:
            selectedPlateResult,

        teeMode:
            teeModeAtSave,

        teeReason:
            teeReasonAtSave,

        baseBefore,

        baseAfter:
            getBaseText(),

        outsBefore,

        outsAfter:
            outCount,

        runs:
            finalRuns,

        rbi,

        scoreBefore,

        scoreAfter:
            `${awayScore} : ${homeScore}`,

        note:
            $("playNote")
                ?.value
                .trim() || "",

        videoTime:
            getCurrentVideoTime()
    });

    advanceBattingOrder(
        offenseKey
    );

    const reachedThreeOuts =
        outCount >= 3;

    resetCurrentPlateAppearance();

    if (reachedThreeOuts) {
        finishHalfInning();
    } else {
        updateCurrentLineupDisplay();
    }

    rebuildStatistics();
    drawAllResults();
    saveGameState();
}

window.savePlateAppearance =
    savePlateAppearance;


/* =========================================================
   타석 결과 및 자동 득점
========================================================= */

function applyPlateResult(
    result,
    enteredRuns,
    teeModeAtSave
) {
    const normalized =
        normalizeResult(result);

    const oldBases = {
        ...baseState
    };

    let automaticRuns = 0;
    let addedOuts = 0;

    /*
        안타
        3루 주자 득점
        2루 주자 3루
        1루 주자 2루
        타자 1루
    */

    if (normalized === "안타") {
        if (oldBases.third) {
            automaticRuns += 1;
        }

        baseState = {
            first: true,
            second: oldBases.first,
            third: oldBases.second
        };
    }

    /*
        2루타
        2루·3루 주자 득점
        1루 주자 3루
        타자 2루
    */

    if (normalized === "2루타") {
        automaticRuns =
            Number(oldBases.second) +
            Number(oldBases.third);

        baseState = {
            first: false,
            second: true,
            third: oldBases.first
        };
    }

    /*
        3루타
        기존 주자 전부 득점
        타자 3루
    */

    if (normalized === "3루타") {
        automaticRuns =
            Number(oldBases.first) +
            Number(oldBases.second) +
            Number(oldBases.third);

        baseState = {
            first: false,
            second: false,
            third: true
        };
    }

    /*
        홈런
        기존 주자 + 타자 득점
    */

    if (
        normalized === "홈런" &&
        !teeModeAtSave
    ) {
        automaticRuns =
            Number(oldBases.first) +
            Number(oldBases.second) +
            Number(oldBases.third) +
            1;

        baseState = {
            first: false,
            second: false,
            third: false
        };
    }

    /*
        실책·야수선택
        타자 1루 출루
    */

    if (
        normalized === "실책" ||
        normalized === "야수선택"
    ) {
        baseState.first = true;
    }

    /*
        희생플라이
        3루 주자가 있으면 득점
    */

    if (normalized === "희생플라이") {
        addedOuts = 1;

        if (oldBases.third) {
            automaticRuns += 1;
        }

        baseState.third = false;
    }

    /*
        일반 아웃 결과
    */

    if (
        [
            "삼진",
            "티바 파울 아웃",
            "땅볼",
            "뜬공",
            "라인드라이브",
            "번트"
        ].includes(normalized)
    ) {
        addedOuts = 1;
    }

    /*
        자동 득점과 직접 입력 중
        더 큰 값을 적용
    */

    const manualRuns =
        Math.max(
            0,
            Number(enteredRuns) || 0
        );

    const finalRuns =
        Math.max(
            automaticRuns,
            manualRuns
        );

    outCount =
        Math.min(
            3,
            outCount + addedOuts
        );

    addRuns(
        finalRuns
    );

    updateCountDisplay();
    updateScoreDisplay();
    updateBaseDisplay();

    return finalRuns;
}


/* =========================================================
   점수 추가
========================================================= */

function addRuns(runs) {
    const value =
        Math.max(
            0,
            Number(runs) || 0
        );

    if (value <= 0) {
        return;
    }

    /*
        1회초 = AWAY 공격
        1회말 = HOME 공격
    */

    if (isTopInning) {
        awayScore += value;

        inningScores.away[
            currentInning
        ] =
            (
                inningScores.away[
                    currentInning
                ] || 0
            ) + value;
    } else {
        homeScore += value;

        inningScores.home[
            currentInning
        ] =
            (
                inningScores.home[
                    currentInning
                ] || 0
            ) + value;
    }

    updateScoreDisplay();
}


/* =========================================================
   타석 초기화
========================================================= */

function resetCurrentPlateAppearance() {
    ballCount = 0;
    strikeCount = 0;

    currentPitchSequence = [];
    selectedPlateResult = "";

    isTeeMode = false;
    teeReason = "";

    const runInput =
        getRunInputElement();

    if (runInput) {
        runInput.value = "0";
    }

    if ($("rbi")) {
        $("rbi").value = "0";
    }

    if ($("playNote")) {
        $("playNote").value = "";
    }

    updateCountDisplay();
    updatePitchSequence();
    updateSelectedResult();
    updateTeeButtons();
}


/* =========================================================
   반 이닝 초기화
========================================================= */

function resetHalfInningSituation() {
    ballCount = 0;
    strikeCount = 0;
    outCount = 0;

    baseState = {
        first: false,
        second: false,
        third: false
    };

    currentPitchSequence = [];
    selectedPlateResult = "";

    isTeeMode = false;
    teeReason = "";

    updateCountDisplay();
    updateBaseDisplay();
    updatePitchSequence();
    updateSelectedResult();
    updateTeeButtons();
}


/* =========================================================
   3아웃 다음 이닝
========================================================= */

function finishHalfInning() {
    outCount = 0;
    ballCount = 0;
    strikeCount = 0;

    baseState = {
        first: false,
        second: false,
        third: false
    };

    currentPitchSequence = [];
    selectedPlateResult = "";

    isTeeMode = false;
    teeReason = "";

    if (isTopInning) {
        isTopInning = false;
    } else {
        currentInning += 1;
        isTopInning = true;
    }

    updateInningDisplay();
    updateCountDisplay();
    updateScoreDisplay();
    updateBaseDisplay();
    updatePitchSequence();
    updateSelectedResult();
    updateTeeButtons();
    updateCurrentLineupDisplay();
}


/* =========================================================
   최근 기록 하나 취소
========================================================= */

function undoLastPlateAppearance() {
    if (
        plateAppearances.length === 0
    ) {
        alert(
            "취소할 타석 기록이 없어용."
        );

        return;
    }

    const record =
        plateAppearances.pop();

    const state =
        record.beforeState;

    if (state) {
        currentInning =
            Number(
                state.currentInning
            ) || 1;

        isTopInning =
            state.isTopInning !== false;

        ballCount =
            Number(
                state.ballCount
            ) || 0;

        strikeCount =
            Number(
                state.strikeCount
            ) || 0;

        outCount =
            Number(
                state.outCount
            ) || 0;

        homeScore =
            Number(
                state.homeScore
            ) || 0;

        awayScore =
            Number(
                state.awayScore
            ) || 0;

        baseState = {
            first:
                Boolean(
                    state.baseState?.first
                ),

            second:
                Boolean(
                    state.baseState?.second
                ),

            third:
                Boolean(
                    state.baseState?.third
                )
        };

        battingOrderIndex = {
            home:
                Number(
                    state
                        .battingOrderIndex
                        ?.home
                ) || 0,

            away:
                Number(
                    state
                        .battingOrderIndex
                        ?.away
                ) || 0
        };

        inningScores = {
            home: {
                ...(
                    state
                        .inningScores
                        ?.home || {}
                )
            },

            away: {
                ...(
                    state
                        .inningScores
                        ?.away || {}
                )
            }
        };
    }

    resetCurrentPlateAppearance();
    rebuildStatistics();

    updateInningDisplay();
    updateCountDisplay();
    updateScoreDisplay();
    updateBaseDisplay();
    updateCurrentLineupDisplay();

    drawAllResults();
    saveGameState();

    alert(
        "최근 타석 기록을 취소했어용."
    );
}

window.undoLastPlateAppearance =
    undoLastPlateAppearance;


/* =========================================================
   최근 타석 전체 초기화
========================================================= */

function clearAllPlateAppearances() {
    if (
        !confirm(
            "최근 타석 기록과 점수, 이닝 상황을 모두 초기화할까용?"
        )
    ) {
        return;
    }

    plateAppearances = [];

    currentInning = 1;
    isTopInning = true;

    ballCount = 0;
    strikeCount = 0;
    outCount = 0;

    homeScore = 0;
    awayScore = 0;

    baseState = {
        first: false,
        second: false,
        third: false
    };

    currentPitchSequence = [];
    selectedPlateResult = "";

    isTeeMode = false;
    teeReason = "";

    battingOrderIndex = {
        home: 0,
        away: 0
    };

    inningScores = {
        home: {},
        away: {}
    };

    batterStats = {};
    pitcherStats = {};

    const runInput =
        getRunInputElement();

    if (runInput) {
        runInput.value = "0";
    }

    if ($("rbi")) {
        $("rbi").value = "0";
    }

    if ($("playNote")) {
        $("playNote").value = "";
    }

    if ($("reportOutput")) {
        $("reportOutput").innerHTML =
            "경기 기록을 저장한 뒤 리포트를 생성해줘용.";
    }

    updateInningDisplay();
    updateCountDisplay();
    updateScoreDisplay();
    updateBaseDisplay();
    updatePitchSequence();
    updateSelectedResult();
    updateTeeButtons();
    updateCurrentLineupDisplay();

    drawAllResults();
    saveGameState();

    alert(
        "최근 타석 기록과 경기 점수를 모두 초기화했어용."
    );
}

window.clearAllPlateAppearances =
    clearAllPlateAppearances;


/* =========================================================
   전체 경기 초기화
========================================================= */

function resetGame() {
    if (
        !confirm(
            "라인업을 포함한 모든 경기 데이터를 삭제할까용?"
        )
    ) {
        return;
    }

    localStorage.removeItem(
        STORAGE_KEY
    );

    location.reload();
}

window.resetGame =
    resetGame;


/* =========================================================
   타자·투수 통계 계산
========================================================= */

function rebuildStatistics() {
    batterStats = {};
    pitcherStats = {};

    plateAppearances.forEach(
        record => {
            updateBatterStatistic(
                record
            );

            updatePitcherStatistic(
                record
            );
        }
    );
}


function updateBatterStatistic(record) {
    const name =
        record.batter;

    if (!name) {
        return;
    }

    if (!batterStats[name]) {
        batterStats[name] = {
            team:
                record.teamName || "",

            pa: 0,
            ab: 0,

            hits: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,

            runs: 0,
            rbi: 0,

            strikeouts: 0,
            teeAppearances: 0
        };
    }

    const stats =
        batterStats[name];

    const result =
        normalizeResult(
            record.result
        );

    stats.pa += 1;

    if (result !== "희생플라이") {
        stats.ab += 1;
    }

    stats.runs +=
        Number(record.runs) || 0;

    stats.rbi +=
        Number(record.rbi) || 0;

    if (record.teeMode) {
        stats.teeAppearances += 1;
    }

    if (
        [
            "안타",
            "2루타",
            "3루타",
            "홈런"
        ].includes(result)
    ) {
        stats.hits += 1;
    }

    if (result === "안타") {
        stats.singles += 1;
    }

    if (result === "2루타") {
        stats.doubles += 1;
    }

    if (result === "3루타") {
        stats.triples += 1;
    }

    if (result === "홈런") {
        stats.homeRuns += 1;
    }

    if (
        result === "삼진" ||
        result === "티바 파울 아웃"
    ) {
        stats.strikeouts += 1;
    }
}


function updatePitcherStatistic(record) {
    const name =
        record.pitcher;

    if (!name) {
        return;
    }

    if (!pitcherStats[name]) {
        pitcherStats[name] = {
            battersFaced: 0,

            pitches: 0,
            strikes: 0,
            balls: 0,

            hitsAllowed: 0,
            runsAllowed: 0,

            strikeouts: 0,
            teeBatters: 0
        };
    }

    const stats =
        pitcherStats[name];

    const result =
        normalizeResult(
            record.result
        );

    stats.battersFaced += 1;

    stats.pitches +=
        record.pitches?.length || 0;

    for (
        const pitch of
        record.pitches || []
    ) {
        if (
            [
                "S",
                "F",
                "SW",
                "TF"
            ].includes(pitch)
        ) {
            stats.strikes += 1;
        }

        if (pitch === "B") {
            stats.balls += 1;
        }
    }

    if (
        [
            "안타",
            "2루타",
            "3루타",
            "홈런"
        ].includes(result)
    ) {
        stats.hitsAllowed += 1;
    }

    if (
        result === "삼진" ||
        result === "티바 파울 아웃"
    ) {
        stats.strikeouts += 1;
    }

    if (record.teeMode) {
        stats.teeBatters += 1;
    }

    stats.runsAllowed +=
        Number(record.runs) || 0;
}


/* =========================================================
   타자 지표
========================================================= */

function calculateBatterMetrics(stats) {
    const average =
        stats.ab > 0
            ? stats.hits /
                stats.ab
            : 0;

    const totalBases =
        stats.singles +
        stats.doubles * 2 +
        stats.triples * 3 +
        stats.homeRuns * 4;

    const slugging =
        stats.ab > 0
            ? totalBases /
                stats.ab
            : 0;

    const onBase =
        stats.pa > 0
            ? stats.hits /
                stats.pa
            : 0;

    return {
        average,
        onBase,
        slugging,

        ops:
            onBase +
            slugging
    };
}
/* =========================================================
   전체 분석 화면 갱신
========================================================= */

function drawAllResults() {
    drawRecordTable();
    drawBatterStats();
    drawPitcherStats();
    drawCharts();
    drawMVP();
    drawTeamCompare();
    drawHighlights();
    updateReportPlayerSelect();
}


/* =========================================================
   최근 타석 기록 표
========================================================= */

function drawRecordTable() {
    const body =
        $("recordTableBody");

    if (!body) {
        return;
    }

    if (
        plateAppearances.length === 0
    ) {
        body.innerHTML = `
            <tr>
                <td colspan="6">
                    아직 기록이 없습니다.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML =
        [...plateAppearances]
            .reverse()
            .map(record => `
                <tr>
                    <td>
                        ${escapeHtml(record.inning)}
                    </td>

                    <td>
                        ${escapeHtml(record.pitcher)}
                    </td>

                    <td>
                        ${escapeHtml(record.batter)}
                    </td>

                    <td>
                        ${escapeHtml(record.result)}
                    </td>

                    <td>
                        ${Number(record.runs) || 0}
                    </td>

                    <td>
                        ${escapeHtml(record.scoreAfter)}
                    </td>
                </tr>
            `)
            .join("");
}


/* =========================================================
   타자 분석
========================================================= */

function drawBatterStats() {
    const element =
        $("batterStats");

    if (!element) {
        return;
    }

    const entries =
        Object.entries(
            batterStats
        );

    if (!entries.length) {
        element.innerHTML =
            "타석을 저장하면 표시됩니다.";

        return;
    }

    element.innerHTML =
        entries
            .map(
                ([name, stats]) => {
                    const metrics =
                        calculateBatterMetrics(
                            stats
                        );

                    return `
                        <div class="stat-card">
                            <h3>
                                ${escapeHtml(name)}
                            </h3>

                            <p>
                                ${escapeHtml(stats.team)}
                            </p>

                            <div class="mini-grid">
                                <div>
                                    <span>AVG</span>
                                    <b>${metrics.average.toFixed(3)}</b>
                                </div>

                                <div>
                                    <span>OBP</span>
                                    <b>${metrics.onBase.toFixed(3)}</b>
                                </div>

                                <div>
                                    <span>SLG</span>
                                    <b>${metrics.slugging.toFixed(3)}</b>
                                </div>

                                <div>
                                    <span>OPS</span>
                                    <b>${metrics.ops.toFixed(3)}</b>
                                </div>

                                <div>
                                    <span>안타</span>
                                    <b>${stats.hits}</b>
                                </div>

                                <div>
                                    <span>홈런</span>
                                    <b>${stats.homeRuns}</b>
                                </div>

                                <div>
                                    <span>타점</span>
                                    <b>${stats.rbi}</b>
                                </div>

                                <div>
                                    <span>삼진</span>
                                    <b>${stats.strikeouts}</b>
                                </div>
                            </div>
                        </div>
                    `;
                }
            )
            .join("");
}


/* =========================================================
   투수 분석
========================================================= */

function drawPitcherStats() {
    const element =
        $("pitcherStats");

    if (!element) {
        return;
    }

    const entries =
        Object.entries(
            pitcherStats
        );

    if (!entries.length) {
        element.innerHTML =
            "타석을 저장하면 표시됩니다.";

        return;
    }

    element.innerHTML =
        entries
            .map(
                ([name, stats]) => {
                    const strikeRate =
                        stats.pitches > 0
                            ? (
                                stats.strikes /
                                stats.pitches
                            ) * 100
                            : 0;

                    return `
                        <div class="stat-card">
                            <h3>
                                ${escapeHtml(name)}
                            </h3>

                            <div class="mini-grid">
                                <div>
                                    <span>투구수</span>
                                    <b>${stats.pitches}</b>
                                </div>

                                <div>
                                    <span>스트%</span>
                                    <b>${strikeRate.toFixed(1)}%</b>
                                </div>

                                <div>
                                    <span>삼진</span>
                                    <b>${stats.strikeouts}</b>
                                </div>

                                <div>
                                    <span>피안타</span>
                                    <b>${stats.hitsAllowed}</b>
                                </div>

                                <div>
                                    <span>실점</span>
                                    <b>${stats.runsAllowed}</b>
                                </div>

                                <div>
                                    <span>상대 타자</span>
                                    <b>${stats.battersFaced}</b>
                                </div>

                                <div>
                                    <span>볼</span>
                                    <b>${stats.balls}</b>
                                </div>

                                <div>
                                    <span>티바 전환</span>
                                    <b>${stats.teeBatters}</b>
                                </div>
                            </div>
                        </div>
                    `;
                }
            )
            .join("");
}


/* =========================================================
   그래프
========================================================= */

function drawCharts() {
    if (
        typeof Chart ===
        "undefined"
    ) {
        return;
    }

    drawInningScoreChart();
    drawResultChart();
}


function drawInningScoreChart() {
    const canvas =
        $("inningScoreChart");

    if (!canvas) {
        return;
    }

    const maxInning =
        Math.max(
            currentInning,
            ...Object.keys(
                inningScores.home
            ).map(Number),
            ...Object.keys(
                inningScores.away
            ).map(Number),
            1
        );

    const labels =
        Array.from(
            {
                length:
                    maxInning
            },

            (_, index) =>
                `${index + 1}회`
        );

    if (inningScoreChart) {
        inningScoreChart.destroy();
    }

    inningScoreChart =
        new Chart(
            canvas,
            {
                type: "line",

                data: {
                    labels,

                    datasets: [
                        {
                            label:
                                getHomeTeamName(),

                            data:
                                labels.map(
                                    (
                                        _,
                                        index
                                    ) =>
                                        Number(
                                            inningScores
                                                .home[
                                                index +
                                                1
                                            ]
                                        ) || 0
                                ),

                            borderColor:
                                "#ff4057",

                            backgroundColor:
                                "rgba(255,64,87,0.12)",

                            tension:
                                0.3
                        },

                        {
                            label:
                                getAwayTeamName(),

                            data:
                                labels.map(
                                    (
                                        _,
                                        index
                                    ) =>
                                        Number(
                                            inningScores
                                                .away[
                                                index +
                                                1
                                            ]
                                        ) || 0
                                ),

                            borderColor:
                                "#2e6cff",

                            backgroundColor:
                                "rgba(46,108,255,0.12)",

                            tension:
                                0.3
                        }
                    ]
                },

                options: {
                    responsive:
                        true,

                    maintainAspectRatio:
                        false
                }
            }
        );
}


function drawResultChart() {
    const canvas =
        $("resultChart");

    if (!canvas) {
        return;
    }

    const counts = {};

    plateAppearances.forEach(
        record => {
            const result =
                record.result ||
                "기타";

            counts[result] =
                (
                    counts[result] ||
                    0
                ) + 1;
        }
    );

    const labels =
        Object.keys(counts);

    const values =
        Object.values(counts);

    if (resultChart) {
        resultChart.destroy();
    }

    resultChart =
        new Chart(
            canvas,
            {
                type:
                    "doughnut",

                data: {
                    labels:
                        labels.length
                            ? labels
                            : [
                                "기록 없음"
                            ],

                    datasets: [
                        {
                            data:
                                values.length
                                    ? values
                                    : [1],

                            backgroundColor: [
                                "#ff4057",
                                "#2e6cff",
                                "#36e68b",
                                "#ffc628",
                                "#9b5cff",
                                "#1cb5e0",
                                "#f97316",
                                "#64748b"
                            ],

                            borderWidth:
                                0
                        }
                    ]
                },

                options: {
                    responsive:
                        true,

                    maintainAspectRatio:
                        false
                }
            }
        );
}


/* =========================================================
   MVP
========================================================= */

function getMvpPlayer() {
    const entries =
        Object.entries(
            batterStats
        );

    if (!entries.length) {
        return null;
    }

    return entries
        .map(
            ([name, stats]) => {
                const metrics =
                    calculateBatterMetrics(
                        stats
                    );

                const score =
                    stats.hits * 3 +
                    stats.doubles * 2 +
                    stats.triples * 3 +
                    stats.homeRuns * 5 +
                    stats.rbi * 2 +
                    stats.runs +
                    metrics.ops * 3;

                return {
                    name,
                    stats,
                    metrics,
                    score
                };
            }
        )
        .sort(
            (a, b) =>
                b.score -
                a.score
        )[0];
}


function drawMVP() {
    const element =
        $("mvpCard");

    if (!element) {
        return;
    }

    const player =
        getMvpPlayer();

    if (!player) {
        element.innerHTML =
            "경기 기록이 없습니다.";

        return;
    }

    element.innerHTML = `
        <div class="stat-card">
            <h3>
                ${escapeHtml(player.name)}
            </h3>

            <p>
                ${escapeHtml(player.stats.team)}
            </p>

            <div class="mini-grid">
                <div>
                    <span>안타</span>
                    <b>${player.stats.hits}</b>
                </div>

                <div>
                    <span>홈런</span>
                    <b>${player.stats.homeRuns}</b>
                </div>

                <div>
                    <span>타점</span>
                    <b>${player.stats.rbi}</b>
                </div>

                <div>
                    <span>OPS</span>
                    <b>${player.metrics.ops.toFixed(3)}</b>
                </div>
            </div>
        </div>
    `;
}


/* =========================================================
   팀 비교
========================================================= */

function drawTeamCompare() {
    const element =
        $("teamCompare");

    if (!element) {
        return;
    }

    const homeRecords =
        plateAppearances.filter(
            record =>
                record.offenseTeam ===
                "home"
        );

    const awayRecords =
        plateAppearances.filter(
            record =>
                record.offenseTeam ===
                "away"
        );

    const countHits =
        records =>
            records.filter(
                record =>
                    [
                        "안타",
                        "2루타",
                        "3루타",
                        "홈런"
                    ].includes(
                        normalizeResult(
                            record.result
                        )
                    )
            ).length;

    element.innerHTML = `
        <div class="mini-grid">
            <div>
                <span>HOME 득점</span>
                <b>${homeScore}</b>
            </div>

            <div>
                <span>AWAY 득점</span>
                <b>${awayScore}</b>
            </div>

            <div>
                <span>HOME 안타</span>
                <b>${countHits(homeRecords)}</b>
            </div>

            <div>
                <span>AWAY 안타</span>
                <b>${countHits(awayRecords)}</b>
            </div>

            <div>
                <span>HOME 타석</span>
                <b>${homeRecords.length}</b>
            </div>

            <div>
                <span>AWAY 타석</span>
                <b>${awayRecords.length}</b>
            </div>
        </div>
    `;
}


/* =========================================================
   하이라이트
========================================================= */

function drawHighlights() {
    const element =
        $("highlightList");

    if (!element) {
        return;
    }

    const highlights =
        plateAppearances.filter(
            record => {
                const result =
                    normalizeResult(
                        record.result
                    );

                return (
                    result === "홈런" ||
                    result === "3루타" ||
                    Number(record.runs) >= 2 ||
                    Number(record.rbi) >= 2
                );
            }
        );

    if (!highlights.length) {
        element.innerHTML =
            "주요 장면이 없습니다.";

        return;
    }

    element.innerHTML =
        highlights
            .slice(-5)
            .reverse()
            .map(record => `
                <div class="highlight-item">
                    <strong>
                        ${escapeHtml(record.inning)}
                        ·
                        ${escapeHtml(record.batter)}
                    </strong>

                    <div>
                        ${escapeHtml(record.result)}
                        · 득점 ${Number(record.runs) || 0}
                        · 타점 ${Number(record.rbi) || 0}
                    </div>
                </div>
            `)
            .join("");
}


/* =========================================================
   타구 방향 차트
========================================================= */

function recordSpray(event) {
    const element =
        event.currentTarget;

    const rect =
        element.getBoundingClientRect();

    sprayPoints.push({
        x:
            (
                event.clientX -
                rect.left
            ) / rect.width,

        y:
            (
                event.clientY -
                rect.top
            ) / rect.height
    });

    drawSprayPoints();
    saveGameState();
}


function drawSprayPoints() {
    const element =
        $("sprayChart");

    if (!element) {
        return;
    }

    element
        .querySelectorAll(
            ".spray-dot"
        )
        .forEach(dot => {
            dot.remove();
        });

    sprayPoints.forEach(
        point => {
            const dot =
                document.createElement(
                    "span"
                );

            dot.className =
                "spray-dot";

            dot.style.left =
                `calc(${point.x * 100}% - 5px)`;

            dot.style.top =
                `calc(${point.y * 100}% - 5px)`;

            element.appendChild(
                dot
            );
        }
    );
}


function clearSprayChart() {
    sprayPoints = [];

    drawSprayPoints();
    saveGameState();
}


/* =========================================================
   스트라이크존
========================================================= */

function recordZone(event) {
    const element =
        event.currentTarget;

    const rect =
        element.getBoundingClientRect();

    zonePoints.push({
        x:
            (
                event.clientX -
                rect.left
            ) / rect.width,

        y:
            (
                event.clientY -
                rect.top
            ) / rect.height
    });

    drawZonePoints();
    saveGameState();
}


function drawZonePoints() {
    const element =
        $("strikeZone");

    if (!element) {
        return;
    }

    element
        .querySelectorAll(
            ".zone-dot"
        )
        .forEach(dot => {
            dot.remove();
        });

    zonePoints.forEach(
        point => {
            const dot =
                document.createElement(
                    "span"
                );

            dot.className =
                "zone-dot";

            dot.style.left =
                `calc(${point.x * 100}% - 5px)`;

            dot.style.top =
                `calc(${point.y * 100}% - 5px)`;

            element.appendChild(
                dot
            );
        }
    );
}


function clearStrikeZone() {
    zonePoints = [];

    drawZonePoints();
    saveGameState();
}


/* =========================================================
   리포트 선수 선택
========================================================= */

function updateReportPlayerSelect() {
    const select =
        $("reportPlayerSelect");

    if (!select) {
        return;
    }

    const previousValue =
        select.value;

    const names =
        new Set([
            ...Object.keys(
                batterStats
            ),

            ...Object.keys(
                pitcherStats
            )
        ]);

    select.innerHTML = `
        <option value="">
            개인 리포트 선수 선택
        </option>
    `;

    Array.from(names)
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "ko"
                )
        )
        .forEach(name => {
            const option =
                document.createElement(
                    "option"
                );

            option.value =
                name;

            option.textContent =
                name;

            select.appendChild(
                option
            );
        });

    if (
        names.has(
            previousValue
        )
    ) {
        select.value =
            previousValue;
    }
}


/* =========================================================
   경기 리포트
========================================================= */

function generateGameReport() {
    rebuildStatistics();

    const output =
        $("reportOutput");

    if (!output) {
        return;
    }

    const mvp =
        getMvpPlayer();

    const winnerText =
        homeScore > awayScore
            ? `${getHomeTeamName()} 승리`

            : awayScore > homeScore
                ? `${getAwayTeamName()} 승리`

                : "동점";

    const rows =
        plateAppearances
            .map(record => `
                <tr>
                    <td>${escapeHtml(record.inning)}</td>
                    <td>${escapeHtml(record.batter)}</td>
                    <td>${escapeHtml(record.pitcher)}</td>
                    <td>${escapeHtml(record.result)}</td>
                    <td>${Number(record.runs) || 0}</td>
                    <td>${Number(record.rbi) || 0}</td>
                    <td>${escapeHtml(record.scoreAfter)}</td>
                </tr>
            `)
            .join("");

    output.innerHTML = `
        <article class="report-paper">

            <h1>
                DIAMOND VISION 경기 분석 보고서
            </h1>

            <div class="report-info-grid">
                <div>
                    <span>경기 날짜</span>
                    <strong>
                        ${escapeHtml(
                            $("todayDate")
                                ?.textContent || ""
                        )}
                    </strong>
                </div>

                <div>
                    <span>경기 결과</span>
                    <strong>
                        ${escapeHtml(winnerText)}
                    </strong>
                </div>

                <div>
                    <span>스코어</span>
                    <strong>
                        ${awayScore} : ${homeScore}
                    </strong>
                </div>

                <div>
                    <span>총 타석</span>
                    <strong>
                        ${plateAppearances.length}
                    </strong>
                </div>
            </div>

            <h2>경기 정보</h2>

            <p>
                ${escapeHtml(getAwayTeamName())}
                ${awayScore}
                :
                ${homeScore}
                ${escapeHtml(getHomeTeamName())}
            </p>

            <h2>오늘의 MVP</h2>

            <p>
                ${
                    mvp
                        ? `${escapeHtml(mvp.name)} · 안타 ${mvp.stats.hits} · 홈런 ${mvp.stats.homeRuns} · 타점 ${mvp.stats.rbi} · OPS ${mvp.metrics.ops.toFixed(3)}`

                        : "선정 가능한 기록이 없습니다."
                }
            </p>

            <h2>타석별 기록</h2>

            <table class="report-table">
                <thead>
                    <tr>
                        <th>회차</th>
                        <th>타자</th>
                        <th>투수</th>
                        <th>결과</th>
                        <th>득점</th>
                        <th>타점</th>
                        <th>스코어</th>
                    </tr>
                </thead>

                <tbody>
                    ${
                        rows ||
                        `
                            <tr>
                                <td colspan="7">
                                    저장된 기록이 없습니다.
                                </td>
                            </tr>
                        `
                    }
                </tbody>
            </table>

            <h2>다음 경기 분석 포인트</h2>

            <p>
                득점권 타격 결과, 투수 스트라이크 비율,
                티바 전환 이후 결과, 타구 방향을 중심으로
                확인하는 것이 좋습니다.
            </p>

            <div class="report-signature">
                Diamond Vision
            </div>

        </article>
    `;
}


/* =========================================================
   선수 개인 리포트
========================================================= */

function generatePlayerReport() {
    rebuildStatistics();

    const playerName =
        $("reportPlayerSelect")
            ?.value || "";

    if (!playerName) {
        alert(
            "선수를 먼저 선택해줘용."
        );

        return;
    }

    const output =
        $("reportOutput");

    if (!output) {
        return;
    }

    const batter =
        batterStats[playerName] ||
        null;

    const pitcher =
        pitcherStats[playerName] ||
        null;

    const metrics =
        batter
            ? calculateBatterMetrics(
                batter
            )

            : {
                average: 0,
                onBase: 0,
                slugging: 0,
                ops: 0
            };

    const strikeRate =
        pitcher &&
        pitcher.pitches > 0
            ? (
                pitcher.strikes /
                pitcher.pitches
            ) * 100
            : 0;

    const records =
        plateAppearances.filter(
            record =>
                record.batter ===
                    playerName ||
                record.pitcher ===
                    playerName
        );

    const rows =
        records
            .map(record => `
                <tr>
                    <td>${escapeHtml(record.inning)}</td>

                    <td>
                        ${
                            record.batter ===
                            playerName
                                ? "타자"
                                : "투수"
                        }
                    </td>

                    <td>${escapeHtml(record.result)}</td>
                    <td>${Number(record.runs) || 0}</td>
                    <td>${Number(record.rbi) || 0}</td>
                    <td>${escapeHtml(record.note || "-")}</td>
                </tr>
            `)
            .join("");

    output.innerHTML = `
        <article class="report-paper">

            <h1>
                DIAMOND VISION 선수 개인 보고서
            </h1>

            <div class="report-info-grid">
                <div>
                    <span>선수명</span>
                    <strong>
                        ${escapeHtml(playerName)}
                    </strong>
                </div>

                <div>
                    <span>경기 날짜</span>
                    <strong>
                        ${escapeHtml(
                            $("todayDate")
                                ?.textContent || ""
                        )}
                    </strong>
                </div>

                <div>
                    <span>상대 경기</span>
                    <strong>
                        ${escapeHtml(getAwayTeamName())}
                        vs
                        ${escapeHtml(getHomeTeamName())}
                    </strong>
                </div>

                <div>
                    <span>기록 수</span>
                    <strong>
                        ${records.length}
                    </strong>
                </div>
            </div>

            <h2>타자 기록</h2>

            <div class="report-stat-grid">
                <div>
                    <span>타석</span>
                    <strong>${batter?.pa || 0}</strong>
                </div>

                <div>
                    <span>안타</span>
                    <strong>${batter?.hits || 0}</strong>
                </div>

                <div>
                    <span>홈런</span>
                    <strong>${batter?.homeRuns || 0}</strong>
                </div>

                <div>
                    <span>타점</span>
                    <strong>${batter?.rbi || 0}</strong>
                </div>

                <div>
                    <span>타율</span>
                    <strong>${metrics.average.toFixed(3)}</strong>
                </div>

                <div>
                    <span>출루율</span>
                    <strong>${metrics.onBase.toFixed(3)}</strong>
                </div>

                <div>
                    <span>장타율</span>
                    <strong>${metrics.slugging.toFixed(3)}</strong>
                </div>

                <div>
                    <span>OPS</span>
                    <strong>${metrics.ops.toFixed(3)}</strong>
                </div>
            </div>

            <h2>투수 기록</h2>

            <div class="report-stat-grid">
                <div>
                    <span>상대 타자</span>
                    <strong>${pitcher?.battersFaced || 0}</strong>
                </div>

                <div>
                    <span>투구 수</span>
                    <strong>${pitcher?.pitches || 0}</strong>
                </div>

                <div>
                    <span>스트라이크 비율</span>
                    <strong>${strikeRate.toFixed(1)}%</strong>
                </div>

                <div>
                    <span>삼진</span>
                    <strong>${pitcher?.strikeouts || 0}</strong>
                </div>

                <div>
                    <span>피안타</span>
                    <strong>${pitcher?.hitsAllowed || 0}</strong>
                </div>

                <div>
                    <span>실점</span>
                    <strong>${pitcher?.runsAllowed || 0}</strong>
                </div>

                <div>
                    <span>티바 전환</span>
                    <strong>${pitcher?.teeBatters || 0}</strong>
                </div>

                <div>
                    <span>볼</span>
                    <strong>${pitcher?.balls || 0}</strong>
                </div>
            </div>

            <h2>경기 기록</h2>

            <table class="report-table">
                <thead>
                    <tr>
                        <th>회차</th>
                        <th>역할</th>
                        <th>결과</th>
                        <th>득점</th>
                        <th>타점</th>
                        <th>메모</th>
                    </tr>
                </thead>

                <tbody>
                    ${
                        rows ||
                        `
                            <tr>
                                <td colspan="6">
                                    해당 선수 기록이 없습니다.
                                </td>
                            </tr>
                        `
                    }
                </tbody>
            </table>

            <div class="report-signature">
                Diamond Vision
            </div>

        </article>
    `;
}


/* =========================================================
   리포트 인쇄
========================================================= */

function printCurrentReport() {
    const report =
        $("reportOutput");

    if (
        !report ||
        !report.querySelector(
            ".report-paper"
        )
    ) {
        alert(
            "먼저 리포트를 생성해줘용."
        );

        return;
    }

    window.print();
}


/* =========================================================
   영상 기능
========================================================= */

function isYouTubeMode() {
    return Boolean(
        $("youtubePlayerWrap") &&
        !$("youtubePlayerWrap").hidden &&
        window.youtubePlayer
    );
}


function loadVideo(event) {
    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    if (localVideoObjectUrl) {
        URL.revokeObjectURL(
            localVideoObjectUrl
        );
    }

    localVideoObjectUrl =
        URL.createObjectURL(file);

    const video =
        $("video");

    if (!video) {
        return;
    }

    video.src =
        localVideoObjectUrl;

    video.style.display =
        "block";

    video.load();

    if ($("youtubePlayerWrap")) {
        $("youtubePlayerWrap").hidden =
            true;
    }
}


function extractYouTubeId(url) {
    const text =
        String(url || "");

    const patterns = [
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /embed\/([a-zA-Z0-9_-]{11})/,
        /shorts\/([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];

    for (
        const pattern of
        patterns
    ) {
        const match =
            text.match(pattern);

        if (match?.[1]) {
            return match[1];
        }
    }

    return "";
}


function loadYouTubeVideo() {
    const videoId =
        extractYouTubeId(
            $("youtubeUrl")
                ?.value || ""
        );

    if (!videoId) {
        alert(
            "유튜브 주소를 확인해줘용."
        );

        return;
    }

    pendingYouTubeId =
        videoId;

    if ($("video")) {
        $("video").pause();

        $("video").style.display =
            "none";
    }

    if ($("youtubePlayerWrap")) {
        $("youtubePlayerWrap").hidden =
            false;
    }

    if (
        window.youtubePlayer &&
        typeof window.youtubePlayer
            .loadVideoById ===
            "function"
    ) {
        window.youtubePlayer
            .loadVideoById(
                videoId
            );
    }
}


window.onYouTubeIframeAPIReady =
    function () {
        if (
            typeof YT ===
            "undefined"
        ) {
            return;
        }

        window.youtubePlayer =
            new YT.Player(
                "youtubePlayer",
                {
                    width:
                        "100%",

                    height:
                        "100%",

                    playerVars: {
                        playsinline:
                            1,

                        controls:
                            1,

                        rel:
                            0
                    },

                    events: {
                        onReady:
                            function () {
                                if (
                                    pendingYouTubeId
                                ) {
                                    window.youtubePlayer
                                        .loadVideoById(
                                            pendingYouTubeId
                                        );
                                }
                            }
                    }
                }
            );
    };


function getCurrentVideoTime() {
    if (isYouTubeMode()) {
        try {
            return (
                window.youtubePlayer
                    .getCurrentTime() || 0
            );
        } catch {
            return 0;
        }
    }

    return (
        $("video")
            ?.currentTime || 0
    );
}


function back5() {
    if (isYouTubeMode()) {
        window.youtubePlayer
            .seekTo(
                Math.max(
                    0,
                    getCurrentVideoTime() -
                        5
                ),

                true
            );

        return;
    }

    const video =
        $("video");

    if (video) {
        video.currentTime =
            Math.max(
                0,
                video.currentTime - 5
            );
    }
}


function forward5() {
    if (isYouTubeMode()) {
        window.youtubePlayer
            .seekTo(
                getCurrentVideoTime() +
                    5,

                true
            );

        return;
    }

    const video =
        $("video");

    if (video) {
        video.currentTime += 5;
    }
}


function playPause() {
    if (isYouTubeMode()) {
        const state =
            window.youtubePlayer
                .getPlayerState();

        if (
            typeof YT !==
                "undefined" &&
            state ===
                YT.PlayerState.PLAYING
        ) {
            window.youtubePlayer
                .pauseVideo();
        } else {
            window.youtubePlayer
                .playVideo();
        }

        return;
    }

    const video =
        $("video");

    if (!video) {
        return;
    }

    if (video.paused) {
        video
            .play()
            .catch(() => {});
    } else {
        video.pause();
    }
}


function setVideoSpeed(speed) {
    const value =
        Number(speed) || 1;

    if (isYouTubeMode()) {
        window.youtubePlayer
            .setPlaybackRate(
                value
            );

        return;
    }

    if ($("video")) {
        $("video").playbackRate =
            value;
    }
}


/* =========================================================
   경기 저장
========================================================= */

function saveGameState() {
    const state = {
        currentInning,
        isTopInning,

        ballCount,
        strikeCount,
        outCount,

        homeScore,
        awayScore,

        baseState,
        currentPitchSequence,
        selectedPlateResult,

        isTeeMode,
        teeReason,

        plateAppearances,

        lineups,
        battingOrderIndex,
        inningScores,

        homeTeamName:
            getHomeTeamName(),

        awayTeamName:
            getAwayTeamName(),

        sprayPoints,
        zonePoints
    };

    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state)
        );
    } catch (error) {
        console.error(
            "저장 실패:",
            error
        );
    }
}


/* =========================================================
   경기 불러오기
========================================================= */

function loadGameState() {
    let state = null;

    try {
        state =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_KEY
                ) || "null"
            );
    } catch (error) {
        console.error(
            "불러오기 실패:",
            error
        );
    }

    if (!state) {
        return;
    }

    currentInning =
        Number(
            state.currentInning
        ) || 1;

    isTopInning =
        state.isTopInning !== false;

    ballCount =
        Number(
            state.ballCount
        ) || 0;

    strikeCount =
        Number(
            state.strikeCount
        ) || 0;

    outCount =
        Number(
            state.outCount
        ) || 0;

    homeScore =
        Number(
            state.homeScore
        ) || 0;

    awayScore =
        Number(
            state.awayScore
        ) || 0;

    baseState = {
        first:
            Boolean(
                state.baseState?.first
            ),

        second:
            Boolean(
                state.baseState?.second
            ),

        third:
            Boolean(
                state.baseState?.third
            )
    };

    currentPitchSequence =
        Array.isArray(
            state.currentPitchSequence
        )
            ? state.currentPitchSequence
            : [];

    selectedPlateResult =
        state.selectedPlateResult ||
        "";

    isTeeMode =
        Boolean(
            state.isTeeMode
        );

    teeReason =
        state.teeReason ||
        "";

    plateAppearances =
        Array.isArray(
            state.plateAppearances
        )
            ? state.plateAppearances
            : [];

    lineups = {
        home:
            Array.isArray(
                state.lineups?.home
            )
                ? state.lineups.home
                : [],

        away:
            Array.isArray(
                state.lineups?.away
            )
                ? state.lineups.away
                : []
    };

    battingOrderIndex = {
        home:
            Number(
                state
                    .battingOrderIndex
                    ?.home
            ) || 0,

        away:
            Number(
                state
                    .battingOrderIndex
                    ?.away
            ) || 0
    };

    inningScores = {
        home: {
            ...(
                state
                    .inningScores
                    ?.home || {}
            )
        },

        away: {
            ...(
                state
                    .inningScores
                    ?.away || {}
            )
        }
    };

    sprayPoints =
        Array.isArray(
            state.sprayPoints
        )
            ? state.sprayPoints
            : [];

    zonePoints =
        Array.isArray(
            state.zonePoints
        )
            ? state.zonePoints
            : [];

    if (
        $("homeTeamName") &&
        state.homeTeamName
    ) {
        $("homeTeamName").value =
            state.homeTeamName;
    }

    if (
        $("awayTeamName") &&
        state.awayTeamName
    ) {
        $("awayTeamName").value =
            state.awayTeamName;
    }

    writeLineupsToInputs();
}


/* =========================================================
   HTML 문자 보호
========================================================= */

function escapeHtml(value) {
    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =========================================================
   사이드 메뉴
========================================================= */

function connectNavigation() {
    document
        .querySelectorAll(
            "[data-scroll]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                function () {
                    const target =
                        $(
                            button
                                .dataset
                                .scroll
                        );

                    target
                        ?.scrollIntoView({
                            behavior:
                                "smooth",

                            block:
                                "start"
                        });

                    document
                        .querySelectorAll(
                            ".side"
                        )
                        .forEach(item => {
                            item.classList.remove(
                                "active"
                            );
                        });

                    button.classList.add(
                        "active"
                    );
                }
            );
        });
}


/* =========================================================
   HTML onclick 연결
========================================================= */

window.previousInning =
    previousInning;

window.nextInning =
    nextInning;

window.toggleBase =
    toggleBase;

window.toggleLineupPanel =
    toggleLineupPanel;

window.saveLineups =
    saveLineups;

window.clearLineups =
    clearLineups;

window.addPitch =
    addPitch;

window.undoCurrentInput =
    undoCurrentInput;
    
window.setPlateResult =
    setPlateResult;

window.savePlateAppearance =
    savePlateAppearance;

window.undoLastPlateAppearance =
    undoLastPlateAppearance;

window.clearAllPlateAppearances =
    clearAllPlateAppearances;

window.resetGame =
    resetGame;

window.recordSpray =
    recordSpray;

window.clearSprayChart =
    clearSprayChart;

window.recordZone =
    recordZone;

window.clearStrikeZone =
    clearStrikeZone;

window.generateGameReport =
    generateGameReport;

window.generatePlayerReport =
    generatePlayerReport;

window.printCurrentReport =
    printCurrentReport;

window.loadVideo =
    loadVideo;

window.loadYouTubeVideo =
    loadYouTubeVideo;

window.back5 =
    back5;

window.forward5 =
    forward5;

window.playPause =
    playPause;

window.setVideoSpeed =
    setVideoSpeed;


/* =========================================================
   시작
========================================================= */

window.addEventListener(
    "load",
    function () {
        setTodayDate();

        renderLineupRows();
        loadGameState();

        connectNavigation();

        clampBattingOrderIndexes();
        rebuildStatistics();

        updateTeamTitles();
        updateInningDisplay();

        updateCountDisplay();
        updateScoreDisplay();
        updateBaseDisplay();

        updatePitchSequence();
        updateSelectedResult();
        updateTeeButtons();

        updateCurrentLineupDisplay();

        drawAllResults();
        drawSprayPoints();
        drawZonePoints();

        $("homeTeamName")
            ?.addEventListener(
                "input",
                function () {
                    updateTeamTitles();
                    drawAllResults();
                    saveGameState();
                }
            );

        $("awayTeamName")
            ?.addEventListener(
                "input",
                function () {
                    updateTeamTitles();
                    drawAllResults();
                    saveGameState();
                }
            );
    }
);
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