/* =========================================================
   DiamondVision 1.0
   야구 전력분석 메인 시스템
========================================================= */


/* =========================================================
   기본 데이터
========================================================= */

let currentInning = 1;
let isTopInning = true;

let ballCount = 0;
let strikeCount = 0;
let outCount = 0;

let baseState = {
    first: false,
    second: false,
    third: false
};

let currentPitchSequence = [];
let selectedPlateResult = "";

let homeScore = 0;
let awayScore = 0;

let plateAppearances = [];

let batterStats = {};
let pitcherStats = {};

let inningScores = {
    home: {},
    away: {}
};

let inningScoreChart = null;
let resultChart = null;


/* =========================================================
   DOM 요소
========================================================= */

const video = document.getElementById("video");

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


/* =========================================================
   날짜 표시
========================================================= */

function setTodayDate() {
    const todayDate =
        document.getElementById("todayDate");

    if (!todayDate) return;

    const today = new Date();

    todayDate.textContent =
        `${today.getFullYear()}. ` +
        `${String(today.getMonth() + 1).padStart(2, "0")}. ` +
        `${String(today.getDate()).padStart(2, "0")}`;
}


/* =========================================================
   이닝 표시
========================================================= */

function updateInningDisplay() {
    if (!inningDisplay) return;

    inningDisplay.textContent =
        `${currentInning}회${isTopInning ? "초" : "말"}`;
}


function previousInning() {
    if (!isTopInning) {
        isTopInning = true;
    } else if (currentInning > 1) {
        currentInning -= 1;
        isTopInning = false;
    }

    updateInningDisplay();
}


function nextInning() {
    if (isTopInning) {
        isTopInning = false;
    } else {
        currentInning += 1;
        isTopInning = true;
    }

    updateInningDisplay();
}

window.previousInning = previousInning;
window.nextInning = nextInning;


/* =========================================================
   볼카운트 표시
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


/* =========================================================
   주자 표시
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

    return bases.length > 0
        ? bases.join(", ")
        : "주자 없음";
}


/* =========================================================
   투구 기록
========================================================= */

function addPitch(type) {
    currentPitchSequence.push(type);

    switch (type) {
        case "B":
            ballCount += 1;

            if (ballCount >= 4) {
                selectedPlateResult = "볼넷";
                ballCount = 4;
            }
            break;

        case "S":
        case "SW":
            strikeCount += 1;

            if (strikeCount >= 3) {
                selectedPlateResult = "삼진";
                strikeCount = 3;
            }
            break;

        case "F":
            if (strikeCount < 2) {
                strikeCount += 1;
            }
            break;
    }

    updatePitchSequence();
    updateCountDisplay();
    updateSelectedResult();
}

window.addPitch = addPitch;


/* =========================================================
   투구 순서 출력
========================================================= */

