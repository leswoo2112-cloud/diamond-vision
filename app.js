"use strict";

/* =========================================================
   Diamond Vision 3.0
========================================================= */

const STORAGE_KEY = "diamondVisionV3";

const $ = id =>
    document.getElementById(id);


/* =========================================================
   경기 상태
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
   기본 화면
========================================================= */

function setTodayDate() {
    const element =
        $("todayDate");

    if (!element) return;

    const today = new Date();

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
        $("homeLineupTitle")
            .textContent =
            getHomeTeamName();
    }

    if ($("awayLineupTitle")) {
        $("awayLineupTitle")
            .textContent =
            getAwayTeamName();
    }

    updateCurrentLineupDisplay();
}


/* =========================================================
   이닝
========================================================= */

function updateInningDisplay() {
    if ($("inningDisplay")) {
        $("inningDisplay")
            .textContent =
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
   카운트·점수·베이스
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

        if (!container) continue;

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

    const hasPlayers =
        lineups.home.some(
            player => player.name
        ) ||
        lineups.away.some(
            player => player.name
        );

    if (!hasPlayers) {
        alert(
            "선수 이름을 한 명 이상 입력해줘용."
        );

        return;
    }

    clampBattingOrderIndexes();

    updateTeamTitles();
    updateCurrentLineupDisplay();
    saveGameState();

    alert(
        "라인업을 저장했어용."
    );
}


function clearLineups() {
    const confirmed =
        confirm(
            "양 팀 라인업을 초기화할까용?"
        );

    if (!confirmed) return;

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

        if (players.length === 0) {
            battingOrderIndex[teamKey] = 0;
            continue;
        }

        if (
            battingOrderIndex[teamKey] >=
            players.length
        ) {
            battingOrderIndex[teamKey] = 0;
        }
    }
}


function getCurrentBatter(teamKey) {
    const players =
        getValidLineupPlayers(
            teamKey
        );

    if (players.length === 0) {
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

    if (players.length === 0) {
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

    if (players.length === 0) {
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
                    lineups[teamKey] || []
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
   투구 및 티바 규칙
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
        selectedPlateResult ===
            "티바 파울 아웃" ||
        selectedPlateResult ===
            "삼진"
    ) {
        alert(
            "타석 결과가 확정됐어용. 타석 저장을 눌러줘용."
        );

        return;
    }

    /*
        티바 상태:
        파울만 추가 입력 가능
    */

    if (isTeeMode) {
        if (type !== "F") {
            alert(
                "현재 티바 타격 중이에용. 파울이나 타격 결과를 입력해줘용."
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
        updateTeeButtons();
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

    /*
        일반 야구 파울:
        2스트라이크 전까지만 증가
    */

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


function updatePitchSequence() {
    const element =
        $("pitchSequence");

    if (!element) return;

    if (
        currentPitchSequence.length ===
        0
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

                const displayName =
                    pitch === "TF"
                        ? "티바 파울"
                        : pitch;

                return `
                    <span class="pitch-chip ${className}">
                        ${displayName}
                    </span>
                `;
            })
            .join("");
}


function setPlateResult(result) {
    /*
        데드볼 → 출루가 아닌 티바 전환
        기존 스트라이크 유지
    */

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
            "티바 파울 아웃이 확정됐어용."
        );

        return;
    }

    if (
        isTeeMode &&
        result === "홈런"
    ) {
        alert(
            "티바 타격에는 홈런이 없어용."
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

    if (!element) return;

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
            const buttonText =
                button.textContent.trim();

            const blocked =
                isTeeMode &&
                (
                    buttonText === "홈런" ||
                    buttonText === "데드볼"
                );

            button.disabled =
                blocked;
        });
}


function normalizeResult(result) {
    return String(result || "")
        .replace(/^티바\s*/, "")
        .trim();
}


/* =========================================================
   타석 결과와 득점
========================================================= */

function createSnapshot() {
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
            "타석 결과를 선택해줘용."
        );

        return;
    }

    const normalizedResult =
        normalizeResult(
            selectedPlateResult
        );

    let runs =
        Math.max(
            0,
            Number(
                $("runScored")
                    ?.value
            ) || 0
        );

    /*
        홈런만 자동 득점
        주자 + 타자
    */

    if (
        normalizedResult === "홈런" &&
        !isTeeMode
    ) {
        runs =
            countBaseRunners() + 1;
    }

    const rbi =
        Math.max(
            0,
            Number(
                $("rbi")
                    ?.value
            ) || 0
        );

    const offenseKey =
        getCurrentOffenseKey();

    const snapshot =
        createSnapshot();

    const inningText =
        `${currentInning}회${isTopInning ? "초" : "말"}`;

    const teeModeAtSave =
        isTeeMode;

    const teeReasonAtSave =
        teeReason;

    applyPlateResult(
        selectedPlateResult,
        runs,
        teeModeAtSave
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

        runs,
        rbi,

        note:
            $("playNote")
                ?.value
                .trim() || "",

        scoreAfter:
            `${awayScore} : ${homeScore}`,

        teeMode:
            teeModeAtSave,

        teeReason:
            teeReasonAtSave
    });

    advanceBattingOrder(
        offenseKey
    );

    const reachedThreeOuts =
        outCount >= 3;

    resetCurrentPlateAppearance();

    if (reachedThreeOuts) {
        finishHalfInning();
    }

    rebuildStatistics();
    drawAllResults();
    saveGameState();
}


