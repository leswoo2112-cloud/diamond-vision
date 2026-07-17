/* =========================================================
   DiamondVision 1.0
   라인업 + 자동 타순 + 티바 특별 규칙
========================================================= */

"use strict";


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

let plateAppearances = [];


/* =========================================================
   라인업 상태
========================================================= */

let lineups = {
    home: [],
    away: []
};

/*
    배열 번호는 0부터 시작합니다.

    0 = 1번 타자
    1 = 2번 타자
    ...
    8 = 9번 타자
*/

let battingOrderIndex = {
    home: 0,
    away: 0
};


/* =========================================================
   통계
========================================================= */

let batterStats = {};
let pitcherStats = {};

let inningScores = {
    home: {},
    away: {}
};

let inningScoreChart = null;
let resultChart = null;


/* =========================================================
   영상
========================================================= */

let pendingYouTubeId = "";
let localVideoObjectUrl = "";

window.youtubePlayer = null;


/* =========================================================
   DOM 요소
========================================================= */

const video =
    document.getElementById("video");

const inningDisplay =
    document.getElementById("inningDisplay");

const ballCountElement =
    document.getElementById("ballCount");

const strikeCountElement =
    document.getElementById("strikeCount");

const outCountElement =
    document.getElementById("outCount");

const homeScoreElement =
    document.getElementById("homeScore");

const awayScoreElement =
    document.getElementById("awayScore");

const base1Element =
    document.getElementById("base1");

const base2Element =
    document.getElementById("base2");

const base3Element =
    document.getElementById("base3");

const pitchSequenceElement =
    document.getElementById("pitchSequence");

const pitchCountText =
    document.getElementById("pitchCountText");

const selectedResultElement =
    document.getElementById("selectedResult");

const recordTableBody =
    document.getElementById("recordTableBody");

const batterStatsElement =
    document.getElementById("batterStats");

const pitcherStatsElement =
    document.getElementById("pitcherStats");

const mvpCard =
    document.getElementById("mvpCard");

const lineupPanel =
    document.getElementById("lineupPanel");

const currentOffenseTeamElement =
    document.getElementById("currentOffenseTeam");

const currentBatterDisplay =
    document.getElementById("currentBatterDisplay");

const nextBatterDisplay =
    document.getElementById("nextBatterDisplay");

const homeCurrentOrderBadge =
    document.getElementById("homeCurrentOrderBadge");

const awayCurrentOrderBadge =
    document.getElementById("awayCurrentOrderBadge");


/* =========================================================
   날짜
========================================================= */