function updatePitchSequence() {
    if (!pitchSequenceElement) return;

    if (currentPitchSequence.length === 0) {
        pitchSequenceElement.innerHTML =
            "아직 투구 기록이 없습니다.";
    } else {
        pitchSequenceElement.innerHTML =
            currentPitchSequence
                .map(function (pitch) {
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
                            ${pitch}
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
   타석 결과 선택
========================================================= */

function setPlateResult(result) {
    selectedPlateResult = result;
    updateSelectedResult();
}

window.setPlateResult = setPlateResult;


function updateSelectedResult() {
    if (!selectedResultElement) return;

    selectedResultElement.textContent =
        selectedPlateResult || "없음";
}


/* =========================================================
   타석 저장
========================================================= */

function savePlateAppearance() {
    const pitcherName =
        document
            .getElementById("pitcherName")
            .value
            .trim();

    const batterName =
        document
            .getElementById("batterName")
            .value
            .trim();

    const batterSide =
        document.getElementById("batterSide").value;

    const runScored =
        Number(
            document.getElementById("runScored").value
        ) || 0;

    const rbi =
        Number(
            document.getElementById("rbi").value
        ) || 0;

    const playNote =
        document
            .getElementById("playNote")
            .value
            .trim();

    if (!pitcherName) {
        alert("투수 이름을 입력해주세요.");
        return;
    }

    if (!batterName) {
        alert("타자 이름을 입력해주세요.");
        return;
    }

    if (!selectedPlateResult) {
        alert("타석 결과를 선택해주세요.");
        return;
    }

    const scoreBefore =
        `${homeScore} : ${awayScore}`;

    const baseBefore = getBaseText();

    const outsBefore = outCount;

    applyPlateResult(
        selectedPlateResult,
        runScored
    );

    const record = {
        inning:
            `${currentInning}회${isTopInning ? "초" : "말"}`,

        inningNumber:
            currentInning,

        half:
            isTopInning ? "top" : "bottom",

        pitcher:
            pitcherName,

        batter:
            batterName,

        batterSide:
            batterSide,

        pitches:
            [...currentPitchSequence],

        result:
            selectedPlateResult,

        baseBefore:
            baseBefore,

        outsBefore:
            outsBefore,

        runs:
            runScored,

        rbi:
            rbi,

        scoreBefore:
            scoreBefore,

        scoreAfter:
            `${homeScore} : ${awayScore}`,

        note:
            playNote,

        time:
            getCurrentVideoTime()
    };

    plateAppearances.push(record);

    updateBatterStats(record);
    updatePitcherStats(record);

    drawRecordTable();
    drawBatterStats();
    drawPitcherStats();
    drawCharts();
    drawMVP();

    resetCurrentPlateAppearance();

    if (outCount >= 3) {
        finishHalfInning();
    }
}

window.savePlateAppearance =
    savePlateAppearance;


/* =========================================================
   결과에 따른 경기 상황 반영
========================================================= */

function applyPlateResult(result, runs) {
    let outAdded = 0;

    switch (result) {
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
            baseState = {
                first: false,
                second: false,
                third: false
            };
            break;

        case "볼넷":
        case "몸에 맞는 공":
            forceWalkAdvance();
            break;

        case "삼진":
        case "땅볼":
        case "뜬공":
        case "라인드라이브":
        case "번트":
        case "희생플라이":
            outAdded = 1;
            break;
    }

    outCount += outAdded;

    addRuns(runs);

    updateCountDisplay();
    updateBaseDisplay();
    updateScoreDisplay();
}


/* =========================================================
   주자 진루
========================================================= */

function advanceRunners(bases) {
    const nextState = {
        first: false,
        second: false,
        third: false
    };

    if (bases === 1) {
        if (baseState.second) {
            nextState.third = true;
        }

        if (baseState.first) {
            nextState.second = true;
        }
    }

    if (bases === 2) {
        if (baseState.first) {
            nextState.third = true;
        }
    }

    baseState = nextState;
}


function forceWalkAdvance() {
    if (
        baseState.first &&
        baseState.second
    ) {
        baseState.third = true;
    }

    if (baseState.first) {
        baseState.second = true;
    }

    baseState.first = true;
}


/* =========================================================
   득점 반영
========================================================= */

function addRuns(runs) {
    if (runs <= 0) return;

    if (isTopInning) {
        awayScore += runs;

        inningScores.away[currentInning] =
            (
                inningScores.away[currentInning] ||
                0
            ) + runs;
    } else {
        homeScore += runs;

        inningScores.home[currentInning] =
            (
                inningScores.home[currentInning] ||
                0
            ) + runs;
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

    nextInning();

    updateCountDisplay();
    updateBaseDisplay();
}


/* =========================================================
   현재 타석 초기화
========================================================= */

function resetCurrentPlateAppearance() {
    ballCount = 0;
    strikeCount = 0;

    currentPitchSequence = [];
    selectedPlateResult = "";

    const runInput =
        document.getElementById("runScored");

    const rbiInput =
        document.getElementById("rbi");

    const noteInput =
        document.getElementById("playNote");

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
}

window.resetCurrentPlateAppearance =
    resetCurrentPlateAppearance;


/* =========================================================
   최근 기록 취소
========================================================= */

function undoLastPlateAppearance() {
    if (plateAppearances.length === 0) {
        alert("취소할 기록이 없습니다.");
        return;
    }

    plateAppearances.pop();

    rebuildEverything();
}

window.undoLastPlateAppearance =
    undoLastPlateAppearance;


/* =========================================================
   전체 기록 재계산
========================================================= */

function rebuildEverything() {
    homeScore = 0;
    awayScore = 0;

    inningScores = {
        home: {},
        away: {}
    };

    batterStats = {};
    pitcherStats = {};

    plateAppearances.forEach(function (record) {
        if (record.half === "top") {
            awayScore += record.runs;

            inningScores.away[
                record.inningNumber
            ] =
                (
                    inningScores.away[
                        record.inningNumber
                    ] || 0
                ) + record.runs;
        } else {
            homeScore += record.runs;

            inningScores.home[
                record.inningNumber
            ] =
                (
                    inningScores.home[
                        record.inningNumber
                    ] || 0
                ) + record.runs;
        }

        updateBatterStats(record);
        updatePitcherStats(record);
    });

    updateScoreDisplay();
    drawRecordTable();
    drawBatterStats();
    drawPitcherStats();
    drawCharts();
    drawMVP();
}


/* =========================================================
   기록표
========================================================= */

function drawRecordTable() {
    if (!recordTableBody) return;

    recordTableBody.innerHTML = "";

    if (plateAppearances.length === 0) {
        recordTableBody.innerHTML = `
            <tr class="empty-table-row">
                <td colspan="9">
                    아직 저장된 타석이 없습니다.
                </td>
            </tr>
        `;

        return;
    }

    const recentRecords =
        [...plateAppearances].reverse();

    recentRecords.forEach(function (record) {
        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${record.inning}</td>
            <td>${record.pitcher}</td>
            <td>${record.batter}</td>
            <td>${record.pitches.join(" ") || "-"}</td>
            <td>${record.result}</td>
            <td>${record.baseBefore}</td>
            <td>${record.outsBefore}</td>
            <td>${record.scoreAfter}</td>
            <td>${record.note || "-"}</td>
        `;

        row.addEventListener(
            "click",
            function () {
                seekVideoTime(record.time);
            }
        );

        recordTableBody.appendChild(row);
    });
}


/* =========================================================
   타자 통계 업데이트
========================================================= */

function updateBatterStats(record) {
    if (!batterStats[record.batter]) {
        batterStats[record.batter] = {
            pa: 0,
            ab: 0,
            hits: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,
            walks: 0,
            hbp: 0,
            strikeouts: 0,
            rbi: 0,
            runs: 0
        };
    }

    const stats =
        batterStats[record.batter];

    stats.pa += 1;
    stats.rbi += record.rbi;
    stats.runs += record.runs;

    const nonAtBatResults = [
        "볼넷",
        "몸에 맞는 공",
        "희생플라이"
    ];

    if (
        !nonAtBatResults.includes(
            record.result
        )
    ) {
        stats.ab += 1;
    }

    switch (record.result) {
        case "안타":
            stats.hits += 1;
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

        case "볼넷":
            stats.walks += 1;
            break;

        case "몸에 맞는 공":
            stats.hbp += 1;
            break;

        case "삼진":
            stats.strikeouts += 1;
            break;
    }
}


/* =========================================================
   타자 통계 계산
========================================================= */

function getBatterCalculatedStats(stats) {
    const battingAverage =
        stats.ab > 0
            ? stats.hits / stats.ab
            : 0;

    const totalBases =
        (
            stats.hits -
            stats.doubles -
            stats.triples -
            stats.homeRuns
        ) +
        stats.doubles * 2 +
        stats.triples * 3 +
        stats.homeRuns * 4;

    const slugging =
        stats.ab > 0
            ? totalBases / stats.ab
            : 0;

    const onBaseDenominator =
        stats.ab +
        stats.walks +
        stats.hbp;

    const onBasePercentage =
        onBaseDenominator > 0
            ? (
                stats.hits +
                stats.walks +
                stats.hbp
            ) / onBaseDenominator
            : 0;

    return {
        avg: battingAverage,
        obp: onBasePercentage,
        slg: slugging,
        ops:
            onBasePercentage +
            slugging
    };
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
            .map(function ([name, stats]) {
                const calculated =
                    getBatterCalculatedStats(stats);

                return `
                    <div class="stat-player-card">
                        <h3>${name}</h3>

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
                            <span>타율</span>
                            <strong>${formatAverage(calculated.avg)}</strong>
                        </div>

                        <div class="stat-row">
                            <span>출루율</span>
                            <strong>${formatAverage(calculated.obp)}</strong>
                        </div>

                        <div class="stat-row">
                            <span>장타율</span>
                            <strong>${formatAverage(calculated.slg)}</strong>
                        </div>

                        <div class="stat-row">
                            <span>OPS</span>
                            <strong>${calculated.ops.toFixed(3)}</strong>
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
   투수 통계 업데이트
========================================================= */

function updatePitcherStats(record) {
    if (!pitcherStats[record.pitcher]) {
        pitcherStats[record.pitcher] = {
            battersFaced: 0,
            pitches: 0,
            strikes: 0,
            balls: 0,
            hitsAllowed: 0,
            walks: 0,
            strikeouts: 0,
            runsAllowed: 0
        };
    }

    const stats =
        pitcherStats[record.pitcher];

    stats.battersFaced += 1;
    stats.pitches +=
        record.pitches.length;

    record.pitches.forEach(function (pitch) {
        if (
            pitch === "S" ||
            pitch === "SW" ||
            pitch === "F"
        ) {
            stats.strikes += 1;
        }

        if (pitch === "B") {
            stats.balls += 1;
        }
    });

    if (
        [
            "안타",
            "2루타",
            "3루타",
            "홈런"
        ].includes(record.result)
    ) {
        stats.hitsAllowed += 1;
    }

    if (record.result === "볼넷") {
        stats.walks += 1;
    }

    if (record.result === "삼진") {
        stats.strikeouts += 1;
    }

    stats.runsAllowed +=
        record.runs;
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
            .map(function ([name, stats]) {
                const strikeRate =
                    stats.pitches > 0
                        ? (
                            stats.strikes /
                            stats.pitches
                        ) * 100
                        : 0;

                return `
                    <div class="stat-player-card">
                        <h3>${name}</h3>

                        <div class="stat-row">
                            <span>상대한 타자</span>
                            <strong>${stats.battersFaced}</strong>
                        </div>

                        <div class="stat-row">
                            <span>총 투구 수</span>
                            <strong>${stats.pitches}</strong>
                        </div>

                        <div class="stat-row">
                            <span>스트라이크</span>
                            <strong>${stats.strikes}</strong>
                        </div>

                        <div class="stat-row">
                            <span>볼</span>
                            <strong>${stats.balls}</strong>
                        </div>

                        <div class="stat-row">
                            <span>스트라이크 비율</span>
                            <strong>${strikeRate.toFixed(1)}%</strong>
                        </div>

                        <div class="stat-row">
                            <span>삼진</span>
                            <strong>${stats.strikeouts}</strong>
                        </div>

                        <div class="stat-row">
                            <span>볼넷</span>
                            <strong>${stats.walks}</strong>
                        </div>

                        <div class="stat-row">
                            <span>피안타</span>
                            <strong>${stats.hitsAllowed}</strong>
                        </div>
                    </div>
                `;
            })
            .join("");
}


/* =========================================================
   숫자 표시
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
    let bestScore = -1;

    entries.forEach(function ([name, stats]) {
        const calculated =
            getBatterCalculatedStats(stats);

        const score =
            stats.hits * 3 +
            stats.homeRuns * 5 +
            stats.rbi * 2 +
            stats.runs +
            calculated.ops * 4;

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

            <h3>${bestPlayer.name}</h3>

            <p>
                경기 기여도가 가장 높은 타자
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
            { length: maxInning },
            function (_, index) {
                return `${index + 1}회`;
            }
        );

    const homeData =
        labels.map(
            function (_, index) {
                return (
                    inningScores.home[
                        index + 1
                    ] || 0
                );
            }
        );

    const awayData =
        labels.map(
            function (_, index) {
                return (
                    inningScores.away[
                        index + 1
                    ] || 0
                );
            }
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
                    labels: labels,

                    datasets: [
                        {
                            label: "HOME",
                            data: homeData,
                            borderColor:
                                "#ef3340",
                            backgroundColor:
                                "rgba(239,51,64,0.15)",
                            tension: 0.3
                        },

                        {
                            label: "AWAY",
                            data: awayData,
                            borderColor:
                                "#2563eb",
                            backgroundColor:
                                "rgba(37,99,235,0.15)",
                            tension: 0.3
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
                                color: "#94a3b8",
                                precision: 0
                            },

                            grid: {
                                color:
                                    "rgba(148,163,184,0.08)"
                            }
                        }
                    }
                }
            }
        );
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

    const resultCount = {};

    plateAppearances.forEach(function (record) {
        resultCount[record.result] =
            (
                resultCount[record.result] ||
                0
            ) + 1;
    });

    const labels =
        Object.keys(resultCount);

    const data =
        Object.values(resultCount);

    if (resultChart) {
        resultChart.destroy();
    }

    resultChart =
        new Chart(
            canvas,
            {
                type: "doughnut",

                data: {
                    labels:
                        labels.length > 0
                            ? labels
                            : ["기록 없음"],

                    datasets: [
                        {
                            data:
                                data.length > 0
                                    ? data
                                    : [1],

                            backgroundColor: [
                                "#ef3340",
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
            }
        );
}


/* =========================================================
   로컬 영상
========================================================= */

function loadVideo(event) {
    const file =
        event.target.files[0];

    if (!file || !video) return;

    video.src =
        URL.createObjectURL(file);

    video.load();

    const fileName =
        document.getElementById(
            "videoFileName"
        );

    if (fileName) {
        fileName.textContent =
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
   영상 제어
========================================================= */

function back5() {
    if (!video) return;

    video.currentTime =
        Math.max(
            0,
            video.currentTime - 5
        );
}


function forward5() {
    if (!video) return;

    video.currentTime += 5;
}


function playPause() {
    if (!video) return;

    if (video.paused) {
        video.play().catch(function () {});
    } else {
        video.pause();
    }
}


function setVideoSpeed(speed) {
    if (!video) return;

    video.playbackRate =
        Number(speed) || 1;
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
        window.youtubePlayer &&
        typeof window.youtubePlayer
            .getCurrentTime ===
            "function" &&
        !document
            .getElementById(
                "youtubePlayerWrap"
            )
            .hidden
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
    const target =
        Number(time) || 0;

    const youtubeWrap =
        document.getElementById(
            "youtubePlayerWrap"
        );

    if (
        youtubeWrap &&
        !youtubeWrap.hidden &&
        window.youtubePlayer &&
        typeof window.youtubePlayer.seekTo ===
            "function"
    ) {
        window.youtubePlayer.seekTo(
            target,
            true
        );

        return;
    }

    if (video) {
        video.currentTime = target;
        video.play().catch(function () {});
    }
}


/* =========================================================
   YouTube 영상
========================================================= */

let pendingYouTubeId = "";


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

        if (match && match[1]) {
            return match[1];
        }
    }

    return "";
}


function loadYouTubeVideo() {
    const url =
        document
            .getElementById(
                "youtubeUrl"
            )
            .value
            .trim();

    const videoId =
        extractYouTubeId(url);

    if (!videoId) {
        alert(
            "올바른 유튜브 주소를 입력해주세요."
        );
        return;
    }

    pendingYouTubeId =
        videoId;

    const wrap =
        document.getElementById(
            "youtubePlayerWrap"
        );

    if (wrap) {
        wrap.hidden = false;
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
   최초 실행
========================================================= */

window.addEventListener(
    "load",
    function () {
        setTodayDate();

        updateInningDisplay();
        updateCountDisplay();
        updateBaseDisplay();
        updatePitchSequence();
        updateSelectedResult();
        updateScoreDisplay();

        drawRecordTable();
        drawBatterStats();
        drawPitcherStats();
        drawCharts();
        drawMVP();
    }
);