function applyPlateResult(
    result,
    runs,
    teeModeAtSave
) {
    const normalized =
        normalizeResult(result);

    let addedOuts = 0;

    if (normalized === "안타") {
        advanceRunners(1);
        baseState.first = true;
    }

    if (normalized === "2루타") {
        advanceRunners(2);
        baseState.second = true;
    }

    if (normalized === "3루타") {
        advanceRunners(3);
        baseState.third = true;
    }

    if (
        normalized === "홈런" &&
        !teeModeAtSave
    ) {
        baseState = {
            first: false,
            second: false,
            third: false
        };
    }

    if (
        [
            "삼진",
            "티바 파울 아웃",
            "땅볼",
            "뜬공",
            "라인드라이브",
            "희생플라이",
            "번트"
        ].includes(normalized)
    ) {
        addedOuts = 1;
    }

    if (
        [
            "실책",
            "야수선택"
        ].includes(normalized)
    ) {
        baseState.first = true;
    }

    outCount =
        Math.min(
            3,
            outCount + addedOuts
        );

    addRuns(runs);

    updateCountDisplay();
    updateBaseDisplay();
    updateScoreDisplay();
}


function advanceRunners(baseAmount) {
    const oldBases = {
        ...baseState
    };

    const newBases = {
        first: false,
        second: false,
        third: false
    };

    if (baseAmount === 1) {
        if (oldBases.first) {
            newBases.second = true;
        }

        if (oldBases.second) {
            newBases.third = true;
        }
    }

    if (baseAmount === 2) {
        if (oldBases.first) {
            newBases.third = true;
        }
    }

    baseState =
        newBases;
}


function addRuns(runs) {
    const value =
        Number(runs);

    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return;
    }

    /*
        초 = AWAY
        말 = HOME
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
   타석·반이닝 초기화
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
    updateBaseDisplay();
    updatePitchSequence();
    updateSelectedResult();
    updateTeeButtons();
    updateCurrentLineupDisplay();
}


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


function resetCurrentPlateAppearance() {
    ballCount = 0;
    strikeCount = 0;

    currentPitchSequence = [];
    selectedPlateResult = "";

    isTeeMode = false;
    teeReason = "";

    if ($("runScored")) {
        $("runScored").value = "0";
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
    updateCurrentLineupDisplay();
}


/* =========================================================
   최근 기록 취소
========================================================= */

function undoLastPlateAppearance() {
    if (
        plateAppearances.length === 0
    ) {
        alert(
            "취소할 기록이 없어용."
        );

        return;
    }

    const record =
        plateAppearances.pop();

    const snapshot =
        record.beforeState;

    if (snapshot) {
        currentInning =
            Number(
                snapshot.currentInning
            ) || 1;

        isTopInning =
            snapshot.isTopInning !==
            false;

        ballCount =
            Number(
                snapshot.ballCount
            ) || 0;

        strikeCount =
            Number(
                snapshot.strikeCount
            ) || 0;

        outCount =
            Number(
                snapshot.outCount
            ) || 0;

        homeScore =
            Number(
                snapshot.homeScore
            ) || 0;

        awayScore =
            Number(
                snapshot.awayScore
            ) || 0;

        baseState = {
            first:
                Boolean(
                    snapshot
                        .baseState
                        ?.first
                ),

            second:
                Boolean(
                    snapshot
                        .baseState
                        ?.second
                ),

            third:
                Boolean(
                    snapshot
                        .baseState
                        ?.third
                )
        };

        battingOrderIndex = {
            home:
                Number(
                    snapshot
                        .battingOrderIndex
                        ?.home
                ) || 0,

            away:
                Number(
                    snapshot
                        .battingOrderIndex
                        ?.away
                ) || 0
        };

        inningScores = {
            home: {
                ...(
                    snapshot
                        .inningScores
                        ?.home || {}
                )
            },

            away: {
                ...(
                    snapshot
                        .inningScores
                        ?.away || {}
                )
            }
        };
    }

    resetCurrentPlateAppearance();
    rebuildStatistics();
    drawAllResults();

    updateInningDisplay();
    updateCountDisplay();
    updateScoreDisplay();
    updateBaseDisplay();

    saveGameState();
}


