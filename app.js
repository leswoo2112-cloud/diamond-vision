"use strict";

/* =========================================================
   DIAMOND VISION
   경기 기록 + 전력분석 + 인쇄 리포트
========================================================= */

const STORAGE_KEY = "diamondVisionV4";

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
   날짜·팀
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
        !Object.prototype
            .hasOwnProperty
            .call(
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
   라인업 생성
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

            container.appendChild(
                row
            );
        }
    }
}


function toggleLineupPanel() {
    $("lineupSection")
        ?.classList
        .toggle("hidden");
}


function readLineupFromInputs(
    teamKey
) {
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
        readLineupFromInputs(
            "home"
        );

    lineups.away =
        readLineupFromInputs(
            "away"
        );

    const hasPlayer =
        lineups.home.some(
            player =>
                player.name
        ) ||
        lineups.away.some(
            player =>
                player.name
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
    saveGameState();
}


function getValidLineupPlayers(
    teamKey
) {
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


function getCurrentBatter(
    teamKey
) {
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


function getNextBatter(
    teamKey
) {
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


function advanceBattingOrder(
    teamKey
) {
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
            ?.closest(
                ".lineup-row"
            )
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
                        Number(
                            item.order
                        ) ===
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
   투구·티바 규칙
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
            "삼진" ||
        selectedPlateResult ===
            "티바 파울 아웃"
    ) {
        alert(
            "타석 결과가 확정됐어용. 타석 저장을 눌러줘용."
        );

        return;
    }

    /*
        티바에서는 파울만
        스트라이크로 추가
    */

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


function updatePitchSequence() {
    const element =
        $("pitchSequence");

    if (!element) {
        return;
    }

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


function setPlateResult(result) {
    /*
        데드볼은 자동 출루가 아니라
        현재 스트라이크를 유지하고 티바
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
            "이미 티바 파울 아웃이 확정됐어용."
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

            const blocked =
                isTeeMode &&
                (
                    text === "홈런" ||
                    text === "데드볼"
                );

            button.disabled =
                blocked;
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

    const numberValue =
        input.valueAsNumber;

    if (
        Number.isFinite(
            numberValue
        )
    ) {
        return Math.max(
            0,
            Math.floor(
                numberValue
            )
        );
    }

    return Math.max(
        0,
        parseInt(
            input.value,
            10
        ) || 0
    );
}


/* =========================================================
   타석 저장
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

    const result =
        normalizeResult(
            selectedPlateResult
        );

    let runs =
        getEnteredRuns();

    /*
        홈런은 입력값 대신
        현재 주자 + 타자 자동 득점
    */

    if (
        result === "홈런" &&
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

    const lineupBatter =
        getCurrentBatter(
            offenseKey
        );

    const snapshot =
        createGameSnapshot();

    const inningText =
        `${currentInning}회${isTopInning ? "초" : "말"}`;

    const baseBefore =
        getBaseText();

    const outsBefore =
        outCount;

    const scoreBefore =
        `${awayScore} : ${homeScore}`;

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

        battingOrder:
            lineupBatter?.order ||
            null,

        position:
            lineupBatter?.position ||
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

        runs,
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
/* =========================================================
   타석 결과 적용
========================================================= */

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
        normalized === "실책" ||
        normalized === "야수선택"
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
    updateScoreDisplay();
    updateBaseDisplay();
}


/* =========================================================
   주자 이동
========================================================= */

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

    /*
        3루타는 모든 기존 주자가 홈에 들어온 것으로 보고
        타자만 3루에 표시
    */

    if (baseAmount === 3) {
        newBases.third = true;
    }

    baseState =
        newBases;
}


/* =========================================================
   점수 반영
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
        초 공격 = AWAY
        말 공격 = HOME
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
   이닝·타석 초기화
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
   최근 타석 취소
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
            snapshot.isTopInning !== false;

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
    updateCurrentLineupDisplay();

    saveGameState();

    alert(
        "최근 타석 기록을 취소했어용."
    );
}


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
   분석 화면 전체 출력
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
   최근 타석 표
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


/* =========================================================
   타자 분석 출력
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


/* =========================================================
   투수 분석 출력
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
                                    <b>
                                        ${strikeRate.toFixed(1)}%
                                    </b>
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
                    <b>
                        ${player.metrics.ops.toFixed(3)}
                    </b>
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
                        · 득점 ${Number(record.runs) || 0}
                        · 타점 ${Number(record.rbi) || 0}
                    </div>
                </div>
            `)
            .join("");
}


/* =========================================================
   타구 차트
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

            element.appendChild(dot);
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

            element.appendChild(dot);
        }
    );
}


function clearStrikeZone() {
    zonePoints = [];

    drawZonePoints();
    saveGameState();
}


/* =========================================================
   리포트 선수 선택창
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
    updateReportPlayerSelect();

    const mvp =
        getMvpPlayer();

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

    const countStrikeouts =
        records =>
            records.filter(
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

    const totalHomeRuns =
        plateAppearances.filter(
            record =>
                normalizeResult(
                    record.result
                ) === "홈런"
        ).length;

    const resultText =
        awayScore > homeScore
            ? `${getAwayTeamName()}이(가) ${awayScore - homeScore}점 차로 앞섰습니다.`

            : homeScore > awayScore
                ? `${getHomeTeamName()}이(가) ${homeScore - awayScore}점 차로 앞섰습니다.`

                : "양 팀이 동점입니다.";

    const recordRows =
        plateAppearances
            .map(record => `
                <tr>
                    <td>${escapeHtml(record.inning)}</td>
                    <td>${escapeHtml(record.teamName)}</td>
                    <td>${escapeHtml(record.pitcher)}</td>
                    <td>${escapeHtml(record.batter)}</td>
                    <td>${escapeHtml(record.result)}</td>
                    <td>${Number(record.runs) || 0}</td>
                    <td>${Number(record.rbi) || 0}</td>
                    <td>${escapeHtml(record.scoreAfter)}</td>
                </tr>
            `)
            .join("");

    $("reportOutput").innerHTML = `
        <article class="report-paper">

            <h1>
                DIAMOND VISION 경기 분석 보고서
            </h1>

            <p>
                경기 날짜:
                ${escapeHtml(
                    $("todayDate")
                        ?.textContent || ""
                )}
            </p>

            <div class="report-info-grid">
                <div>
                    <span>HOME</span>
                    <strong>
                        ${escapeHtml(getHomeTeamName())}
                    </strong>
                </div>

                <div>
                    <span>AWAY</span>
                    <strong>
                        ${escapeHtml(getAwayTeamName())}
                    </strong>
                </div>

                <div>
                    <span>경기 스코어</span>
                    <strong>
                        ${awayScore} : ${homeScore}
                    </strong>
                </div>

                <div>
                    <span>기록 타석</span>
                    <strong>
                        ${plateAppearances.length}
                    </strong>
                </div>
            </div>

            <h2>경기 결과</h2>

            <p>
                ${escapeHtml(resultText)}
            </p>

            <h2>팀 기록 비교</h2>

            <div class="report-stat-grid">
                <div>
                    <span>HOME 득점</span>
                    <strong>${homeScore}</strong>
                </div>

                <div>
                    <span>AWAY 득점</span>
                    <strong>${awayScore}</strong>
                </div>

                <div>
                    <span>HOME 안타</span>
                    <strong>${countHits(homeRecords)}</strong>
                </div>

                <div>
                    <span>AWAY 안타</span>
                    <strong>${countHits(awayRecords)}</strong>
                </div>

                <div>
                    <span>HOME 삼진</span>
                    <strong>${countStrikeouts(homeRecords)}</strong>
                </div>

                <div>
                    <span>AWAY 삼진</span>
                    <strong>${countStrikeouts(awayRecords)}</strong>
                </div>

                <div>
                    <span>경기 홈런</span>
                    <strong>${totalHomeRuns}</strong>
                </div>

                <div>
                    <span>MVP</span>
                    <strong>
                        ${escapeHtml(
                            mvp
                                ? mvp.name
                                : "-"
                        )}
                    </strong>
                </div>
            </div>

            <h2>오늘의 MVP</h2>

            <p>
                ${
                    mvp
                        ? `${escapeHtml(mvp.name)} — 안타 ${mvp.stats.hits}, 홈런 ${mvp.stats.homeRuns}, 타점 ${mvp.stats.rbi}, OPS ${mvp.metrics.ops.toFixed(3)}`

                        : "선정 가능한 기록이 없습니다."
                }
            </p>

            <h2>경기 흐름 평가</h2>

            <p>
                총 ${plateAppearances.length}개의 타석이 기록됐으며,
                홈런은 ${totalHomeRuns}개입니다.
                타구 방향과 투구 위치 기록을 영상과 함께 비교하면
                공격과 수비의 특징을 더 정확히 분석할 수 있습니다.
            </p>

            <h2>타석별 기록</h2>

            <table class="report-table">
                <thead>
                    <tr>
                        <th>회차</th>
                        <th>팀</th>
                        <th>투수</th>
                        <th>타자</th>
                        <th>결과</th>
                        <th>득점</th>
                        <th>타점</th>
                        <th>스코어</th>
                    </tr>
                </thead>

                <tbody>
                    ${
                        recordRows ||
                        `
                            <tr>
                                <td colspan="8">
                                    저장된 기록이 없습니다.
                                </td>
                            </tr>
                        `
                    }
                </tbody>
            </table>

            <h2>다음 경기 체크 포인트</h2>

            <p>
                1. 득점권 상황에서의 타격 결과를 확인합니다.<br>
                2. 투수별 스트라이크 비율과 피안타를 비교합니다.<br>
                3. 티바 전환 뒤 파울 아웃 비율을 확인합니다.<br>
                4. 타구 방향과 스트라이크존을 영상과 비교합니다.
            </p>

            <div class="report-signature">
                분석 시스템: Diamond Vision
            </div>

        </article>
    `;
}


/* =========================================================
   선수 개인 리포트
========================================================= */

function generatePlayerReport() {
    rebuildStatistics();
    updateReportPlayerSelect();

    const playerName =
        $("reportPlayerSelect")
            ?.value || "";

    if (!playerName) {
        alert(
            "개인 리포트를 만들 선수를 선택해줘용."
        );

        return;
    }

    const batter =
        batterStats[playerName] ||
        null;

    const pitcher =
        pitcherStats[playerName] ||
        null;

    const batterMetrics =
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

    const playerRecords =
        plateAppearances.filter(
            record =>
                record.batter ===
                    playerName ||
                record.pitcher ===
                    playerName
        );

    let playerType =
        "기록 분석 대기";

    if (batter) {
        if (
            batter.homeRuns >= 1 ||
            batterMetrics.slugging >=
                0.600
        ) {
            playerType =
                "장타 생산형 타자";
        } else if (
            batterMetrics.average >=
            0.300
        ) {
            playerType =
                "컨택 중심형 타자";
        } else if (
            batter.strikeouts >
            batter.hits
        ) {
            playerType =
                "공격적 승부형 타자";
        } else {
            playerType =
                "균형형 타자";
        }
    }

    if (
        pitcher &&
        !batter
    ) {
        playerType =
            strikeRate >= 65
                ? "제구 중심형 투수"
                : "공격적 승부형 투수";
    }

    const recordRows =
        playerRecords
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

    const evaluation =
        batter
            ? `${playerName} 선수는 타율 ${batterMetrics.average.toFixed(3)}, 장타율 ${batterMetrics.slugging.toFixed(3)}, OPS ${batterMetrics.ops.toFixed(3)}를 기록했습니다. 안타 생산력과 삼진 비율을 함께 점검하는 것이 좋습니다.`

            : pitcher
                ? `${playerName} 선수는 총 ${pitcher.pitches}구를 던졌으며 스트라이크 비율은 ${strikeRate.toFixed(1)}%입니다. 피안타와 실점이 나온 상황을 영상과 비교하는 것이 좋습니다.`

                : "분석할 기록이 부족합니다.";

    $("reportOutput").innerHTML = `
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
                    <span>선수 유형</span>
                    <strong>
                        ${escapeHtml(playerType)}
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
                    <span>경기</span>
                    <strong>
                        ${escapeHtml(getAwayTeamName())}
                        vs
                        ${escapeHtml(getHomeTeamName())}
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
                    <strong>${batterMetrics.average.toFixed(3)}</strong>
                </div>

                <div>
                    <span>출루율</span>
                    <strong>${batterMetrics.onBase.toFixed(3)}</strong>
                </div>

                <div>
                    <span>장타율</span>
                    <strong>${batterMetrics.slugging.toFixed(3)}</strong>
                </div>

                <div>
                    <span>OPS</span>
                    <strong>${batterMetrics.ops.toFixed(3)}</strong>
                </div>
            </div>

            <h2>투수 기록</h2>

            <div class="report-stat-grid">
                <div>
                    <span>상대한 타자</span>
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

            <h2>개인 경기 평가</h2>

            <p>
                ${escapeHtml(evaluation)}
            </p>

            <h2>선수 경기 로그</h2>

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
                        recordRows ||
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

            <h2>다음 경기 체크 포인트</h2>

            <p>
                1. 성공한 타석과 실패한 타석의 투구 위치를 비교합니다.<br>
                2. 타구 방향과 경기 영상을 함께 확인합니다.<br>
                3. 삼진 또는 피안타가 나온 상황을 분석합니다.<br>
                4. 다음 경기에서 보완할 목표 한 가지를 정합니다.
            </p>

            <div class="report-signature">
                분석 시스템: Diamond Vision
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
            "먼저 경기 리포트나 선수 개인 리포트를 생성해줘용."
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
        return (
            window.youtubePlayer
                .getCurrentTime() || 0
        );
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
   저장
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


/* =========================================================
   불러오기
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
        console.warn(
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
   HTML 문자 보호
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


/* =========================================================
   사이드 메뉴 이동
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