function setTodayDate() {
    const dateElement =
        document.getElementById("todayDate");

    if (!dateElement) return;

    const today = new Date();

    const year =
        today.getFullYear();

    const month =
        String(today.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(today.getDate())
            .padStart(2, "0");

    dateElement.textContent =
        `${year}. ${month}. ${day}`;
}


/* =========================================================
   팀 이름
========================================================= */

function getHomeTeamName() {
    const input =
        document.getElementById("homeTeamName");

    const value =
        input
            ? input.value.trim()
            : "";

    return value || "HOME";
}


function getAwayTeamName() {
    const input =
        document.getElementById("awayTeamName");

    const value =
        input
            ? input.value.trim()
            : "";

    return value || "AWAY";
}


function updateTeamTitles() {
    const homeTitle =
        document.getElementById("homeLineupTitle");

    const awayTitle =
        document.getElementById("awayLineupTitle");

    if (homeTitle) {
        homeTitle.textContent =
            getHomeTeamName();
    }

    if (awayTitle) {
        awayTitle.textContent =
            getAwayTeamName();
    }

    updateCurrentLineupDisplay();
}


/* =========================================================
   공격팀
========================================================= */

function getCurrentOffenseKey() {
    /*
        초 = 원정팀 공격
        말 = 홈팀 공격
    */

    return isTopInning
        ? "away"
        : "home";
}


function getCurrentDefenseKey() {
    return isTopInning
        ? "home"
        : "away";
}


function getTeamName(teamKey) {
    return teamKey === "home"
        ? getHomeTeamName()
        : getAwayTeamName();
}


/* =========================================================
   이닝
========================================================= */

function updateInningDisplay() {
    if (!inningDisplay) return;

    inningDisplay.textContent =
        `${currentInning}회${isTopInning ? "초" : "말"}`;

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

window.previousInning = previousInning;
window.nextInning = nextInning;


/* =========================================================
   점수 및 카운트
========================================================= */

function updateCountDisplay() {
    if (ballCountElement) {
        ballCountElement.textContent =
            ballCount;
    }

    if (strikeCountElement) {
        strikeCountElement.textContent =
            strikeCount;
    }

    if (outCountElement) {
        outCountElement.textContent =
            outCount;
    }
}


function updateScoreDisplay() {
    if (homeScoreElement) {
        homeScoreElement.textContent =
            homeScore;
    }

    if (awayScoreElement) {
        awayScoreElement.textContent =
            awayScore;
    }
}


/* =========================================================
   베이스
========================================================= */

function updateBaseDisplay() {
    if (base1Element) {
        base1Element.classList.toggle(
            "active",
            baseState.first
        );
    }

    if (base2Element) {
        base2Element.classList.toggle(
            "active",
            baseState.second
        );
    }

    if (base3Element) {
        base3Element.classList.toggle(
            "active",
            baseState.third
        );
    }
}


function toggleBase(baseName) {
    if (baseName === "first") {
        baseState.first =
            !baseState.first;
    }

    if (baseName === "second") {
        baseState.second =
            !baseState.second;
    }

    if (baseName === "third") {
        baseState.third =
            !baseState.third;
    }

    updateBaseDisplay();
    saveGameState();
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
   라인업 패널
========================================================= */

function toggleLineupPanel() {
    if (!lineupPanel) return;

    lineupPanel.classList.toggle("hidden");
}

window.toggleLineupPanel =
    toggleLineupPanel;


/* =========================================================
   라인업 입력 읽기
========================================================= */

function readLineupFromInputs(teamKey) {
    const players = [];

    for (
        let order = 1;
        order <= 9;
        order += 1
    ) {
        const playerInput =
            document.getElementById(
                `${teamKey}Player${order}`
            );

        const positionInput =
            document.getElementById(
                `${teamKey}Position${order}`
            );

        const name =
            playerInput
                ? playerInput.value.trim()
                : "";

        const position =
            positionInput
                ? positionInput.value
                : "";

        players.push({
            order: order,
            name: name,
            position: position
        });
    }

    return players;
}


/* =========================================================
   라인업 저장
========================================================= */

function saveLineups() {
    const homeLineup =
        readLineupFromInputs("home");

    const awayLineup =
        readLineupFromInputs("away");

    const homePlayerCount =
        homeLineup.filter(
            player => player.name
        ).length;

    const awayPlayerCount =
        awayLineup.filter(
            player => player.name
        ).length;

    if (
        homePlayerCount === 0 &&
        awayPlayerCount === 0
    ) {
        alert(
            "HOME 또는 AWAY 라인업에 선수 이름을 입력해주세요."
        );

        return;
    }

    lineups.home =
        homeLineup;

    lineups.away =
        awayLineup;

    clampBattingOrderIndexes();

    updateTeamTitles();
    updateCurrentLineupDisplay();
    highlightCurrentBatter();

    saveGameState();

    alert("라인업을 저장했습니다.");
}

window.saveLineups = saveLineups;


/* =========================================================
   라인업 초기화
========================================================= */

function clearLineups() {
    const shouldClear =
        confirm(
            "양 팀 라인업과 타순 진행 상태를 초기화할까요?"
        );

    if (!shouldClear) return;

    for (
        const teamKey of ["home", "away"]
    ) {
        for (
            let order = 1;
            order <= 9;
            order += 1
        ) {
            const playerInput =
                document.getElementById(
                    `${teamKey}Player${order}`
                );

            const positionInput =
                document.getElementById(
                    `${teamKey}Position${order}`
                );

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
    highlightCurrentBatter();
    saveGameState();
}

window.clearLineups = clearLineups;


/* =========================================================
   빈 타순 건너뛰기
========================================================= */

function getValidLineupPlayers(teamKey) {
    const lineup =
        lineups[teamKey] || [];

    return lineup.filter(
        player =>
            player &&
            player.name
    );
}


function clampBattingOrderIndexes() {
    for (
        const teamKey of ["home", "away"]
    ) {
        const validPlayers =
            getValidLineupPlayers(teamKey);

        if (validPlayers.length === 0) {
            battingOrderIndex[teamKey] = 0;
            continue;
        }

        if (
            battingOrderIndex[teamKey] >=
            validPlayers.length
        ) {
            battingOrderIndex[teamKey] = 0;
        }
    }
}


/* =========================================================
   현재·다음 타자
========================================================= */

function getCurrentBatter(teamKey) {
    const validPlayers =
        getValidLineupPlayers(teamKey);

    if (validPlayers.length === 0) {
        return null;
    }

    const index =
        battingOrderIndex[teamKey] %
        validPlayers.length;

    return validPlayers[index];
}


function getNextBatter(teamKey) {
    const validPlayers =
        getValidLineupPlayers(teamKey);

    if (validPlayers.length === 0) {
        return null;
    }

    const nextIndex =
        (
            battingOrderIndex[teamKey] + 1
        ) % validPlayers.length;

    return validPlayers[nextIndex];
}


/* =========================================================
   현재 타순 화면
========================================================= */

function updateCurrentLineupDisplay() {
    const offenseKey =
        getCurrentOffenseKey();

    const currentBatter =
        getCurrentBatter(offenseKey);

    const nextBatter =
        getNextBatter(offenseKey);

    if (currentOffenseTeamElement) {
        currentOffenseTeamElement.textContent =
            `${offenseKey.toUpperCase()} · ${getTeamName(offenseKey)}`;
    }

    if (currentBatterDisplay) {
        if (currentBatter) {
            const positionText =
                currentBatter.position
                    ? ` · ${currentBatter.position}`
                    : "";

            currentBatterDisplay.textContent =
                `${currentBatter.order}번 ${currentBatter.name}${positionText}`;
        } else {
            currentBatterDisplay.textContent =
                "라인업을 등록해주세요";
        }
    }

    if (nextBatterDisplay) {
        if (nextBatter) {
            nextBatterDisplay.textContent =
                `${nextBatter.order}번 ${nextBatter.name}`;
        } else {
            nextBatterDisplay.textContent =
                "-";
        }
    }

    updateBattingOrderBadges();
    fillCurrentBatterInput();
    highlightCurrentBatter();
}


/* =========================================================
   타순 배지
========================================================= */

function updateBattingOrderBadges() {
    const homeBatter =
        getCurrentBatter("home");

    const awayBatter =
        getCurrentBatter("away");

    if (homeCurrentOrderBadge) {
        homeCurrentOrderBadge.textContent =
            homeBatter
                ? `다음 타순 ${homeBatter.order}번`
                : "라인업 없음";
    }

    if (awayCurrentOrderBadge) {
        awayCurrentOrderBadge.textContent =
            awayBatter
                ? `다음 타순 ${awayBatter.order}번`
                : "라인업 없음";
    }
}


/* =========================================================
   타자 입력 자동 채우기
========================================================= */

function fillCurrentBatterInput() {
    const batterInput =
        document.getElementById(
            "batterName"
        );

    if (!batterInput) return;

    const offenseKey =
        getCurrentOffenseKey();

    const currentBatter =
        getCurrentBatter(offenseKey);

    if (currentBatter) {
        batterInput.value =
            currentBatter.name;
    } else {
        batterInput.value = "";
    }
}


/* =========================================================
   현재 타자 강조
========================================================= */

function highlightCurrentBatter() {
    const lineupRows =
        document.querySelectorAll(
            ".lineup-row"
        );

    lineupRows.forEach(row => {
        row.classList.remove(
            "current-batter-row"
        );
    });

    const offenseKey =
        getCurrentOffenseKey();

    const currentBatter =
        getCurrentBatter(offenseKey);

    if (!currentBatter) return;

    const playerInput =
        document.querySelector(
            `.lineup-player-input[data-team="${offenseKey}"][data-order="${currentBatter.order}"]`
        );

    if (!playerInput) return;

    const row =
        playerInput.closest(
            ".lineup-row"
        );

    if (row) {
        row.classList.add(
            "current-batter-row"
        );
    }
}


/* =========================================================
   다음 타자로 이동
========================================================= */

function advanceBattingOrder(teamKey) {
    const validPlayers =
        getValidLineupPlayers(teamKey);

    if (validPlayers.length === 0) {
        return;
    }

    battingOrderIndex[teamKey] =
        (
            battingOrderIndex[teamKey] + 1
        ) % validPlayers.length;

    updateCurrentLineupDisplay();
}


/* =========================================================
   투구 입력
========================================================= */

function addPitch(type) {
    if (isTeeMode) {
        alert(
            "현재 티바 타격 대기 상태입니다."
        );

        return;
    }

    if (
        selectedPlateResult === "삼진"
    ) {
        alert(
            "이미 삼진이 완성되었습니다. 타석을 저장해주세요."
        );

        return;
    }

    currentPitchSequence.push(type);

    switch (type) {
        case "B":
            ballCount += 1;

            if (ballCount >= 4) {
                ballCount = 4;
                isTeeMode = true;
                selectedPlateResult = "";

                alert(
                    "볼 4개입니다. 티바 타격 결과를 선택해주세요."
                );
            }

            break;

        case "S":
        case "SW":
            strikeCount += 1;

            if (strikeCount >= 3) {
                strikeCount = 3;
                selectedPlateResult =
                    "삼진";
            }

            break;

        case "F":
            if (strikeCount < 2) {
                strikeCount += 1;
            }

            break;

        default:
            return;
    }

    updatePitchSequence();
    updateCountDisplay();
    updateSelectedResult();
    updateTeeModeButtons();
}

window.addPitch = addPitch;


/* =========================================================
   투구 순서 출력
========================================================= */

function updatePitchSequence() {
    if (!pitchSequenceElement) return;

    if (
        currentPitchSequence.length === 0
    ) {
        pitchSequenceElement.textContent =
            "아직 투구 기록이 없습니다.";
    } else {
        pitchSequenceElement.innerHTML =
            currentPitchSequence
                .map(pitch => {
                    let className = "";

                    if (pitch === "B") {
                        className = "ball";
                    }

                    if (pitch === "S") {
                        className = "strike";
                    }

                    if (pitch === "F") {
                        className = "foul";
                    }

                    if (pitch === "SW") {
                        className = "swing";
                    }

                    return `
                        <span class="pitch-chip ${className}">
                            ${escapeHtml(pitch)}
                        </span>
                    `;
                })
                .join("");
    }

    if (pitchCountText) {
        pitchCountText.textContent =
            `총 ${currentPitchSequence.length}구`;
    }
}


/* =========================================================
   타석 결과
========================================================= */

function setPlateResult(result) {
    if (isTeeMode) {
        const teeAllowedResults = [
            "안타",
            "2루타",
            "3루타",
            "땅볼",
            "뜬공",
            "라인드라이브",
            "번트",
            "실책",
            "야수선택"
        ];

        if (result === "홈런") {
            alert(
                "티바 타격에는 홈런이 없습니다."
            );

            return;
        }

        if (
            !teeAllowedResults.includes(
                result
            )
        ) {
            alert(
                "티바에서 가능한 결과를 선택해주세요."
            );

            return;
        }

        selectedPlateResult =
            `티바 ${result}`;
    } else {
        selectedPlateResult =
            result;
    }

    updateSelectedResult();
}

window.setPlateResult = setPlateResult;


/* =========================================================
   선택 결과 표시
========================================================= */

function updateSelectedResult() {
    if (!selectedResultElement) return;

    if (
        isTeeMode &&
        !selectedPlateResult
    ) {
        selectedResultElement.textContent =
            "볼 4개 · 티바 타격 대기";

        selectedResultElement.classList.add(
            "tee-mode"
        );

        return;
    }

    selectedResultElement.classList.remove(
        "tee-mode"
    );

    selectedResultElement.textContent =
        selectedPlateResult || "없음";
}


/* =========================================================
   티바 버튼 제한
========================================================= */

function updateTeeModeButtons() {
    const resultButtons =
        document.querySelectorAll(
            ".result-buttons button"
        );

    resultButtons.forEach(button => {
        const buttonText =
            button.textContent.trim();

        const blockedInTeeMode =
            buttonText.includes("홈런") ||
            buttonText.includes("삼진") ||
            buttonText.includes("몸에 맞는 공") ||
            buttonText.includes("희생플라이");

        if (
            isTeeMode &&
            blockedInTeeMode
        ) {
            button.disabled = true;

            button.classList.add(
                "disabled-result"
            );
        } else {
            button.disabled = false;

            button.classList.remove(
                "disabled-result"
            );
        }
    });
}


/* =========================================================
   결과 문자열 정리
========================================================= */

function normalizeResult(result) {
    return String(result || "")
        .replace(/^티바\s*/, "")
        .trim();
}


/* =========================================================
   타석 저장 전 상태
========================================================= */

function createGameSnapshot() {
    return {
        currentInning: currentInning,
        isTopInning: isTopInning,

        ballCount: ballCount,
        strikeCount: strikeCount,
        outCount: outCount,

        homeScore: homeScore,
        awayScore: awayScore,

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
    const pitcherInput =
        document.getElementById(
            "pitcherName"
        );

    const batterInput =
        document.getElementById(
            "batterName"
        );

    const batterSideInput =
        document.getElementById(
            "batterSide"
        );

    const runInput =
        document.getElementById(
            "runScored"
        );

    const rbiInput =
        document.getElementById(
            "rbi"
        );

    const noteInput =
        document.getElementById(
            "playNote"
        );

    const pitcherName =
        pitcherInput
            ? pitcherInput.value.trim()
            : "";

    const batterName =
        batterInput
            ? batterInput.value.trim()
            : "";

    const batterSide =
        batterSideInput
            ? batterSideInput.value
            : "우타";

    const runScored =
        Math.max(
            0,
            Number(
                runInput
                    ? runInput.value
                    : 0
            ) || 0
        );

    const rbi =
        Math.max(
            0,
            Number(
                rbiInput
                    ? rbiInput.value
                    : 0
            ) || 0
        );

    const playNote =
        noteInput
            ? noteInput.value.trim()
            : "";

    if (!pitcherName) {
        alert(
            "투수 이름을 입력해주세요."
        );

        return;
    }

    if (!batterName) {
        alert(
            "타자 이름을 입력해주세요."
        );

        return;
    }

    if (
        isTeeMode &&
        !selectedPlateResult
    ) {
        alert(
            "티바 타격 결과를 선택해주세요."
        );

        return;
    }

    if (!selectedPlateResult) {
        alert(
            "타석 결과를 선택해주세요."
        );

        return;
    }

    const normalizedResult =
        normalizeResult(
            selectedPlateResult
        );

    if (
        isTeeMode &&
        normalizedResult === "홈런"
    ) {
        alert(
            "티바 타격에는 홈런이 없습니다."
        );

        return;
    }

    const offenseKey =
        getCurrentOffenseKey();

    const currentLineupBatter =
        getCurrentBatter(offenseKey);

    const snapshot =
        createGameSnapshot();

    const baseBefore =
        getBaseText();

    const outsBefore =
        outCount;

    const scoreBefore =
        `${awayScore} : ${homeScore}`;

    const teeModeAtSave =
        isTeeMode;

    applyPlateResult(
        selectedPlateResult,
        runScored,
        teeModeAtSave
    );

    const record = {
        beforeState:
            snapshot,

        inning:
            `${currentInning}회${isTopInning ? "초" : "말"}`,

        inningNumber:
            currentInning,

        half:
            isTopInning
                ? "top"
                : "bottom",

        offenseTeam:
            offenseKey,

        teamName:
            getTeamName(offenseKey),

        battingOrder:
            currentLineupBatter
                ? currentLineupBatter.order
                : null,

        position:
            currentLineupBatter
                ? currentLineupBatter.position
                : "",

        pitcher:
            pitcherName,

        batter:
            batterName,

        batterSide:
            batterSide,

        pitches: [
            ...currentPitchSequence
        ],

        pitchCount:
            currentPitchSequence.length,

        teeMode:
            teeModeAtSave,

        result:
            selectedPlateResult,

        baseBefore:
            baseBefore,

        baseAfter:
            getBaseText(),

        outsBefore:
            outsBefore,

        outsAfter:
            outCount,

        runs:
            runScored,

        rbi:
            rbi,

        scoreBefore:
            scoreBefore,

        scoreAfter:
            `${awayScore} : ${homeScore}`,

        note:
            playNote,

        videoTime:
            getCurrentVideoTime()
    };

    plateAppearances.push(record);

    /*
        안타, 아웃, 삼진 등 결과와 상관없이
        타석이 종료되었으므로 다음 타자로 이동합니다.
    */

    advanceBattingOrder(offenseKey);

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
   결과 적용
========================================================= */

function applyPlateResult(
    result,
    runs,
    teeModeAtSave
) {
    const normalizedResult =
        normalizeResult(result);

    let addedOuts = 0;

    switch (normalizedResult) {
        case "안타":
            advanceRunners(1);
            baseState.first = true;
            break;

        case "2루타":
            advanceRunners(2);
            baseState.second = true;
            break;

        case "3루타":
            advanceRunners(3);
            baseState.third = true;
            break;

        case "홈런":
            if (teeModeAtSave) {
                return;
            }

            baseState = {
                first: false,
                second: false,
                third: false
            };

            break;

        case "몸에 맞는 공":
            forceRunnerAdvance();
            break;

        case "삼진":
        case "땅볼":
        case "뜬공":
        case "라인드라이브":
        case "희생플라이":
        case "번트":
            addedOuts = 1;
            break;

        case "실책":
        case "야수선택":
            baseState.first = true;
            break;

        default:
            break;
    }

    outCount += addedOuts;

    if (outCount > 3) {
        outCount = 3;
    }

    addRuns(runs);

    updateCountDisplay();
    updateBaseDisplay();
    updateScoreDisplay();
}


/* =========================================================
   주자 진루
========================================================= */

function advanceRunners(baseAmount) {
    const oldBases = {
        ...baseState
    };

    const nextBases = {
        first: false,
        second: false,
        third: false
    };

    if (baseAmount === 1) {
        if (oldBases.first) {
            nextBases.second = true;
        }

        if (oldBases.second) {
            nextBases.third = true;
        }
    }

    if (baseAmount === 2) {
        if (oldBases.first) {
            nextBases.third = true;
        }
    }

    baseState =
        nextBases;
}


/* =========================================================
   강제 진루
========================================================= */

function forceRunnerAdvance() {
    const firstWasOccupied =
        baseState.first;

    const secondWasOccupied =
        baseState.second;

    if (
        firstWasOccupied &&
        secondWasOccupied
    ) {
        baseState.third = true;
    }

    if (firstWasOccupied) {
        baseState.second = true;
    }

    baseState.first = true;
}


/* =========================================================
   득점
========================================================= */

function addRuns(runs) {
    if (runs <= 0) return;

    if (isTopInning) {
        awayScore += runs;

        inningScores.away[currentInning] =
            (
                inningScores.away[
                    currentInning
                ] || 0
            ) + runs;
    } else {
        homeScore += runs;

        inningScores.home[currentInning] =
            (
                inningScores.home[
                    currentInning
                ] || 0
            ) + runs;
    }

    updateScoreDisplay();
}


/* =========================================================
   반이닝 종료
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
    updateTeeModeButtons();
    updateCurrentLineupDisplay();
}


/* =========================================================
   수동 이닝 변경 시 상황 초기화
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

    updateCountDisplay();
    updateBaseDisplay();
    updatePitchSequence();
    updateSelectedResult();
    updateTeeModeButtons();
}


/* =========================================================
   현재 타석 초기화
========================================================= */

function resetCurrentPlateAppearance() {
    ballCount = 0;
    strikeCount = 0;

    currentPitchSequence = [];
    selectedPlateResult = "";
    isTeeMode = false;

    const runInput =
        document.getElementById(
            "runScored"
        );

    const rbiInput =
        document.getElementById(
            "rbi"
        );

    const noteInput =
        document.getElementById(
            "playNote"
        );

    if (runInput) {
        runInput.value = 0;
    }

    if (rbiInput) {
        rbiInput.value = 0;
    }

    if (noteInput) {
        noteInput.value = "";
    }

    updateCountDisplay();
    updatePitchSequence();
    updateSelectedResult();
    updateTeeModeButtons();
    fillCurrentBatterInput();
}

window.resetCurrentPlateAppearance =
    resetCurrentPlateAppearance;


/* =========================================================
   최근 기록 취소
========================================================= */

function undoLastPlateAppearance() {
    if (
        plateAppearances.length === 0
    ) {
        alert(
            "취소할 타석 기록이 없습니다."
        );

        return;
    }

    const removedRecord =
        plateAppearances.pop();

    if (
        removedRecord &&
        removedRecord.beforeState
    ) {
        restoreGameSnapshot(
            removedRecord.beforeState
        );
    }

    resetCurrentPlateAppearance();
    rebuildStatistics();
    drawAllResults();
    updateCurrentLineupDisplay();
    saveGameState();

    alert(
        "최근 타석 기록을 취소했습니다."
    );
}

window.undoLastPlateAppearance =
    undoLastPlateAppearance;


/* =========================================================
   기록 취소 상태 복원
========================================================= */

function restoreGameSnapshot(snapshot) {
    currentInning =
        snapshot.currentInning ?? 1;

    isTopInning =
        snapshot.isTopInning ?? true;

    ballCount =
        snapshot.ballCount ?? 0;

    strikeCount =
        snapshot.strikeCount ?? 0;

    outCount =
        snapshot.outCount ?? 0;

    homeScore =
        snapshot.homeScore ?? 0;

    awayScore =
        snapshot.awayScore ?? 0;

    baseState = {
        first:
            snapshot.baseState?.first ||
            false,

        second:
            snapshot.baseState?.second ||
            false,

        third:
            snapshot.baseState?.third ||
            false
    };

    battingOrderIndex = {
        home:
            snapshot
                .battingOrderIndex
                ?.home || 0,

        away:
            snapshot
                .battingOrderIndex
                ?.away || 0
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

    updateInningDisplay();
    updateCountDisplay();
    updateScoreDisplay();
    updateBaseDisplay();
}


/* =========================================================
   통계 전체 계산
========================================================= */

function rebuildStatistics() {
    batterStats = {};
    pitcherStats = {};

    plateAppearances.forEach(record => {
        updateBatterStats(record);
        updatePitcherStats(record);
    });
}


/* =========================================================
   타자 통계
========================================================= */

function updateBatterStats(record) {
    const playerName =
        record.batter;

    if (!batterStats[playerName]) {
        batterStats[playerName] = {
            teamName:
                record.teamName,

            pa: 0,
            ab: 0,
            hits: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,
            hbp: 0,
            strikeouts: 0,
            rbi: 0,
            runs: 0,
            teeAppearances: 0
        };
    }

    const stats =
        batterStats[playerName];

    const result =
        normalizeResult(
            record.result
        );

    stats.pa += 1;
    stats.rbi += record.rbi;
    stats.runs += record.runs;

    if (record.teeMode) {
        stats.teeAppearances += 1;
    }

    const noAtBatResults = [
        "몸에 맞는 공",
        "희생플라이"
    ];

    if (
        !noAtBatResults.includes(result)
    ) {
        stats.ab += 1;
    }

    switch (result) {
        case "안타":
            stats.hits += 1;
            stats.singles += 1;
            break;

        case "2루타":
            stats.hits += 1;
            stats.doubles += 1;
            break;

        case "3루타":
            stats.hits += 1;
            stats.triples += 1;
            break;

        case "홈런":
            stats.hits += 1;
            stats.homeRuns += 1;
            break;

        case "몸에 맞는 공":
            stats.hbp += 1;
            break;

        case "삼진":
            stats.strikeouts += 1;
            break;

        default:
            break;
    }
}


/* =========================================================
   타자 계산 지표
========================================================= */

function calculateBatterStats(stats) {
    const avg =
        stats.ab > 0
            ? stats.hits / stats.ab
            : 0;

    const totalBases =
        stats.singles +
        stats.doubles * 2 +
        stats.triples * 3 +
        stats.homeRuns * 4;

    const slg =
        stats.ab > 0
            ? totalBases / stats.ab
            : 0;

    const obpDenominator =
        stats.ab +
        stats.hbp;

    const obp =
        obpDenominator > 0
            ? (
                stats.hits +
                stats.hbp
            ) / obpDenominator
            : 0;

    return {
        avg: avg,
        obp: obp,
        slg: slg,
        ops: obp + slg
    };
}


/* =========================================================
   투수 통계
========================================================= */

function updatePitcherStats(record) {
    const pitcherName =
        record.pitcher;

    if (!pitcherStats[pitcherName]) {
        pitcherStats[pitcherName] = {
            battersFaced: 0,
            pitches: 0,
            strikes: 0,
            balls: 0,
            hitsAllowed: 0,
            runsAllowed: 0,
            strikeouts: 0,
            teeBatters: 0,
            fourBallCounts: 0
        };
    }

    const stats =
        pitcherStats[pitcherName];

    const result =
        normalizeResult(
            record.result
        );

    stats.battersFaced += 1;
    stats.pitches +=
        record.pitches.length;

    record.pitches.forEach(pitch => {
        if (
            pitch === "S" ||
            pitch === "F" ||
            pitch === "SW"
        ) {
            stats.strikes += 1;
        }

        if (pitch === "B") {
            stats.balls += 1;
        }
    });

    if (record.teeMode) {
        stats.teeBatters += 1;
        stats.fourBallCounts += 1;
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

    if (result === "삼진") {
        stats.strikeouts += 1;
    }

    stats.runsAllowed +=
        record.runs;
}


/* =========================================================
   전체 결과 화면
========================================================= */

function drawAllResults() {
    drawRecordTable();
    drawBatterStats();
    drawPitcherStats();
    drawCharts();
    drawMVP();
}


/* =========================================================
   최근 타석 기록
========================================================= */

function drawRecordTable() {
    if (!recordTableBody) return;

    if (
        plateAppearances.length === 0
    ) {
        recordTableBody.innerHTML = `
            <tr class="empty-table-row">
                <td colspan="10">
                    아직 저장된 타석이 없습니다.
                </td>
            </tr>
        `;

        return;
    }

    recordTableBody.innerHTML =
        [...plateAppearances]
            .reverse()
            .map(record => {
                const pitches =
                    record.pitches.length
                        ? record.pitches.join(" ")
                        : "-";

                const order =
                    record.battingOrder
                        ? `${record.battingOrder}번`
                        : "-";

                return `
                    <tr
                        data-video-time="${record.videoTime || 0}"
                    >
                        <td>
                            ${escapeHtml(record.inning)}
                        </td>

                        <td>
                            ${escapeHtml(record.teamName)}
                        </td>

                        <td>
                            ${escapeHtml(order)}
                        </td>

                        <td>
                            ${escapeHtml(record.pitcher)}
                        </td>

                        <td>
                            ${escapeHtml(record.batter)}
                        </td>

                        <td>
                            ${escapeHtml(pitches)}
                        </td>

                        <td>
                            ${escapeHtml(record.result)}
                        </td>

                        <td>
                            ${record.outsAfter}
                        </td>

                        <td>
                            ${escapeHtml(record.scoreAfter)}
                        </td>

                        <td>
                            ${escapeHtml(record.note || "-")}
                        </td>
                    </tr>
                `;
            })
            .join("");

    const rows =
        recordTableBody.querySelectorAll(
            "tr[data-video-time]"
        );

    rows.forEach(row => {
        row.addEventListener(
            "click",
            () => {
                seekVideoTime(
                    Number(
                        row.dataset.videoTime
                    ) || 0
                );
            }
        );
    });
}


/* =========================================================
   타자 분석 출력
========================================================= */

function drawBatterStats() {
    if (!batterStatsElement) return;

    const entries =
        Object.entries(batterStats);

    if (entries.length === 0) {
        batterStatsElement.innerHTML = `
            <div class="empty-state">
                타석을 저장하면 타자 분석이 표시됩니다.
            </div>
        `;

        return;
    }

    batterStatsElement.innerHTML =
        entries
            .map(([name, stats]) => {
                const calculated =
                    calculateBatterStats(
                        stats
                    );

                return `
                    <div class="stat-player-card">

                        <h3>
                            ${escapeHtml(name)}
                        </h3>

                        <div class="stat-row">
                            <span>팀</span>
                            <strong>
                                ${escapeHtml(stats.teamName)}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>타석</span>
                            <strong>${stats.pa}</strong>
                        </div>

                        <div class="stat-row">
                            <span>타수</span>
                            <strong>${stats.ab}</strong>
                        </div>

                        <div class="stat-row">
                            <span>안타</span>
                            <strong>${stats.hits}</strong>
                        </div>

                        <div class="stat-row">
                            <span>2루타</span>
                            <strong>${stats.doubles}</strong>
                        </div>

                        <div class="stat-row">
                            <span>3루타</span>
                            <strong>${stats.triples}</strong>
                        </div>

                        <div class="stat-row">
                            <span>홈런</span>
                            <strong>${stats.homeRuns}</strong>
                        </div>

                        <div class="stat-row">
                            <span>삼진</span>
                            <strong>${stats.strikeouts}</strong>
                        </div>

                        <div class="stat-row">
                            <span>티바 타석</span>
                            <strong>${stats.teeAppearances}</strong>
                        </div>

                        <div class="stat-row">
                            <span>타율</span>
                            <strong>
                                ${formatAverage(calculated.avg)}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>출루율</span>
                            <strong>
                                ${formatAverage(calculated.obp)}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>장타율</span>
                            <strong>
                                ${formatAverage(calculated.slg)}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>OPS</span>
                            <strong>
                                ${calculated.ops.toFixed(3)}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>타점</span>
                            <strong>${stats.rbi}</strong>
                        </div>

                    </div>
                `;
            })
            .join("");
}


/* =========================================================
   투수 분석 출력
========================================================= */

function drawPitcherStats() {
    if (!pitcherStatsElement) return;

    const entries =
        Object.entries(pitcherStats);

    if (entries.length === 0) {
        pitcherStatsElement.innerHTML = `
            <div class="empty-state">
                타석을 저장하면 투수 분석이 표시됩니다.
            </div>
        `;

        return;
    }

    pitcherStatsElement.innerHTML =
        entries
            .map(([name, stats]) => {
                const strikeRate =
                    stats.pitches > 0
                        ? (
                            stats.strikes /
                            stats.pitches
                        ) * 100
                        : 0;

                return `
                    <div class="stat-player-card">

                        <h3>
                            ${escapeHtml(name)}
                        </h3>

                        <div class="stat-row">
                            <span>상대한 타자</span>
                            <strong>
                                ${stats.battersFaced}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>총 투구 수</span>
                            <strong>
                                ${stats.pitches}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>스트라이크</span>
                            <strong>
                                ${stats.strikes}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>볼</span>
                            <strong>
                                ${stats.balls}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>스트라이크 비율</span>
                            <strong>
                                ${strikeRate.toFixed(1)}%
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>삼진</span>
                            <strong>
                                ${stats.strikeouts}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>볼 4개</span>
                            <strong>
                                ${stats.fourBallCounts}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>티바 전환</span>
                            <strong>
                                ${stats.teeBatters}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>피안타</span>
                            <strong>
                                ${stats.hitsAllowed}
                            </strong>
                        </div>

                        <div class="stat-row">
                            <span>실점</span>
                            <strong>
                                ${stats.runsAllowed}
                            </strong>
                        </div>

                    </div>
                `;
            })
            .join("");
}


/* =========================================================
   소수 표시
========================================================= */

function formatAverage(value) {
    return value
        .toFixed(3)
        .replace(/^0/, "");
}


/* =========================================================
   MVP
========================================================= */

function drawMVP() {
    if (!mvpCard) return;

    const entries =
        Object.entries(batterStats);

    if (entries.length === 0) {
        mvpCard.innerHTML = `
            <div class="empty-state">
                경기 기록이 없습니다.
            </div>
        `;

        return;
    }

    let bestPlayer = null;
    let bestScore = -Infinity;

    entries.forEach(([name, stats]) => {
        const calculated =
            calculateBatterStats(stats);

        const score =
            stats.hits * 3 +
            stats.doubles * 2 +
            stats.triples * 3 +
            stats.homeRuns * 5 +
            stats.rbi * 2 +
            stats.runs +
            calculated.ops * 3;

        if (score > bestScore) {
            bestScore = score;

            bestPlayer = {
                name: name,
                stats: stats,
                calculated: calculated
            };
        }
    });

    if (!bestPlayer) return;

    mvpCard.innerHTML = `
        <div class="mvp-player">

            <span class="mvp-label">
                PLAYER OF THE GAME
            </span>

            <h3>
                ${escapeHtml(bestPlayer.name)}
            </h3>

            <p>
                ${escapeHtml(bestPlayer.stats.teamName)}
            </p>

            <div class="mvp-numbers">

                <div>
                    <span>타율</span>

                    <strong>
                        ${formatAverage(bestPlayer.calculated.avg)}
                    </strong>
                </div>

                <div>
                    <span>안타</span>

                    <strong>
                        ${bestPlayer.stats.hits}
                    </strong>
                </div>

                <div>
                    <span>타점</span>

                    <strong>
                        ${bestPlayer.stats.rbi}
                    </strong>
                </div>

            </div>

        </div>
    `;
}


/* =========================================================
   차트
========================================================= */

function drawCharts() {
    drawInningScoreChart();
    drawResultChart();
}


function drawInningScoreChart() {
    const canvas =
        document.getElementById(
            "inningScoreChart"
        );

    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {
        return;
    }

    const homeInnings =
        Object.keys(
            inningScores.home
        ).map(Number);

    const awayInnings =
        Object.keys(
            inningScores.away
        ).map(Number);

    const maxInning =
        Math.max(
            currentInning,
            ...homeInnings,
            ...awayInnings,
            1
        );

    const labels =
        Array.from(
            {
                length: maxInning
            },
            (_, index) =>
                `${index + 1}회`
        );

    const homeData =
        labels.map(
            (_, index) =>
                inningScores.home[
                    index + 1
                ] || 0
        );

    const awayData =
        labels.map(
            (_, index) =>
                inningScores.away[
                    index + 1
                ] || 0
        );

    if (inningScoreChart) {
        inningScoreChart.destroy();
    }

    inningScoreChart =
        new Chart(canvas, {
            type: "line",

            data: {
                labels: labels,

                datasets: [
                    {
                        label:
                            getHomeTeamName(),

                        data:
                            homeData,

                        borderColor:
                            "#ff3b4d",

                        backgroundColor:
                            "rgba(255,59,77,0.12)",

                        tension: 0.28
                    },

                    {
                        label:
                            getAwayTeamName(),

                        data:
                            awayData,

                        borderColor:
                            "#2563eb",

                        backgroundColor:
                            "rgba(37,99,235,0.12)",

                        tension: 0.28
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        labels: {
                            color: "#cbd5e1"
                        }
                    }
                },

                scales: {
                    x: {
                        ticks: {
                            color: "#94a3b8"
                        },

                        grid: {
                            color:
                                "rgba(148,163,184,0.08)"
                        }
                    },

                    y: {
                        beginAtZero: true,

                        ticks: {
                            precision: 0,
                            color: "#94a3b8"
                        },

                        grid: {
                            color:
                                "rgba(148,163,184,0.08)"
                        }
                    }
                }
            }
        });
}


function drawResultChart() {
    const canvas =
        document.getElementById(
            "resultChart"
        );

    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {
        return;
    }

    const counts = {};

    plateAppearances.forEach(record => {
        counts[record.result] =
            (
                counts[record.result] || 0
            ) + 1;
    });

    const labels =
        Object.keys(counts);

    const values =
        Object.values(counts);

    if (resultChart) {
        resultChart.destroy();
    }

    resultChart =
        new Chart(canvas, {
            type: "doughnut",

            data: {
                labels:
                    labels.length
                        ? labels
                        : ["기록 없음"],

                datasets: [
                    {
                        data:
                            values.length
                                ? values
                                : [1],

                        backgroundColor: [
                            "#ff3b4d",
                            "#2563eb",
                            "#22c55e",
                            "#facc15",
                            "#f97316",
                            "#a855f7",
                            "#14b8a6",
                            "#64748b"
                        ],

                        borderWidth: 0
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        position: "bottom",

                        labels: {
                            color: "#cbd5e1"
                        }
                    }
                }
            }
        });
}


/* =========================================================
   로컬 영상
========================================================= */

function loadVideo(event) {
    const file =
        event.target.files[0];

    if (!file || !video) return;

    if (localVideoObjectUrl) {
        URL.revokeObjectURL(
            localVideoObjectUrl
        );
    }

    localVideoObjectUrl =
        URL.createObjectURL(file);

    video.src =
        localVideoObjectUrl;

    video.load();

    const fileNameElement =
        document.getElementById(
            "videoFileName"
        );

    if (fileNameElement) {
        fileNameElement.textContent =
            file.name;
    }

    const youtubeWrap =
        document.getElementById(
            "youtubePlayerWrap"
        );

    if (youtubeWrap) {
        youtubeWrap.hidden = true;
    }

    video.style.display = "block";
}

window.loadVideo = loadVideo;


/* =========================================================
   영상 모드 확인
========================================================= */

function isYouTubeMode() {
    const youtubeWrap =
        document.getElementById(
            "youtubePlayerWrap"
        );

    return Boolean(
        youtubeWrap &&
        !youtubeWrap.hidden &&
        window.youtubePlayer
    );
}


/* =========================================================
   영상 제어
========================================================= */

function back5() {
    if (
        isYouTubeMode() &&
        typeof window.youtubePlayer.seekTo ===
            "function"
    ) {
        const currentTime =
            window.youtubePlayer
                .getCurrentTime() || 0;

        window.youtubePlayer.seekTo(
            Math.max(
                0,
                currentTime - 5
            ),
            true
        );

        return;
    }

    if (!video) return;

    video.currentTime =
        Math.max(
            0,
            video.currentTime - 5
        );
}


function forward5() {
    if (
        isYouTubeMode() &&
        typeof window.youtubePlayer.seekTo ===
            "function"
    ) {
        const currentTime =
            window.youtubePlayer
                .getCurrentTime() || 0;

        window.youtubePlayer.seekTo(
            currentTime + 5,
            true
        );

        return;
    }

    if (!video) return;

    video.currentTime += 5;
}


function playPause() {
    if (isYouTubeMode()) {
        const playerState =
            window.youtubePlayer
                .getPlayerState();

        if (
            playerState ===
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

    if (!video) return;

    if (video.paused) {
        video.play().catch(() => {});
    } else {
        video.pause();
    }
}


function setVideoSpeed(speed) {
    const rate =
        Number(speed) || 1;

    if (
        isYouTubeMode() &&
        typeof window.youtubePlayer
            .setPlaybackRate ===
            "function"
    ) {
        window.youtubePlayer
            .setPlaybackRate(rate);

        return;
    }

    if (video) {
        video.playbackRate = rate;
    }
}

window.back5 = back5;
window.forward5 = forward5;
window.playPause = playPause;
window.setVideoSpeed = setVideoSpeed;


/* =========================================================
   영상 시간
========================================================= */

function getCurrentVideoTime() {
    if (
        isYouTubeMode() &&
        typeof window.youtubePlayer
            .getCurrentTime ===
            "function"
    ) {
        return (
            window.youtubePlayer
                .getCurrentTime() || 0
        );
    }

    if (video) {
        return video.currentTime || 0;
    }

    return 0;
}


function seekVideoTime(time) {
    const targetTime =
        Number(time) || 0;

    if (
        isYouTubeMode() &&
        typeof window.youtubePlayer.seekTo ===
            "function"
    ) {
        window.youtubePlayer.seekTo(
            targetTime,
            true
        );

        window.youtubePlayer
            .playVideo();

        return;
    }

    if (video) {
        video.currentTime =
            targetTime;

        video.play().catch(() => {});
    }
}


/* =========================================================
   유튜브
========================================================= */

function extractYouTubeId(url) {
    const text =
        String(url || "").trim();

    const patterns = [
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
        const match =
            text.match(pattern);

        if (
            match &&
            match[1]
        ) {
            return match[1];
        }
    }

    return "";
}


function loadYouTubeVideo() {
    const urlInput =
        document.getElementById(
            "youtubeUrl"
        );

    const videoId =
        extractYouTubeId(
            urlInput
                ? urlInput.value
                : ""
        );

    if (!videoId) {
        alert(
            "올바른 유튜브 주소를 입력해주세요."
        );

        return;
    }

    pendingYouTubeId =
        videoId;

    const youtubeWrap =
        document.getElementById(
            "youtubePlayerWrap"
        );

    if (youtubeWrap) {
        youtubeWrap.hidden = false;
    }

    if (video) {
        video.pause();
        video.style.display = "none";
    }

    if (
        window.youtubePlayer &&
        typeof window.youtubePlayer
            .loadVideoById ===
            "function"
    ) {
        window.youtubePlayer
            .loadVideoById(videoId);
    }
}

window.loadYouTubeVideo =
    loadYouTubeVideo;


window.onYouTubeIframeAPIReady =
    function () {
        window.youtubePlayer =
            new YT.Player(
                "youtubePlayer",
                {
                    width: "100%",
                    height: "100%",

                    playerVars: {
                        playsinline: 1,
                        controls: 1,
                        rel: 0
                    },

                    events: {
                        onReady:
                            function () {
                                if (
                                    pendingYouTubeId
                                ) {
                                    window
                                        .youtubePlayer
                                        .loadVideoById(
                                            pendingYouTubeId
                                        );
                                }
                            },

                        onError:
                            function () {
                                alert(
                                    "이 영상은 외부 재생이 제한되었거나 재생할 수 없습니다."
                                );
                            }
                    }
                }
            );
    };


/* =========================================================
   로컬 저장
========================================================= */

function saveGameState() {
    const state = {
        currentInning: currentInning,
        isTopInning: isTopInning,

        ballCount: ballCount,
        strikeCount: strikeCount,
        outCount: outCount,

        homeScore: homeScore,
        awayScore: awayScore,

        baseState: baseState,

        currentPitchSequence:
            currentPitchSequence,

        selectedPlateResult:
            selectedPlateResult,

        isTeeMode:
            isTeeMode,

        plateAppearances:
            plateAppearances,

        lineups:
            lineups,

        battingOrderIndex:
            battingOrderIndex,

        inningScores:
            inningScores,

        homeTeamName:
            getHomeTeamName(),

        awayTeamName:
            getAwayTeamName()
    };

    try {
        localStorage.setItem(
            "diamondVisionGameState",
            JSON.stringify(state)
        );
    } catch (error) {
        console.warn(
            "경기 상태 저장 실패:",
            error
        );
    }
}


/* =========================================================
   저장 데이터 불러오기
========================================================= */

function loadGameState() {
    let savedState = null;

    try {
        const raw =
            localStorage.getItem(
                "diamondVisionGameState"
            );

        if (raw) {
            savedState =
                JSON.parse(raw);
        }
    } catch (error) {
        console.warn(
            "경기 상태 불러오기 실패:",
            error
        );
    }

    if (!savedState) return;

    currentInning =
        savedState.currentInning || 1;

    isTopInning =
        savedState.isTopInning !== false;

    ballCount =
        savedState.ballCount || 0;

    strikeCount =
        savedState.strikeCount || 0;

    outCount =
        savedState.outCount || 0;

    homeScore =
        savedState.homeScore || 0;

    awayScore =
        savedState.awayScore || 0;

    baseState = {
        first:
            savedState.baseState?.first ||
            false,

        second:
            savedState.baseState?.second ||
            false,

        third:
            savedState.baseState?.third ||
            false
    };

    currentPitchSequence =
        Array.isArray(
            savedState.currentPitchSequence
        )
            ? savedState.currentPitchSequence
            : [];

    selectedPlateResult =
        savedState.selectedPlateResult ||
        "";

    isTeeMode =
        Boolean(
            savedState.isTeeMode
        );

    plateAppearances =
        Array.isArray(
            savedState.plateAppearances
        )
            ? savedState.plateAppearances
            : [];

    lineups = {
        home:
            Array.isArray(
                savedState.lineups?.home
            )
                ? savedState.lineups.home
                : [],

        away:
            Array.isArray(
                savedState.lineups?.away
            )
                ? savedState.lineups.away
                : []
    };

    battingOrderIndex = {
        home:
            savedState
                .battingOrderIndex
                ?.home || 0,

        away:
            savedState
                .battingOrderIndex
                ?.away || 0
    };

    inningScores = {
        home: {
            ...(
                savedState
                    .inningScores
                    ?.home || {}
            )
        },

        away: {
            ...(
                savedState
                    .inningScores
                    ?.away || {}
            )
        }
    };

    const homeTeamInput =
        document.getElementById(
            "homeTeamName"
        );

    const awayTeamInput =
        document.getElementById(
            "awayTeamName"
        );

    if (
        homeTeamInput &&
        savedState.homeTeamName
    ) {
        homeTeamInput.value =
            savedState.homeTeamName;
    }

    if (
        awayTeamInput &&
        savedState.awayTeamName
    ) {
        awayTeamInput.value =
            savedState.awayTeamName;
    }

    writeLineupsToInputs();
}


/* =========================================================
   저장 라인업을 입력칸에 표시
========================================================= */

function writeLineupsToInputs() {
    for (
        const teamKey of ["home", "away"]
    ) {
        const lineup =
            lineups[teamKey] || [];

        for (
            let order = 1;
            order <= 9;
            order += 1
        ) {
            const player =
                lineup.find(
                    item =>
                        Number(item.order) ===
                        order
                );

            const playerInput =
                document.getElementById(
                    `${teamKey}Player${order}`
                );

            const positionInput =
                document.getElementById(
                    `${teamKey}Position${order}`
                );

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
   HTML 안전 처리
========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   이벤트 연결
========================================================= */

function connectEvents() {
    if (base1Element) {
        base1Element.addEventListener(
            "click",
            () => toggleBase("first")
        );
    }

    if (base2Element) {
        base2Element.addEventListener(
            "click",
            () => toggleBase("second")
        );
    }

    if (base3Element) {
        base3Element.addEventListener(
            "click",
            () => toggleBase("third")
        );
    }

    const homeTeamInput =
        document.getElementById(
            "homeTeamName"
        );

    const awayTeamInput =
        document.getElementById(
            "awayTeamName"
        );

    if (homeTeamInput) {
        homeTeamInput.addEventListener(
            "input",
            () => {
                updateTeamTitles();
                drawCharts();
                saveGameState();
            }
        );
    }

    if (awayTeamInput) {
        awayTeamInput.addEventListener(
            "input",
            () => {
                updateTeamTitles();
                drawCharts();
                saveGameState();
            }
        );
    }
}


/* =========================================================
   최초 실행
========================================================= */

window.addEventListener(
    "load",
    function () {
        setTodayDate();
        loadGameState();
        connectEvents();

        clampBattingOrderIndexes();
        rebuildStatistics();

        updateTeamTitles();
        updateInningDisplay();
        updateCountDisplay();
        updateScoreDisplay();
        updateBaseDisplay();
        updatePitchSequence();
        updateSelectedResult();
        updateTeeModeButtons();
        updateCurrentLineupDisplay();

        drawAllResults();
    }
);