/* =========================================================
   통계 계산
========================================================= */

function rebuildStatistics() {
    batterStats = {};
    pitcherStats = {};

    for (
        const record of
        plateAppearances
    ) {
        updateBatterStatistic(
            record
        );

        updatePitcherStatistic(
            record
        );
    }
}


function updateBatterStatistic(record) {
    const name =
        record.batter;

    if (!batterStats[name]) {
        batterStats[name] = {
            team:
                record.teamName,

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
    stats.ab += 1;

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
        [
            "삼진",
            "티바 파울 아웃"
        ].includes(result)
    ) {
        stats.strikeouts += 1;
    }
}


function updatePitcherStatistic(record) {
    const name =
        record.pitcher;

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
        [
            "삼진",
            "티바 파울 아웃"
        ].includes(result)
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
   기록표·분석 화면
========================================================= */

function drawAllResults() {
    drawRecordTable();
    drawBatterStats();
    drawPitcherStats();
    drawCharts();
    drawMVP();
    drawTeamCompare();
    drawHighlights();
}


function drawRecordTable() {
    const body =
        $("recordTableBody");

    if (!body) return;

    if (
        plateAppearances.length ===
        0
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
        [
            ...plateAppearances
        ]
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

    /*
        볼넷·데드볼이 티바로 이어지므로
        출루율은 현재 데이터에서
        안타 기반으로 계산
    */

    const onBase =
        stats.ab > 0
            ? stats.hits /
                stats.ab
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


function drawBatterStats() {
    const element =
        $("batterStats");

    if (!element) return;

    const entries =
        Object.entries(
            batterStats
        );

    if (entries.length === 0) {
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

                            <div class="mini-grid">
                                <div>
                                    <span>AVG</span>
                                    <b>
                                        ${metrics.average.toFixed(3)}
                                    </b>
                                </div>

                                <div>
                                    <span>OBP</span>
                                    <b>
                                        ${metrics.onBase.toFixed(3)}
                                    </b>
                                </div>

                                <div>
                                    <span>SLG</span>
                                    <b>
                                        ${metrics.slugging.toFixed(3)}
                                    </b>
                                </div>

                                <div>
                                    <span>OPS</span>
                                    <b>
                                        ${metrics.ops.toFixed(3)}
                                    </b>
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


function drawPitcherStats() {
    const element =
        $("pitcherStats");

    if (!element) return;

    const entries =
        Object.entries(
            pitcherStats
        );

    if (entries.length === 0) {
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
                                    <span>투구 수</span>
                                    <b>${stats.pitches}</b>
                                </div>

                                <div>
                                    <span>스트%</span>
                                    <b>
                                        ${strikeRate.toFixed(1)}%
                                    </b>
                                </div>

                                <div>
                                    <span>삼진</span>
                                    <b>${stats.strikeouts}</b>
                                </div>

                                <div>
                                    <span>실점</span>
                                    <b>${stats.runsAllowed}</b>
                                </div>

                                <div>
                                    <span>피안타</span>
                                    <b>${stats.hitsAllowed}</b>
                                </div>

                                <div>
                                    <span>타자 수</span>
                                    <b>${stats.battersFaced}</b>
                                </div>

                                <div>
                                    <span>볼</span>
                                    <b>${stats.balls}</b>
                                </div>

                                <div>
                                    <span>티바</span>
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
   차트
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

    if (!canvas) return;

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
                                        inningScores
                                            .home[
                                            index +
                                            1
                                        ] || 0
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
                                        inningScores
                                            .away[
                                            index +
                                            1
                                        ] || 0
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
                        false,

                    plugins: {
                        legend: {
                            labels: {
                                color:
                                    "#dbe6f5"
                            }
                        }
                    },

                    scales: {
                        x: {
                            ticks: {
                                color:
                                    "#8695a9"
                            },

                            grid: {
                                color:
                                    "rgba(134,149,169,0.1)"
                            }
                        },

                        y: {
                            beginAtZero:
                                true,

                            ticks: {
                                color:
                                    "#8695a9",

                                precision:
                                    0
                            },

                            grid: {
                                color:
                                    "rgba(134,149,169,0.1)"
                            }
                        }
                    }
                }
            }
        );
}


function drawResultChart() {
    const canvas =
        $("resultChart");

    if (!canvas) return;

    const counts = {};

    plateAppearances.forEach(
        record => {
            const key =
                record.result ||
                "기타";

            counts[key] =
                (
                    counts[key] ||
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
                        false,

                    plugins: {
                        legend: {
                            position:
                                "bottom",

                            labels: {
                                color:
                                    "#dbe6f5"
                            }
                        }
                    }
                }
            }
        );
}


/* =========================================================
   MVP·팀 비교·하이라이트
========================================================= */

function getMvpPlayer() {
    const entries =
        Object.entries(
            batterStats
        );

    if (entries.length === 0) {
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

    if (!element) return;

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
                    <b>
                        ${player.metrics.ops.toFixed(3)}
                    </b>
                </div>
            </div>
        </div>
    `;
}


function drawTeamCompare() {
    const element =
        $("teamCompare");

    if (!element) return;

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

    const homeHits =
        homeRecords.filter(
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

    const awayHits =
        awayRecords.filter(
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
                <span>
                    ${escapeHtml(getHomeTeamName())} 득점
                </span>
                <b>${homeScore}</b>
            </div>

            <div>
                <span>
                    ${escapeHtml(getAwayTeamName())} 득점
                </span>
                <b>${awayScore}</b>
            </div>

            <div>
                <span>HOME 안타</span>
                <b>${homeHits}</b>
            </div>

            <div>
                <span>AWAY 안타</span>
                <b>${awayHits}</b>
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


function drawHighlights() {
    const element =
        $("highlightList");

    if (!element) return;

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

    if (highlights.length === 0) {
        element.innerHTML =
            "기록을 저장하면 주요 장면이 표시됩니다.";

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
                        ·
                        득점 ${Number(record.runs) || 0}
                        ·
                        타점 ${Number(record.rbi) || 0}
                    </div>
                </div>
            `)
            .join("");
}


/* =========================================================
   타구 방향과 스트라이크존
========================================================= */

function recordSpray(event) {
    const element =
        event.currentTarget;

    const rect =
        element.getBoundingClientRect();

    const x =
        (
            event.clientX -
            rect.left
        ) / rect.width;

    const y =
        (
            event.clientY -
            rect.top
        ) / rect.height;

    sprayPoints.push({
        x,
        y
    });

    drawSprayPoints();
    saveGameState();
}


function recordZone(event) {
    const element =
        event.currentTarget;

    const rect =
        element.getBoundingClientRect();

    const x =
        (
            event.clientX -
            rect.left
        ) / rect.width;

    const y =
        (
            event.clientY -
            rect.top
        ) / rect.height;

    zonePoints.push({
        x,
        y
    });

    drawZonePoints();
    saveGameState();
}


function drawSprayPoints() {
    const element =
        $("sprayChart");

    if (!element) return;

    element
        .querySelectorAll(
            ".spray-dot"
        )
        .forEach(dot => {
            dot.remove();
        });

    sprayPoints.forEach(point => {
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

        element.appendChild(dot);
    });
}


function drawZonePoints() {
    const element =
        $("strikeZone");

    if (!element) return;

    element
        .querySelectorAll(
            ".zone-dot"
        )
        .forEach(dot => {
            dot.remove();
        });

    zonePoints.forEach(point => {
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

        element.appendChild(dot);
    });
}


function clearSprayChart() {
    sprayPoints = [];

    drawSprayPoints();
    saveGameState();
}


function clearStrikeZone() {
    zonePoints = [];

    drawZonePoints();
    saveGameState();
}


/* =========================================================
   자동 전력분석 리포트
========================================================= */

function generateReport() {
    rebuildStatistics();

    const mvp =
        getMvpPlayer();

    const totalHomeRuns =
        plateAppearances.filter(
            record =>
                normalizeResult(
                    record.result
                ) === "홈런"
        ).length;

    const totalStrikeouts =
        plateAppearances.filter(
            record =>
                [
                    "삼진",
                    "티바 파울 아웃"
                ].includes(
                    normalizeResult(
                        record.result
                    )
                )
        ).length;

    const pitcherLines =
        Object.entries(
            pitcherStats
        )
            .map(
                ([name, stats]) => {
                    const rate =
                        stats.pitches > 0
                            ? (
                                stats.strikes /
                                stats.pitches
                            ) * 100
                            : 0;

                    return (
                        `${name}: ` +
                        `${stats.pitches}구, ` +
                        `스트라이크 비율 ${rate.toFixed(1)}%, ` +
                        `삼진 ${stats.strikeouts}, ` +
                        `피안타 ${stats.hitsAllowed}, ` +
                        `실점 ${stats.runsAllowed}`
                    );
                }
            )
            .join("\n");

    const report = `
[경기 결과]
${getAwayTeamName()} ${awayScore} : ${homeScore} ${getHomeTeamName()}

[경기 흐름]
현재 ${currentInning}회${isTopInning ? "초" : "말"}이며 총 ${plateAppearances.length}개의 타석이 기록됐습니다.

[공격 분석]
홈런 ${totalHomeRuns}개, 삼진 및 티바 파울 아웃 ${totalStrikeouts}개가 기록됐습니다.
HOME은 ${homeScore}점, AWAY는 ${awayScore}점을 기록했습니다.

[투수 분석]
${pitcherLines || "투수 기록이 없습니다."}

[MVP]
${
    mvp
        ? `${mvp.name} — 안타 ${mvp.stats.hits}, 홈런 ${mvp.stats.homeRuns}, 타점 ${mvp.stats.rbi}, OPS ${mvp.metrics.ops.toFixed(3)}`
        : "아직 MVP를 선정할 기록이 없습니다."
}

[자동 한 줄 평가]
${
    mvp
        ? `${mvp.name}이(가) 공격 생산력에서 가장 높은 기여도를 보인 경기입니다.`
        : "기록을 더 입력하면 선수와 팀의 특징을 자동으로 분석합니다."
}

[다음 경기 체크 포인트]
1. 득점권 상황에서 타구 방향과 결과를 비교합니다.
2. 투수별 스트라이크 비율과 티바 전환 횟수를 확인합니다.
3. 삼진과 티바 파울 아웃 비율을 줄일 수 있는 타격 전략을 준비합니다.
    `.trim();

    if ($("reportOutput")) {
        $("reportOutput")
            .textContent =
            report;
    }
}


/* =========================================================
   영상
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

    if (!file) return;

    if (localVideoObjectUrl) {
        URL.revokeObjectURL(
            localVideoObjectUrl
        );
    }

    localVideoObjectUrl =
        URL.createObjectURL(file);

    const video =
        $("video");

    if (!video) return;

    video.src =
        localVideoObjectUrl;

    video.style.display =
        "block";

    video.load();

    if ($("youtubePlayerWrap")) {
        $("youtubePlayerWrap")
            .hidden = true;
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
        $("youtubePlayerWrap")
            .hidden = false;
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


function back5() {
    if (isYouTubeMode()) {
        const time =
            window.youtubePlayer
                .getCurrentTime() || 0;

        window.youtubePlayer
            .seekTo(
                Math.max(
                    0,
                    time - 5
                ),
                true
            );

        return;
    }

    const video =
        $("video");

    if (!video) return;

    video.currentTime =
        Math.max(
            0,
            video.currentTime - 5
        );
}


function forward5() {
    if (isYouTubeMode()) {
        const time =
            window.youtubePlayer
                .getCurrentTime() || 0;

        window.youtubePlayer
            .seekTo(
                time + 5,
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

    if (!video) return;

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

    const video =
        $("video");

    if (video) {
        video.playbackRate =
            value;
    }
}


/* =========================================================
   저장과 불러오기
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
        console.warn(
            "저장 실패:",
            error
        );
    }
}


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
        console.warn(
            "불러오기 실패:",
            error
        );
    }

    if (!state) return;

    currentInning =
        Number(
            state.currentInning
        ) || 1;

    isTopInning =
        state.isTopInning !==
        false;

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
        state.teeReason || "";

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
   기타
========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
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

                    target?.scrollIntoView({
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