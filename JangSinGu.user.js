// ==UserScript==
// @name         JangSinGu-SsalMukGi
// @namespace    http://tampermonkey.net/
// @version      2025-04-15
// @description  로스트아크 경매장에서 장신구를 힘민지/골드 그래프로 보여줍니다.
// @author       Graval504
// @match        https://lostark.game.onstove.com/Auction
// @icon         https://www.google.com/s2/favicons?sz=64&domain=onstove.com
// @downloadURL  https://github.com/Graval504/MyExtension/raw/refs/heads/main/JangSinGu.user.js
// @updateURL    https://github.com/Graval504/MyExtension/raw/refs/heads/main/JangSinGu.user.js
// @grant        none
// @license      DBAD
// ==/UserScript==

const ProductNum = 200; // 검색할 물량 수 (낮은가격순부터)
const category = { 목걸이: 200010, 귀걸이: 200020, 반지: 200030 };
const grade = { 유물: 5, 고대: 6, 전체: null };
const option = {
  추피: 41,
  적주피: 42,
  공퍼: 45,
  무공퍼: 46,
  치적: 49,
  치피: 50,
  깡공: 53,
  깡무공: 54,
};
const optionFullName = {
  "추가 피해": 41,
  "적에게 주는 피해 증가": 42,
  공격력: 45,
  "무기 공격력": 46,
  "치명타 적중률": 49,
  "치명타 피해": 50,
  "무기 공격력+": 54,
  "공격력+": 53,
  낙인력: 44,
  "상태이상 공격 지속시간": 57,
  "세레나데,신성,조화 게이지 획득량 증가": 43,
  "아군 공격력 강화 효과": 51,
  "아군 피해량 강화 효과": 52,
  "전투 중 생명력 회복량+": 58,
  "최대 마나+": 56,
  "최대 생명력+": 55,
  "파티원 보호막 효과": 48,
  "파티원 회복 효과": 47,
};

const reduceOptionName = {
  "추가 피해": "추피",
  "적에게 주는 피해 증가": "적주피",
  공격력: "공퍼",
  "무기 공격력": "무공퍼",
  "치명타 적중률": "치적",
  "치명타 피해": "치피",
  "공격력+": "깡공",
  "무기 공격력+": "깡무공",
};

const optionValue = {
  추피: { 상: 260, 중: 160, 하: 60 },
  적주피: { 상: 200, 중: 120, 하: 55 },
  공퍼: { 상: 155, 중: 95, 하: 40 },
  무공퍼: { 상: 300, 중: 180, 하: 80 },
  치적: { 상: 155, 중: 95, 하: 40 },
  치피: { 상: 400, 중: 240, 하: 110 },
  깡공: { 상: 390, 중: 195, 하: 80 },
  깡무공: { 하: 960, 중: 480, 하: 195 },
};
const statRange = {
  200010: [12678, 15357],
  200020: [9861, 11944],
  200030: [9156, 11091],
};
const grindStat = {
  200010: [357, 714, 1429],
  200020: [278, 556, 1111],
  200030: [258, 516, 1032],
};
const internalDataMap = new Map();
function GetEnlightenment(grade, grindNum) {
  return grindNum == 0
    ? 3
    : grade + grindNum + GetEnlightenment(grade, grindNum - 1);
}

function normalizeArray(arr) {
  return arr.map((item) => (Array.isArray(item) ? item : [item]));
}

// 우선순위 조합 생성 (backtrack 분리)
function generateCombinationsFromPriority(priorityString, nameArray) {
  const result = new Set();
  const priorityMap = { 상: 3, 중: 2, 하: 1 };
  const priorityInput = priorityString.split("").map((k) => priorityMap[k]);
  const allowedPriority = {
    0: [1, 2, 3],
    1: [1, 2, 3],
    2: [1],
    3: [1],
  };
  function backtrack(pos, path, usedSet) {
    if (pos === priorityInput.length) {
      const mapped = path.map((idx, i) => [nameArray[idx], priorityInput[i]]);
      const normalized = mapped
        .slice()
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map((x) => x[0])
        .join(",");
      result.add(normalized);
      return;
    }
    for (let i = 0; i < nameArray.length; i++) {
      if (usedSet.has(i) || !allowedPriority[i].includes(priorityInput[pos])) continue;
      usedSet.add(i);
      backtrack(pos + 1, [...path, i], usedSet);
      usedSet.delete(i);
    }
  }
  backtrack(0, [], new Set());
  return Array.from(result).map((s) => s.split(","));
}

// 옵션 조합 생성 (switch-case depth 감소)
function getAllOptions(input, checkbox) {
  const accTypeOptions = {
    반지: ["치적", "치피"],
    귀걸이: ["공퍼", "무공퍼"],
    목걸이: ["추피", "적주피"],
  };
  const possibleOptions = [...accTypeOptions[input[0]]];
  if (checkbox) possibleOptions.push("깡공", "깡무공");
  return generateCombinationsFromPriority(input[2], possibleOptions);
}

// 반복되는 styleInput, optionSelects 생성 분리
function styleInput(el, minWidth = "120px") {
  if (el.tagName === 'SELECT') {
    el.className = "lostark-select";
  } else {
    el.className = "lostark-input";
  }
  el.style.minWidth = minWidth;
  el.style.width = "100%";
  el.style.boxSizing = "border-box";
}

// 버튼 그룹 생성 함수
function createButtonGroup(options, defaultSelected, onSelect) {
  const wrapper = document.createElement("div");
  wrapper.className = "lostark-form-group";
  
  const buttonGroup = document.createElement("div");
  buttonGroup.className = "lostark-button-group";
  
  let selectedValue = defaultSelected;
  
  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lostark-toggle-button";
    button.textContent = option;
    
    if (option === defaultSelected) {
      button.classList.add("active");
    }
    
    button.addEventListener("click", () => {
      // 기존 활성 버튼 비활성화
      buttonGroup.querySelectorAll(".lostark-toggle-button").forEach(btn => {
        btn.classList.remove("active");
      });
      
      // 현재 버튼 활성화
      button.classList.add("active");
      selectedValue = option;
      
      if (onSelect) {
        onSelect(selectedValue);
      }
    });
    
    buttonGroup.appendChild(button);
  });
  
  // 현재 선택된 값을 가져오는 메서드
  wrapper.getValue = () => selectedValue;
  wrapper.setValue = (value) => {
    buttonGroup.querySelectorAll(".lostark-toggle-button").forEach(btn => {
      btn.classList.remove("active");
      if (btn.textContent === value) {
        btn.classList.add("active");
        selectedValue = value;
      }
    });
  };
  
  wrapper.appendChild(buttonGroup);
  return wrapper;
}

function createOptionInline(optionFullName, accType, onChange) {
  // 장신구별 옵션 배열 정의
  const accTypeOptions = {
    목걸이: [
      "적에게 주는 피해 증가",
      "추가 피해", 
      "공격력+",
      "무기 공격력+"
    ],
    귀걸이: [
      "공격력",
      "무기 공격력",
      "공격력+", 
      "무기 공격력+"
    ],
    반지: [
      "치명타 피해",
      "치명타 적중률",
      "공격력+",
      "무기 공격력+"
    ]
  };
  const options = accTypeOptions[accType] || Object.keys(optionFullName).slice(0, 8);
  
  // 선택 상태 관리
  let selectedOptions = ["", "", ""];
  let selectedGrades = ["", "", ""];

  // 메인 컨테이너
  const container = document.createElement("div");
  container.className = "lostark-option-inline animate-fade-in";
  
  // 헤더
  const header = document.createElement("div");
  header.className = "lostark-option-header";
  header.innerHTML = `
    <i class="fa-solid fa-gem"></i>
    <span>옵션 선택 (최대 3개)</span>
  `;
  container.appendChild(header);

  // 옵션 그리드 컨테이너
  const optionGrid = document.createElement("div");
  optionGrid.className = "lostark-option-grid";

  // 3개의 옵션 선택 컬럼 생성
  for (let i = 0; i < 3; i++) {
    const optionColumn = document.createElement("div");
    optionColumn.className = "lostark-option-column";
    
    // 컬럼 제목
    const columnTitle = document.createElement("div");
    columnTitle.className = "lostark-option-title";
    columnTitle.innerHTML = `<span class="lostark-badge lostark-badge--grind-${(i % 3) + 1}">옵션 ${i + 1}</span>`;
    optionColumn.appendChild(columnTitle);

    // 옵션 버튼들 컨테이너
    const optionButtons = document.createElement("div");
    optionButtons.className = "lostark-option-buttons";

         // 옵션 버튼들 생성
     options.forEach(opt => {
       const button = document.createElement("button");
       button.type = "button";
       button.className = "lostark-option-button";
       
       // 옵션 이름을 축약해서 표시
       const shortName = reduceOptionName[opt] || opt;
       button.innerHTML = `
         <span style="font-weight: 600; color: var(--primary); font-size: var(--font-size-sm);">${shortName}</span>
         <div style="font-size: var(--font-size-xs); opacity: 0.6; margin-top: 1px; line-height: 1.2;">${opt}</div>
       `;
       button.dataset.option = opt;
       button.dataset.columnIndex = i;
      
      button.addEventListener("click", () => {
        // 같은 컬럼의 다른 버튼들 비활성화
        optionButtons.querySelectorAll('.lostark-option-button').forEach(btn => {
          btn.classList.remove('active');
        });
        
        // 현재 버튼 활성화/비활성화 토글
        if (selectedOptions[i] === opt) {
          // 이미 선택된 경우 해제
          selectedOptions[i] = "";
          selectedGrades[i] = "";
          button.classList.remove('active');
          optionColumn.classList.remove('selected');
          gradeButtons.querySelectorAll('.lostark-grade-button').forEach(gradeBtn => {
            gradeBtn.classList.remove('active');
            gradeBtn.disabled = true;
          });
        } else {
          // 새로 선택
          selectedOptions[i] = opt;
          button.classList.add('active');
          optionColumn.classList.add('selected');
          // 등급 버튼들 활성화
          gradeButtons.querySelectorAll('.lostark-grade-button').forEach(gradeBtn => {
            gradeBtn.disabled = false;
          });
        }
        
        updateButtonStates();
        triggerChange();
      });
      
      optionButtons.appendChild(button);
    });

    // 등급 버튼들 컨테이너
    const gradeButtons = document.createElement("div");
    gradeButtons.className = "lostark-grade-buttons";

    // 등급 버튼들 생성
    ["상", "중", "하"].forEach(grade => {
      const gradeButton = document.createElement("button");
      gradeButton.type = "button";
      gradeButton.className = "lostark-grade-button";
      gradeButton.textContent = grade;
      gradeButton.dataset.grade = grade;
      gradeButton.dataset.columnIndex = i;
      gradeButton.disabled = true; // 초기에는 비활성화
      
      gradeButton.addEventListener("click", () => {
        if (gradeButton.disabled) return;
        
        // 같은 컬럼의 다른 등급 버튼들 비활성화
        gradeButtons.querySelectorAll('.lostark-grade-button').forEach(btn => {
          btn.classList.remove('active');
        });
        
        // 현재 버튼 활성화/비활성화 토글
        if (selectedGrades[i] === grade) {
          selectedGrades[i] = "";
          gradeButton.classList.remove('active');
        } else {
          selectedGrades[i] = grade;
          gradeButton.classList.add('active');
        }
        
        triggerChange();
      });
      
      gradeButtons.appendChild(gradeButton);
    });

    optionColumn.appendChild(optionButtons);
    optionColumn.appendChild(gradeButtons);
    optionGrid.appendChild(optionColumn);

    // 전역 접근을 위해 저장
    container[`optionColumn${i}`] = optionColumn;
    container[`optionButtons${i}`] = optionButtons;
    container[`gradeButtons${i}`] = gradeButtons;
  }
  
  container.appendChild(optionGrid);

  // 버튼 상태 업데이트 함수
  function updateButtonStates() {
    for (let i = 0; i < 3; i++) {
      const optionButtons = container[`optionButtons${i}`];
      
      // 모든 옵션 버튼 활성화
      optionButtons.querySelectorAll('.lostark-option-button').forEach(button => {
        button.disabled = false;
      });
      
      // 다른 컬럼에서 선택된 옵션들 비활성화
      selectedOptions.forEach((selectedOpt, idx) => {
        if (selectedOpt && idx !== i) {
          optionButtons.querySelectorAll('.lostark-option-button').forEach(button => {
            if (button.dataset.option === selectedOpt) {
              button.disabled = true;
            }
          });
        }
      });
    }
  }

  // 변경 이벤트 트리거
  function triggerChange() {
    if (onChange) {
      onChange(selectedOptions.slice(), selectedGrades.slice());
    }
  }

  // 초기 상태 설정
  updateButtonStates();
  
  return container;
}

function parse(jsonData, index, category) {
  if (!jsonData) {
    return;
  }
  const JsonItem = jsonData["Items"][index];
  const gradeQuality = JsonItem["GradeQuality"];
  const grade = JsonItem["Grade"];
  const name = JsonItem["Name"];
  const tradeLeft = JsonItem["AuctionInfo"]["TradeAllowCount"];
  const grindNum = JsonItem["AuctionInfo"]["UpgradeLevel"];
  const effects = JsonItem["Options"].map((opt) => ({
    OptionName: opt.OptionName.trim(),
    Value: opt.Value,
    IsPercentage: opt.IsValuePercentage,
  }));
  const buyPrice = JsonItem["AuctionInfo"]["BuyPrice"];
  const auctionPrice = JsonItem["AuctionInfo"]["BidPrice"];
  const stat = JsonItem["Options"].filter((item) => item["OptionName"] == "힘")[0]["Value"];
  const statPer =
    (stat -
      statRange[category][0] -
      grindStat[category].slice(0, grindNum).reduce((a, b) => a + b, 0)) /
    (statRange[category][1] - statRange[category][0]);
  const price = buyPrice || auctionPrice;
  const pageNo = jsonData["PageNo"];
  const productNum = index;

  return {
    name,
    grade,
    gradeQuality,
    grindNum,
    stat,
    statPer,
    tradeLeft,
    effects,
    price,
    buyPrice,
    auctionPrice,
    pageNo,
    productNum,
  };
}

async function search(form, pageNo) {
  const body = {
    CategoryCode: form.category,
    ItemTier: 4,
    ItemGrade: form.grade ?? "",
    ItemLevelMin: 0,
    ItemLevelMax: 1700,
    ItemUpgradeLevel: form.upgrade,
    EtcOptions: [
      {
        FirstOption: 8,
        SecondOption: 1,
        MinValue: form.enlightenment ?? "",
        MaxValue: form.enlightenment ?? "",
      },
      {
        FirstOption: 7,
        SecondOption: form.grindOption1?.type ?? "",
        MinValue: form.grindOption1?.grade ?? "",
        MaxValue: form.grindOption1?.grade ?? "",
      },
      {
        FirstOption: 7,
        SecondOption: form.grindOption2?.type ?? "",
        MinValue: form.grindOption2?.grade ?? "",
        MaxValue: form.grindOption2?.grade ?? "",
      },
      {
        FirstOption: 7,
        SecondOption: form.grindOption3?.type ?? "",
        MinValue: form.grindOption3?.grade ?? "",
        MaxValue: form.grindOption3?.grade ?? "",
      },
    ],
    PageNo: pageNo,
    SortOption: {
      Sort: "BUY_PRICE",
    },
  };

  return fetch("https://developer-lostark.game.onstove.com/auctions/items", {
    headers: {
      "content-type": "application/json",
      authorization: "bearer " + form.apikey,
    },
    body: JSON.stringify(body),
    method: "POST",
  })
    .then((res) => {
      if (res.status === 500) {
        throw new Error("ERR_INTERNAL_SERVER");
      }
      return res.json();
    })
    .then((jsonData) => {
      if (!jsonData || typeof jsonData["TotalCount"] !== "number" || !jsonData["Items"]) {
        return [];
      }
      var index = Math.min(
        jsonData["TotalCount"] - (jsonData["PageNo"] - 1) * 10,
        10
      );
      const products = Array.from({ length: index }, (_, i) => i)
        .map((index) => parse(jsonData, index, form.category))
        .filter((x) => !!x);
      return products;
    });
}

async function trySearch(form, pageNo) {
  let searchResult;
  let failCount = 0;
  while (true) {
    try {
      searchResult = await search(form, pageNo);
      return searchResult;
    } catch (err) {
      failCount += 1;
      if (failCount > 5) {
        throw new Error(
          "경매장 검색에 5회 연속 실패했습니다. 스크립트를 종료합니다."
        );
      }
      if (err.message === "ERR_LIMIT_REACHED") {
        console.log(
          "경매장 검색 횟수 제한을 초과했습니다. 5분 후에 자동으로 재시도합니다."
        );
        await new Promise((resolve) => setTimeout(resolve, 60000 * 5 + 1000));
        continue;
      }
      if (err.message === "ERR_INTERNAL_SERVER") {
        console.log(
          "경매장 검색 서버에 오류가 발생했습니다. 30초 후에 자동으로 재시도합니다."
        );
        await new Promise((resolve) => setTimeout(resolve, 30000));
        continue;
      }
      if (err.message === "ERR_MAINTENANCE") {
        console.log("경매장 서비스 점검 중입니다. 스크립트를 종료합니다.");
        throw err;
      }
      if (err.message === "ERR_NO_LOGIN") {
        console.log("로그인이 필요합니다. 스크립트를 종료합니다.");
        throw err;
      }
      console.log("식별되지 않은 오류가 발생했습니다. 스크립트를 종료합니다.");
      throw err;
    }
  }
}

const SEARCH_DELAY = 0.2;
async function getSearchResult(input, apikey, optionResult, checkbox, submitBtn) {
  // 새로운 검색 시작 시 기존 플로팅 차트 정리
  cleanupFloatingChart();
  
  const [accType, searchGrade, filter] = input;
  let count = 0;
  const productsAll = [[], [], [], []];
  const optionList = optionResult.length === 0 ? getAllOptions(input, checkbox) : optionResult;
  const loopLength = (4 - input[2].length) * optionList.length;
  for (let grindNum = input[2].length; grindNum <= 3; grindNum++) {
    for (const options of optionList) {
      count++;
      submitBtn.value = `${Math.round((count * 100) / loopLength)}%`;
      const form = {
        apikey,
        category: category[accType],
        grade: searchGrade,
        upgrade: grindNum,
        enlightenment: GetEnlightenment(grade[searchGrade] - 5, grindNum) + Number(accType === "목걸이"),
        grindOption1: input[2][0] && { type: option[options[0]], grade: optionValue[options[0]][input[2][0]] },
        grindOption2: input[2][1] && { type: option[options[1]], grade: optionValue[options[1]][input[2][1]] },
        grindOption3: input[2][2] && { type: option[options[2]], grade: optionValue[options[2]][input[2][2]] },
      };
      let products = await trySearch(form, 1);
      productsAll[grindNum].push(...products);
      let page = 1;
      let foundProducts = 0;
      // getAllOptions 반복 제거, foundProducts 계산 개선
      while (products.length === 10 && foundProducts < ProductNum) {
        page++;
        await new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY * 1000));
        products = await trySearch(form, page);
        productsAll[grindNum].push(...products);
        foundProducts += products.filter((product) => product.price).length;
      }
      await new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY * 1000));
    }
  }
  return productsAll;
}

let originalResult = null; // 최초 데이터 저장용

// 히스토리 저장용 배열
let searchHistory = [];

// 히스토리 UI 생성 및 관리 함수
function renderHistoryUI() {
  let historyWrapper = document.getElementById("history-wrapper");
  if (!historyWrapper) {
    historyWrapper = document.createElement("div");
    historyWrapper.id = "history-wrapper";
    historyWrapper.className = "lostark-card animate-fade-in";
    historyWrapper.style.display = "flex";
    historyWrapper.style.flexDirection = "column";
    historyWrapper.style.gap = "var(--spacing-md)";
    historyWrapper.style.margin = "var(--spacing-xl) 0";
    historyWrapper.style.padding = "var(--spacing-xl)";
    historyWrapper.style.background = "var(--surface-light)";
    historyWrapper.style.borderRadius = "var(--radius-lg)";
    historyWrapper.style.boxShadow = "var(--shadow-md)";
    
    // 히스토리 제목 추가
    const historyTitle = document.createElement("div");
    historyTitle.innerHTML = '<i class="fa-solid fa-history" style="margin-right: var(--spacing-sm); color: var(--primary);"></i><span style="font-weight: 600; color: var(--on-surface); font-size: var(--font-size-lg);">검색 히스토리</span>';
    historyTitle.style.marginBottom = "var(--spacing-md)";
    historyWrapper.appendChild(historyTitle);
    
    // 히스토리 버튼 컨테이너
    const historyButtons = document.createElement("div");
    historyButtons.id = "history-buttons";
    historyButtons.style.display = "flex";
    historyButtons.style.flexWrap = "wrap";
    historyButtons.style.gap = "var(--spacing-sm)";
    historyWrapper.appendChild(historyButtons);
    
    document.querySelector("form").prepend(historyWrapper);
  }
  
  const historyButtons = document.getElementById("history-buttons");
  if (historyButtons) {
    historyButtons.innerHTML = "";
  }
  
  if (searchHistory.length === 0) {
    const empty = document.createElement("div");
    empty.innerHTML = '<i class="fa-solid fa-info-circle" style="margin-right: var(--spacing-xs); color: var(--info);"></i><span style="color: var(--on-surface-variant);">검색 히스토리 없음</span>';
    empty.style.padding = "var(--spacing-md)";
    empty.style.textAlign = "center";
    empty.style.fontStyle = "italic";
    historyButtons.appendChild(empty);
    return;
  }
  // 선택된 히스토리 인덱스 추적
  if (typeof window.selectedHistoryIdx !== "number") {
    window.selectedHistoryIdx = searchHistory.length - 1;
  }
  searchHistory.forEach((entry, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lostark-button";
    btn.style.fontSize = "var(--font-size-sm)";
    btn.style.padding = "var(--spacing-sm) var(--spacing-md)";
    btn.style.minWidth = "auto";
    btn.style.maxWidth = "300px";
    btn.style.whiteSpace = "nowrap";
    btn.style.overflow = "hidden";
    btn.style.textOverflow = "ellipsis";
    
    // 선택 상태에 따른 스타일링
    if (idx === window.selectedHistoryIdx) {
      btn.style.background = "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)";
      btn.style.color = "var(--surface)";
      btn.style.fontWeight = "700";
      btn.style.boxShadow = "var(--shadow-lg)";
      btn.style.transform = "translateY(-2px)";
      btn.innerHTML = `<i class="fa-solid fa-star" style="margin-right: var(--spacing-xs);"></i>${entry.label.length > 35 ? entry.label.slice(0, 35) + "…" : entry.label}`;
    } else if (idx === searchHistory.length - 1) {
      btn.style.background = "linear-gradient(135deg, var(--secondary) 0%, var(--secondary-dark) 100%)";
      btn.style.color = "var(--surface)";
      btn.innerHTML = `<i class="fa-solid fa-clock" style="margin-right: var(--spacing-xs);"></i>${entry.label.length > 35 ? entry.label.slice(0, 35) + "…" : entry.label}`;
    } else {
      btn.style.background = "var(--surface-lighter)";
      btn.style.color = "var(--on-surface-variant)";
      btn.innerHTML = `<i class="fa-solid fa-history" style="margin-right: var(--spacing-xs);"></i>${entry.label.length > 35 ? entry.label.slice(0, 35) + "…" : entry.label}`;
    }
    
    btn.title = entry.label;
    btn.onclick = () => {
      originalResult = entry.result.map((arr) => arr.slice());
      updateChart(entry.result, entry.input);
      window.selectedHistoryIdx = idx;
      renderHistoryUI(); // 다시 렌더링해서 선택 표시
    };
    
    historyButtons.appendChild(btn);
  });
}

// 플로팅 차트 상태 관리
let floatingChartState = {
  isFloating: false,
  floatingContainer: null,
  floatingChart: null,
  observer: null,
  originalData: null,
  originalInput: null
};

function createChartAndOpenImage(result, input) {
  // 1. Chart.js 로드
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/chart.js";
  script.onload = async () => {
    if (window.myChart) {
      window.myChart.destroy();
    }
    // 2. 캔버스 생성
    if (!Chart.registry.plugins.get("zoom")) {
      await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom";
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }
    // 차트 컨테이너 생성 (차트만)
    let chartContainer = document.getElementById("chart-container");
    if (!chartContainer) {
      chartContainer = document.createElement("div");
      chartContainer.id = "chart-container";
      chartContainer.className = "lostark-chart-container animate-fade-in";
      chartContainer.style.display = "flex";
      chartContainer.style.flexDirection = "column";
      chartContainer.style.gap = "var(--spacing-xl)";
      chartContainer.style.width = "100%";
      chartContainer.style.margin = "var(--spacing-xl) 0";
      document.querySelector("form").prepend(chartContainer);
    }

    // 차트 영역
    let chartWrapper = document.getElementById("chart-wrapper");
    if (!chartWrapper) {
      chartWrapper = document.createElement("div");
      chartWrapper.id = "chart-wrapper";
      chartWrapper.className = "lostark-card";
      chartWrapper.style.width = "100%";
      chartWrapper.style.position = "relative";
      chartWrapper.style.padding = "var(--spacing-xl)";
      chartWrapper.style.background = "var(--surface)";
      chartWrapper.style.borderRadius = "var(--radius-lg)";
      chartWrapper.style.boxShadow = "var(--shadow-lg)";
      chartWrapper.style.minHeight = "400px";
      chartContainer.appendChild(chartWrapper);
    }

    // 표 영역 (차트 아래 별도 배치)
    let tableWrapper = document.getElementById("table-wrapper");
    if (!tableWrapper) {
      tableWrapper = document.createElement("div");
      tableWrapper.id = "table-wrapper";
      tableWrapper.className = "lostark-card animate-fade-in";
      tableWrapper.style.width = "100%";
      tableWrapper.style.padding = "var(--spacing-xl)";
      tableWrapper.style.background = "var(--surface-light)";
      tableWrapper.style.borderRadius = "var(--radius-lg)";
      tableWrapper.style.boxShadow = "var(--shadow-lg)";
      tableWrapper.style.margin = "var(--spacing-xl) 0";
      tableWrapper.style.maxHeight = "800px";
      tableWrapper.style.overflowY = "auto";
      chartContainer.appendChild(tableWrapper);
    }

    let canvas = document.getElementById("scatter-chart");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "scatter-chart";
      canvas.style.width = "100%";
      chartWrapper.appendChild(canvas);
    }

    // 가격 필터 UI 추가
    let priceFilterWrapper = document.getElementById("price-filter-wrapper");
    if (!priceFilterWrapper) {
      priceFilterWrapper = document.createElement("div");
      priceFilterWrapper.id = "price-filter-wrapper";
      priceFilterWrapper.className = "lostark-card animate-fade-in";
      priceFilterWrapper.style.display = "flex";
      priceFilterWrapper.style.gap = "var(--spacing-md)";
      priceFilterWrapper.style.alignItems = "center";
      priceFilterWrapper.style.padding = "var(--spacing-lg)";
      priceFilterWrapper.style.margin = "var(--spacing-xl) 0";
      priceFilterWrapper.style.background = "var(--surface-light)";
      priceFilterWrapper.style.borderRadius = "var(--radius-lg)";
      priceFilterWrapper.style.boxShadow = "var(--shadow-md)";
      
      // 필터 제목 추가
      const filterTitle = document.createElement("div");
      filterTitle.innerHTML = '<i class="fa-solid fa-filter" style="margin-right: var(--spacing-sm); color: var(--primary);"></i><span style="font-weight: 600; color: var(--on-surface);">가격 필터</span>';
      filterTitle.style.marginRight = "var(--spacing-lg)";
      priceFilterWrapper.appendChild(filterTitle);
      
      // 최대 가격 입력
      const priceInput = document.createElement("input");
      priceInput.type = "text";
      priceInput.placeholder = "최대 가격(골드)";
      priceInput.id = "max-price-input";
      priceInput.className = "lostark-input";
      priceInput.style.width = "180px";
      priceInput.style.fontSize = "var(--font-size-sm)";
      // 3자리마다 , 표시 (입력 중에도)
      priceInput.addEventListener("input", (e) => {
        // 숫자만 추출
        let value = e.target.value.replace(/[^0-9]/g, "");
        if (value) {
          // 3자리마다 , 추가
          value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
        e.target.value = value;
      });

      // 500,000 설정 버튼
      const set500kBtn = document.createElement("button");
      set500kBtn.type = "button";
      set500kBtn.innerHTML = '<i class="fa-solid fa-coins" style="margin-right: var(--spacing-xs);"></i>500K';
      set500kBtn.className = "lostark-button";
      set500kBtn.style.minWidth = "100px";
      set500kBtn.style.fontSize = "var(--font-size-sm)";
      set500kBtn.style.background = "linear-gradient(135deg, var(--accent) 0%, #e65100 100%)";
      set500kBtn.onclick = () => {
        priceInput.value = "500,000";
        priceInput.dispatchEvent(new Event("input"));
      };

      // 1,000,000 설정 버튼
      const set1mBtn = document.createElement("button");
      set1mBtn.type = "button";
      set1mBtn.innerHTML = '<i class="fa-solid fa-gem" style="margin-right: var(--spacing-xs);"></i>1M';
      set1mBtn.className = "lostark-button";
      set1mBtn.style.minWidth = "90px";
      set1mBtn.style.fontSize = "var(--font-size-sm)";
      set1mBtn.style.background = "linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)";
      set1mBtn.onclick = () => {
        priceInput.value = "1,000,000";
        priceInput.dispatchEvent(new Event("input"));
      };

      // +50,000 버튼 생성
      const plus50kBtn = document.createElement("button");
      plus50kBtn.type = "button";
      plus50kBtn.innerHTML = '<i class="fa-solid fa-plus" style="margin-right: var(--spacing-xs);"></i>50K';
      plus50kBtn.className = "lostark-button";
      plus50kBtn.style.minWidth = "90px";
      plus50kBtn.style.fontSize = "var(--font-size-sm)";
      plus50kBtn.style.background = "var(--secondary)";
      plus50kBtn.onclick = () => {
        // 현재 값에서 50,000 더하기
        let value = priceInput.value.replace(/[^0-9]/g, "");
        let num = Number(value) || 0;
        num += 50000;
        priceInput.value = num.toLocaleString();
        priceInput.dispatchEvent(new Event("input")); // 포맷 유지
      };

      // +100,000 버튼 생성
      const plus100kBtn = document.createElement("button");
      plus100kBtn.type = "button";
      plus100kBtn.innerHTML = '<i class="fa-solid fa-plus" style="margin-right: var(--spacing-xs);"></i>100K';
      plus100kBtn.className = "lostark-button";
      plus100kBtn.style.minWidth = "100px";
      plus100kBtn.style.fontSize = "var(--font-size-sm)";
      plus100kBtn.style.background = "linear-gradient(135deg, var(--secondary) 0%, #00838f 100%)";
      plus100kBtn.onclick = () => {
        // 현재 값에서 100,000 더하기
        let value = priceInput.value.replace(/[^0-9]/g, "");
        let num = Number(value) || 0;
        num += 100000;
        priceInput.value = num.toLocaleString();
        priceInput.dispatchEvent(new Event("input")); // 포맷 유지
      };

      // 적용 버튼
      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.innerHTML = '<i class="fa-solid fa-check" style="margin-right: var(--spacing-xs);"></i>적용';
      applyBtn.className = "lostark-button";
      applyBtn.style.minWidth = "90px";
      applyBtn.style.fontSize = "var(--font-size-sm)";
      applyBtn.style.background = "linear-gradient(135deg, var(--success) 0%, #388e3c 100%)";

      // 리셋 버튼
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.innerHTML = '<i class="fa-solid fa-refresh" style="margin-right: var(--spacing-xs);"></i>리셋';
      resetBtn.className = "lostark-button";
      resetBtn.style.minWidth = "90px";
      resetBtn.style.fontSize = "var(--font-size-sm)";
      resetBtn.style.background = "linear-gradient(135deg, var(--warning) 0%, #f57c00 100%)"; 
      
      // 이벤트
      applyBtn.onclick = () => {
        // 콤마 제거 후 숫자로 변환
        const maxPrice = Number(priceInput.value.replace(/,/g, ""));
        if (!originalResult) {
          return;
        }
        // 필터링
        const filtered = originalResult.map((arr) =>
          arr.filter((item) => !maxPrice || item.buyPrice <= maxPrice)
        );
        updateChart(filtered, input);
      };
      resetBtn.onclick = () => {
        if (!originalResult) {
          return;
        }
        priceInput.value = "";
        updateChart(originalResult, input);
      };
      // 버튼 그룹들을 위한 래퍼
      const quickSetGroup = document.createElement("div");
      quickSetGroup.style.display = "flex";
      quickSetGroup.style.gap = "var(--spacing-sm)";
      quickSetGroup.style.flexWrap = "wrap";
      quickSetGroup.appendChild(set500kBtn);
      quickSetGroup.appendChild(set1mBtn);
      
      const incrementGroup = document.createElement("div");
      incrementGroup.style.display = "flex";
      incrementGroup.style.gap = "var(--spacing-sm)";
      incrementGroup.style.flexWrap = "wrap";
      incrementGroup.appendChild(plus50kBtn);
      incrementGroup.appendChild(plus100kBtn);
      
      const actionGroup = document.createElement("div");
      actionGroup.style.display = "flex";
      actionGroup.style.gap = "var(--spacing-sm)";
      actionGroup.style.flexWrap = "wrap";
      actionGroup.appendChild(applyBtn);
      actionGroup.appendChild(resetBtn);

      priceFilterWrapper.appendChild(priceInput);
      priceFilterWrapper.appendChild(quickSetGroup);
      priceFilterWrapper.appendChild(incrementGroup);
      priceFilterWrapper.appendChild(actionGroup);
      document.querySelector("form").prepend(priceFilterWrapper);
    }
    // 최초 데이터 저장
    originalResult = result.map((arr) => arr.slice());
    // 차트 생성
    updateChart(result, input);
    
    // 플로팅 차트 시스템 초기화
    setupFloatingChart(result, input);
  };
  document.head.appendChild(script);
}

// 플로팅 차트 시스템 설정
function setupFloatingChart(result, input) {
  // 기존 observer 정리
  if (floatingChartState.observer) {
    floatingChartState.observer.disconnect();
  }
  
  // 데이터 저장
  floatingChartState.originalData = result;
  floatingChartState.originalInput = input;
  
  const chartWrapper = document.getElementById("chart-wrapper");
  if (!chartWrapper) return;
  
  // Intersection Observer 설정
  const observerOptions = {
    root: null, // viewport 기준
    rootMargin: '0px',
    threshold: [0.3, 0.5, 0.7] // 30%, 50%, 70% 가시성 체크
  };
  
  floatingChartState.observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    const visibilityRatio = entry.intersectionRatio;
    
    // 50% 이상 가려지면 플로팅 모드 활성화
    if (visibilityRatio < 0.5 && !floatingChartState.isFloating) {
      activateFloatingChart();
    }
    // 70% 이상 보이면 플로팅 모드 비활성화
    else if (visibilityRatio > 0.7 && floatingChartState.isFloating) {
      deactivateFloatingChart();
    }
  }, observerOptions);
  
  floatingChartState.observer.observe(chartWrapper);
}

// 플로팅 차트 활성화
function activateFloatingChart() {
  if (floatingChartState.isFloating) return;
  
  floatingChartState.isFloating = true;
  
  // 플로팅 컨테이너 생성
  const floatingContainer = createFloatingContainer();
  floatingChartState.floatingContainer = floatingContainer;
  
  // 차트 캔버스 생성
  const floatingCanvas = document.createElement("canvas");
  floatingCanvas.id = "floating-scatter-chart";
  floatingCanvas.style.width = "100%";
  floatingCanvas.style.height = "100%";
  
  const chartContent = floatingContainer.querySelector('.floating-chart-content');
  chartContent.appendChild(floatingCanvas);
  
  // 플로팅 차트 생성
  createFloatingChart(floatingCanvas);
  
  // 바디에 추가
  document.body.appendChild(floatingContainer);
  
  // 페이드인 애니메이션
  setTimeout(() => {
    floatingContainer.style.opacity = '1';
    floatingContainer.style.transform = 'translate(0, 0) scale(1)';
  }, 50);
}

// 플로팅 차트 비활성화
function deactivateFloatingChart() {
  if (!floatingChartState.isFloating) return;
  
  const container = floatingChartState.floatingContainer;
  if (!container) return;
  
  // 페이드아웃 애니메이션
  container.style.opacity = '0';
  container.style.transform = 'translate(10px, 10px) scale(0.95)';
  
  setTimeout(() => {
    if (floatingChartState.floatingChart) {
      floatingChartState.floatingChart.destroy();
      floatingChartState.floatingChart = null;
    }
    
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    
    floatingChartState.floatingContainer = null;
    floatingChartState.isFloating = false;
  }, 300);
}

// 플로팅 컨테이너 생성
function createFloatingContainer() {
  const container = document.createElement('div');
  container.className = 'floating-chart-container';
  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.right = '20px';
  container.style.width = '400px';
  container.style.height = '300px';
  container.style.backgroundColor = 'var(--surface)';
  container.style.border = '2px solid var(--primary)';
  container.style.borderRadius = 'var(--radius-lg)';
  container.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,215,0,0.2)';
  container.style.zIndex = '9999';
  container.style.opacity = '0';
  container.style.transform = 'translate(10px, 10px) scale(0.95)';
  container.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  container.style.backdropFilter = 'blur(10px)';
  container.style.resize = 'both';
  container.style.overflow = 'hidden';
  container.style.minWidth = '300px';
  container.style.minHeight = '200px';
  container.style.maxWidth = '800px';
  container.style.maxHeight = '600px';
  
  // 헤더 생성
  const header = document.createElement('div');
  header.className = 'floating-chart-header';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = 'var(--spacing-sm) var(--spacing-md)';
  header.style.background = 'linear-gradient(90deg, var(--primary), var(--primary-dark))';
  header.style.color = 'var(--surface)';
  header.style.cursor = 'move';
  header.style.userSelect = 'none';
  header.style.fontSize = 'var(--font-size-sm)';
  header.style.fontWeight = '600';
  
  // 제목
  const title = document.createElement('div');
  title.innerHTML = '<i class="fa-solid fa-chart-scatter" style="margin-right: var(--spacing-xs);"></i>차트 뷰어';
  header.appendChild(title);
  
  // 컨트롤 버튼들
  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = 'var(--spacing-xs)';
  
  // 최소화 버튼
  const minimizeBtn = document.createElement('button');
  minimizeBtn.innerHTML = '<i class="fa-solid fa-minus"></i>';
  minimizeBtn.className = 'floating-control-btn';
  minimizeBtn.style.background = 'rgba(255,255,255,0.2)';
  minimizeBtn.style.border = 'none';
  minimizeBtn.style.borderRadius = 'var(--radius-sm)';
  minimizeBtn.style.padding = 'var(--spacing-xs)';
  minimizeBtn.style.color = 'inherit';
  minimizeBtn.style.cursor = 'pointer';
  minimizeBtn.style.width = '24px';
  minimizeBtn.style.height = '24px';
  minimizeBtn.style.fontSize = 'var(--font-size-xs)';
  minimizeBtn.title = '최소화';
  
  // 닫기 버튼
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
  closeBtn.className = 'floating-control-btn';
  closeBtn.style.background = 'rgba(244,67,54,0.8)';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = 'var(--radius-sm)';
  closeBtn.style.padding = 'var(--spacing-xs)';
  closeBtn.style.color = 'white';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.width = '24px';
  closeBtn.style.height = '24px';
  closeBtn.style.fontSize = 'var(--font-size-xs)';
  closeBtn.title = '닫기';
  
  controls.appendChild(minimizeBtn);
  controls.appendChild(closeBtn);
  header.appendChild(controls);
  
  // 차트 내용 영역
  const content = document.createElement('div');
  content.className = 'floating-chart-content';
  content.style.padding = 'var(--spacing-sm)';
  content.style.height = 'calc(100% - 40px)'; // 헤더 높이 제외
  content.style.position = 'relative';
  
  container.appendChild(header);
  container.appendChild(content);
  
  // 이벤트 리스너 추가
  setupFloatingControls(container, header, minimizeBtn, closeBtn);
  
  return container;
}

// 플로팅 컨트롤 설정 (드래그, 최소화, 닫기)
function setupFloatingControls(container, header, minimizeBtn, closeBtn) {
  let isDragging = false;
  let isMinimized = false;
  let dragOffset = { x: 0, y: 0 };
  
  // 드래그 시작
  header.addEventListener('mousedown', (e) => {
    if (e.target === minimizeBtn || e.target === closeBtn || e.target.parentNode === minimizeBtn || e.target.parentNode === closeBtn) {
      return;
    }
    
    isDragging = true;
    const rect = container.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    container.style.transition = 'none';
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
    e.preventDefault();
  });
  
  // 드래그 중
  function handleDrag(e) {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // 화면 경계 체크
    const maxX = window.innerWidth - container.offsetWidth;
    const maxY = window.innerHeight - container.offsetHeight;
    
    const clampedX = Math.max(0, Math.min(maxX, newX));
    const clampedY = Math.max(0, Math.min(maxY, newY));
    
    container.style.left = clampedX + 'px';
    container.style.top = clampedY + 'px';
    container.style.right = 'auto';
    container.style.bottom = 'auto';
  }
  
  // 드래그 종료
  function handleDragEnd() {
    isDragging = false;
    container.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
  }
  
  // 최소화 토글
  minimizeBtn.addEventListener('click', () => {
    const content = container.querySelector('.floating-chart-content');
    isMinimized = !isMinimized;
    
    if (isMinimized) {
      content.style.display = 'none';
      container.style.height = '40px';
      minimizeBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      minimizeBtn.title = '복원';
    } else {
      content.style.display = 'block';
      container.style.height = '300px';
      minimizeBtn.innerHTML = '<i class="fa-solid fa-minus"></i>';
      minimizeBtn.title = '최소화';
      
      // 차트 리사이즈 (복원 시)
      if (floatingChartState.floatingChart) {
        setTimeout(() => {
          floatingChartState.floatingChart.resize();
        }, 350);
      }
    }
  });
  
  // 닫기
  closeBtn.addEventListener('click', () => {
    deactivateFloatingChart();
  });
  
  // 버튼 호버 효과
  [minimizeBtn, closeBtn].forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.transition = 'transform 0.2s ease';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });
  });
}

// 플로팅 차트 생성
function createFloatingChart(canvas) {
  if (!floatingChartState.originalData || !floatingChartState.originalInput) return;
  
  const datasets = makeDataset(floatingChartState.originalData, floatingChartState.originalInput);
  const ctx = canvas.getContext("2d");
  
  // 기존 플로팅 차트 제거
  if (floatingChartState.floatingChart) {
    floatingChartState.floatingChart.destroy();
  }
  
  floatingChartState.floatingChart = new Chart(ctx, {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 6,
            color: 'var(--on-surface)',
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => getTooltipLabel(floatingChartState.originalData, floatingChartState.originalInput, context),
          },
          bodyFont: { size: 11 },
        },
        zoom: {
          pan: { enabled: true, mode: "xy", modifierKey: "ctrl" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "xy",
          },
          limits: { x: { min: 0, max: 1 }, y: { min: 0 } },
        },
      },
      onClick: handleChartClick(floatingChartState.originalData, floatingChartState.originalInput),
      scales: {
        x: { 
          title: { 
            display: true, 
            text: "힘민지%", 
            font: { size: 12 },
            color: 'var(--on-surface)'
          },
          ticks: { 
            color: 'var(--on-surface-variant)',
            font: { size: 10 }
          },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        y: { 
          title: { 
            display: true, 
            text: "골드", 
            font: { size: 12 },
            color: 'var(--on-surface)'
          },
          ticks: { 
            color: 'var(--on-surface-variant)',
            font: { size: 10 }
          },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
      },
    },
  });
}

function getOptionKey(effects) {
  const mainOptions = Object.keys(reduceOptionName);
  return (
    mainOptions
      .map((opt) =>
        effects.some((e) => e.OptionName.includes(opt)) ? opt : ""
      )
      .filter(Boolean)
      .join("+") || "기타"
  );
}

// 주요 옵션 포함 개수에 따라 pointStyle 반환
function getPointStyleByOption(effects) {
  const mainOptions = Object.keys(reduceOptionName);
  const count = mainOptions.filter((opt) => {
    // 예외 처리: +가 붙은 옵션은 IsPercentage: false, 아닌 옵션은 IsPercentage: true
    if (opt === "공격력") {
      return effects.some(
        (e) => e.OptionName === "공격력" && e.IsPercentage === true
      );
    }
    if (opt === "공격력+") {
      return effects.some(
        (e) => e.OptionName === "공격력" && e.IsPercentage === false
      );
    }
    if (opt === "무기 공격력") {
      return effects.some(
        (e) => e.OptionName === "무기 공격력" && e.IsPercentage === true
      );
    }
    if (opt === "무기 공격력+") {
      return effects.some(
        (e) => e.OptionName === "무기 공격력" && e.IsPercentage === false
      );
    }
    // 그 외 옵션은 기존대로 부분 일치
    return effects.some((e) => e.OptionName.includes(opt));
  }).length;

  if (count >= 3) {
    return {
      pointStyle: "circle",
      borderColor: "#222222",
    };
  }
  if (count === 2) {
    return {
      pointStyle: "circle",
      borderColor: "#9e9e9e",
    };
  }
  return {
    pointStyle: "rect"
  };
}

// 딜증가량 계산 함수 분리
function calculateDamageIncrease(item) {
  let dmgInc = 0;
  
  // 1. stat 기반 딜증가량
  if (item.stat) {
    dmgInc += (item.stat / 1000) * 0.12;
  }

  // 2. 옵션 기반 딜증가량
  for (const eff of item.effects) {
    // 무기 공격력(정수) → 252당 0.1%
    if (eff.OptionName === "무기 공격력" && Number.isInteger(eff.Value)) {
      dmgInc += (eff.Value / 252) * 0.1;
    }
    // 공격력(정수) → 102당 0.1%
    if (eff.OptionName === "공격력" && Number.isInteger(eff.Value)) {
      dmgInc += (eff.Value / 102) * 0.1;
    }
  }

  return dmgInc;
}

function getTooltipLabel(result, input, context) {
  const idx = context.dataIndex;
  const grindIdx = context.datasetIndex + input[2].length;
  const item = result[grindIdx][idx];
  
  if (!item) {
    return '';
  }

  const dmgInc = calculateDamageIncrease(item);
  const statPer = (Math.round(context.raw.x * 100000) / 1000).toFixed(2);
  const dmgIncRounded = (Math.round(dmgInc * 100) / 100).toFixed(2);
  const priceStr = context.raw.y.toLocaleString();

  return `힘민지: ${item.stat}-${statPer}% | 힘민지 + 깡(공+무공) 딜 증가량: ${dmgIncRounded}% | 거래횟수: ${item.tradeLeft}회 | 골드: ${priceStr} | \n${item.effects.slice(5).map((item) => [item["OptionName"] + ": " + item["Value"] + "%".repeat(item["Value"] % 1 != 0)]).join(' | ')}`;
}

function makeDataset(result, input) {
  const grindColors = ["#aacff3", "#f6b7c1", "#f8d2a5"];
  const datasets = [];
  for (let grindNum = input[2].length; grindNum <= 3; grindNum++) {
    const dataArr = result[grindNum] || [];
    // pointStyle, borderColor 배열을 한 번에 계산
    const pointStyles = [];
    const pointBorderColors = [];
    for (const item of dataArr) {
      const style = getPointStyleByOption(item.effects);
      pointStyles.push(style.pointStyle);

      if (!style.borderColor) {
        pointBorderColors.push(grindColors[grindNum - 1]); 
      } else {
        pointBorderColors.push(style.borderColor);
      }
    }
    datasets.push({
      label: `${grindNum}연마`,
      data: dataArr.map((item) => ({ x: item.statPer, y: item.buyPrice })),
      borderColor: grindColors[grindNum - 1],
      backgroundColor: grindColors[grindNum - 1],
      pointRadius: 4,
      pointStyle: pointStyles,
      pointBorderColor: pointBorderColors,
      pointBorderWidth: 0.5,
    });
  }
  return datasets;
}

// 표 데이터 생성 및 표시 함수
function createRankingTable(result, input) {
  const tableWrapper = document.getElementById("table-wrapper");
  if (!tableWrapper) return;

  // 모든 데이터를 하나의 배열로 합치고 필요한 정보 계산
  const allItems = [];
  for (let grindNum = input[2].length; grindNum <= 3; grindNum++) {
    const dataArr = result[grindNum] || [];
    
    dataArr.forEach((item, idx) => {
      if (!item || !item.buyPrice) return;
      
      const dmgInc = calculateDamageIncrease(item);
      const dmgIncRounded = (Math.round(dmgInc * 100) / 100).toFixed(2);
      
      // 0.01%당 골드 계산 (딜증가량이 0이면 무한대로 처리)
      const dmgIncPercent = parseFloat(dmgIncRounded);
      const goldPer001Percent = dmgIncPercent > 0 ? 
        Math.round((item.buyPrice / (dmgIncPercent * 100)) * 100) / 100 : 
        Infinity;
      
      allItems.push({
        ...item,
        dmgIncRounded,
        goldPer001Percent,
        grindNum,
        originalIndex: idx
      });
    });
  }

  // 기본 정렬: 효율성 오름차순 (낮은 값이 더 효율적)
  allItems.sort((a, b) => {
    // Infinity 값 처리: Infinity는 항상 맨 뒤로
    if (a.goldPer001Percent === Infinity && b.goldPer001Percent === Infinity) return 0;
    if (a.goldPer001Percent === Infinity) return 1;
    if (b.goldPer001Percent === Infinity) return -1;
    return a.goldPer001Percent - b.goldPer001Percent;
  });

  // 표 HTML 생성
  tableWrapper.innerHTML = `
    <div class="lostark-table-header">
      <i class="fa-solid fa-trophy" style="margin-right: var(--spacing-sm); color: var(--primary);"></i>
      <span style="font-weight: 700; color: var(--on-surface); font-size: var(--font-size-lg);">아이템 순위표</span>
      <span class="lostark-badge" style="margin-left: var(--spacing-md); background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary);">총 ${allItems.length}개</span>
    </div>
    <table id="ranking-table" class="lostark-table">
      <thead>
        <tr>
          <th data-sort="rank" style="width: 10%; text-align: center;">
            <i class="fa-solid fa-hashtag" style="margin-right: var(--spacing-xs);"></i>순위
          </th>
          <th data-sort="dmg" style="width: 20%; text-align: center;">
            <i class="fa-solid fa-fire" style="margin-right: var(--spacing-xs);"></i>딜증가량
          </th>
          <th data-sort="efficiency" style="width: 25%; text-align: center;" title="0.01% 딜증가량당 필요한 골드">
            <i class="fa-solid fa-chart-line" style="margin-right: var(--spacing-xs);"></i>효율성
          </th>
          <th data-sort="trade" style="width: 18%; text-align: center;">
            <i class="fa-solid fa-exchange-alt" style="margin-right: var(--spacing-xs);"></i>거래횟수
          </th>
          <th data-sort="gold" style="width: 27%; text-align: center;">
            <i class="fa-solid fa-coins" style="margin-right: var(--spacing-xs);"></i>골드
          </th>
        </tr>
      </thead>
      <tbody id="ranking-tbody">
      </tbody>
    </table>
  `;

  // 표 행 생성
  const tbody = document.getElementById("ranking-tbody");
  allItems.forEach((item, index) => {
    const row = document.createElement("tr");
    row.className = "lostark-table-row";
    row.style.cursor = "pointer";
    row.style.transition = "all var(--transition-fast)";
    row.dataset.grindNum = item.grindNum;
    row.dataset.originalIndex = item.originalIndex;
    
    // 호버 스타일 및 차트 하이라이트
    row.onmouseenter = () => {
      row.style.background = "rgba(255, 215, 0, 0.08)";
      row.style.transform = "translateX(4px)";
      row.style.boxShadow = "inset 4px 0 0 var(--primary), var(--shadow-sm)";
      highlightChartPoint(item.grindNum, item.originalIndex, true);
    };
    row.onmouseleave = () => {
      row.style.background = "";
      row.style.transform = "";
      row.style.boxShadow = "";
      highlightChartPoint(item.grindNum, item.originalIndex, false);
    };

    // 클릭 시 아이템 구매
    row.onclick = async () => {
      // 비활성화 표시
      row.style.opacity = "0.6";
      row.style.pointerEvents = "none";
      
      try {
        await handleItemPurchase(item, window.currentInput);
      } catch (error) {
        console.error("구매 처리 중 오류:", error);
        alert("구매 처리 중 오류가 발생했습니다.");
      } finally {
        // 원래 상태로 복원
        row.style.opacity = "";
        row.style.pointerEvents = "";
      }
    };

    const grindColors = ["var(--grind-1)", "var(--grind-2)", "var(--grind-3)"];
    const grindColor = grindColors[item.grindNum - 1] || "var(--surface-lighter)";
    const grindLabels = ["1연마", "2연마", "3연마"];
    const grindLabel = grindLabels[item.grindNum - 1] || "";

    const efficiencyText = item.goldPer001Percent === Infinity ? 
      '<span style="color: var(--error); font-weight: 700;">∞</span>' : 
      `<span style="color: var(--info); font-weight: 600;">${item.goldPer001Percent.toLocaleString()}</span>`;

    // 순위에 따른 아이콘
    let rankIcon = "";
    if (index === 0) rankIcon = '<i class="fa-solid fa-crown" style="color: #ffd700; margin-right: var(--spacing-xs);"></i>';
    else if (index === 1) rankIcon = '<i class="fa-solid fa-medal" style="color: #c0c0c0; margin-right: var(--spacing-xs);"></i>';
    else if (index === 2) rankIcon = '<i class="fa-solid fa-award" style="color: #cd7f32; margin-right: var(--spacing-xs);"></i>';

    row.innerHTML = `
      <td style="text-align: center; padding: var(--spacing-md);">
        ${rankIcon}<span style="font-weight: 600; color: var(--on-surface);">${index + 1}</span>
      </td>
      <td style="text-align: center; padding: var(--spacing-md);">
        <div style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-xs);">
          <i class="fa-solid fa-fire" style="color: var(--error);"></i>
          <span style="font-weight: 700; color: var(--error); font-size: var(--font-size-sm);">${item.dmgIncRounded}%</span>
        </div>
      </td>
      <td style="text-align: center; padding: var(--spacing-md);">
        ${efficiencyText}
      </td>
      <td style="text-align: center; padding: var(--spacing-md);">
        <div style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-xs);">
          <i class="fa-solid fa-exchange-alt" style="color: var(--secondary);"></i>
          <span style="color: var(--on-surface);">${item.tradeLeft}회</span>
        </div>
      </td>
      <td style="text-align: center; padding: var(--spacing-md);">
        <div style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-xs);">
          <i class="fa-solid fa-coins" style="color: var(--primary);"></i>
          <span style="font-weight: 700; color: var(--primary); font-size: var(--font-size-sm);">${item.buyPrice.toLocaleString()}</span>
        </div>
      </td>
    `;

    // 연마 단계에 따른 색상 표시 (왼쪽 보더)
    row.style.borderLeft = `4px solid ${grindColor}`;
    row.title = `${grindLabel} - 클릭하여 구매`;

    tbody.appendChild(row);
  });

  // 열 정렬 이벤트 추가
  const headers = tableWrapper.querySelectorAll("th[data-sort]");
  headers.forEach(header => {
    header.onclick = () => sortTable(header.dataset.sort, result, input);
  });

  // 전역 변수에 현재 데이터 저장 (정렬 시 사용)
  window.currentTableData = allItems;

  // 초기 정렬 상태 설정 및 헤더 업데이트
  window.currentSort = { column: 'efficiency', direction: 'asc' };
  updateTableHeaders();
}

// 차트 포인트 하이라이트 함수
function highlightChartPoint(grindNum, originalIndex, highlight) {
  if (!window.myChart) return;

  const chart = window.myChart;
  const datasets = chart.data.datasets;
  
  // 모든 포인트를 원래 크기로 복원
  datasets.forEach((dataset, datasetIndex) => {
    if (!dataset.pointRadius) dataset.pointRadius = [];
    if (!dataset.pointBackgroundColor) dataset.pointBackgroundColor = [];
    if (!dataset.pointBorderWidth) dataset.pointBorderWidth = [];
    
    // 기본값으로 복원
    for (let i = 0; i < dataset.data.length; i++) {
      dataset.pointRadius[i] = 4;
      dataset.pointBackgroundColor[i] = dataset.borderColor;
      dataset.pointBorderWidth[i] = 0.5;
    }
  });

  if (highlight) {
    // 해당 포인트 하이라이트
    const datasetIndex = grindNum - (parseInt(window.currentInput?.[2]?.length) || 0);
    
    if (datasets[datasetIndex] && datasets[datasetIndex].data[originalIndex]) {
      datasets[datasetIndex].pointRadius[originalIndex] = 8;
      datasets[datasetIndex].pointBackgroundColor[originalIndex] = "#ff4444";
      datasets[datasetIndex].pointBorderWidth[originalIndex] = 2;
      datasets[datasetIndex].pointBorderColor[originalIndex] = "#ffffff";
    }
  }

  chart.update('none'); // 애니메이션 없이 업데이트
}

// 표 헤더 업데이트 함수
function updateTableHeaders() {
  const headers = document.querySelectorAll("#ranking-table th[data-sort]");
  headers.forEach(header => {
    const sortKey = header.dataset.sort;
    let text = header.textContent.replace(/[▲▼]/g, '').trim();
    
    if (window.currentSort && window.currentSort.column === sortKey) {
      const arrow = window.currentSort.direction === 'desc' ? '▼' : '▲';
      header.innerHTML = `${text} ${arrow}`;
      header.style.background = "#d0d0d0";
    } else {
      header.innerHTML = text;
      header.style.background = "#e0e0e0";
    }
  });
}

// 표 정렬 함수
function sortTable(sortBy, result, input) {
  const allItems = window.currentTableData || [];
  let sortedItems = [...allItems];

  // 현재 정렬 상태 관리
  if (!window.currentSort) {
    window.currentSort = { column: 'efficiency', direction: 'asc' };
  }

  // 같은 열을 클릭하면 방향 토글, 다른 열이면 기본 방향으로
  if (window.currentSort.column === sortBy) {
    window.currentSort.direction = window.currentSort.direction === 'desc' ? 'asc' : 'desc';
  } else {
    window.currentSort.column = sortBy;
    // 골드와 효율성은 기본 오름차순 (낮은 값이 더 좋음)
    window.currentSort.direction = (sortBy === 'gold' || sortBy === 'efficiency') ? 'asc' : 'desc';
  }

  const isDesc = window.currentSort.direction === 'desc';

  switch (sortBy) {
    case "dmg":
      sortedItems.sort((a, b) => isDesc ? 
        parseFloat(b.dmgIncRounded) - parseFloat(a.dmgIncRounded) : 
        parseFloat(a.dmgIncRounded) - parseFloat(b.dmgIncRounded));
      break;
    case "trade":
      sortedItems.sort((a, b) => isDesc ? 
        b.tradeLeft - a.tradeLeft : 
        a.tradeLeft - b.tradeLeft);
      break;
    case "gold":
      sortedItems.sort((a, b) => isDesc ? 
        b.buyPrice - a.buyPrice : 
        a.buyPrice - b.buyPrice);
      break;
    case "efficiency":
      sortedItems.sort((a, b) => {
        // Infinity 값 처리: Infinity는 항상 맨 뒤로
        if (a.goldPer001Percent === Infinity && b.goldPer001Percent === Infinity) return 0;
        if (a.goldPer001Percent === Infinity) return 1;
        if (b.goldPer001Percent === Infinity) return -1;
        
        return isDesc ? 
          b.goldPer001Percent - a.goldPer001Percent : 
          a.goldPer001Percent - b.goldPer001Percent;
      });
      break;
    case "rank":
    default:
      // 기본 정렬 (효율성)
      sortedItems.sort((a, b) => {
        if (a.goldPer001Percent === Infinity && b.goldPer001Percent === Infinity) return 0;
        if (a.goldPer001Percent === Infinity) return 1;
        if (b.goldPer001Percent === Infinity) return -1;
        return a.goldPer001Percent - b.goldPer001Percent;
      });
      window.currentSort = { column: 'efficiency', direction: 'asc' };
      break;
  }

  // 헤더 업데이트
  updateTableHeaders();

  // 테이블 다시 렌더링
  const tbody = document.getElementById("ranking-tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  sortedItems.forEach((item, index) => {
    const row = document.createElement("tr");
    row.className = "lostark-table-row";
    row.style.cursor = "pointer";
    row.style.transition = "all var(--transition-fast)";
    row.dataset.grindNum = item.grindNum;
    row.dataset.originalIndex = item.originalIndex;
    
    row.onmouseenter = () => {
      row.style.background = "rgba(255, 215, 0, 0.08)";
      row.style.transform = "translateX(4px)";
      row.style.boxShadow = "inset 4px 0 0 var(--primary), var(--shadow-sm)";
      highlightChartPoint(item.grindNum, item.originalIndex, true);
    };
    row.onmouseleave = () => {
      row.style.background = "";
      row.style.transform = "";
      row.style.boxShadow = "";
      highlightChartPoint(item.grindNum, item.originalIndex, false);
    };

    // 클릭 시 아이템 구매
    row.onclick = async () => {
      // 비활성화 표시
      row.style.opacity = "0.6";
      row.style.pointerEvents = "none";
      
      try {
        await handleItemPurchase(item, window.currentInput);
      } catch (error) {
        console.error("구매 처리 중 오류:", error);
        alert("구매 처리 중 오류가 발생했습니다.");
      } finally {
        // 원래 상태로 복원
        row.style.opacity = "";
        row.style.pointerEvents = "";
      }
    };

    const grindColors = ["var(--grind-1)", "var(--grind-2)", "var(--grind-3)"];
    const grindColor = grindColors[item.grindNum - 1] || "var(--surface-lighter)";
    const grindLabels = ["1연마", "2연마", "3연마"];
    const grindLabel = grindLabels[item.grindNum - 1] || "";

    const efficiencyText = item.goldPer001Percent === Infinity ? 
      '<span style="color: var(--error); font-weight: 700;">∞</span>' : 
      `<span style="color: var(--info); font-weight: 600;">${item.goldPer001Percent.toLocaleString()}</span>`;

    // 순위에 따른 아이콘
    let rankIcon = "";
    if (index === 0) rankIcon = '<i class="fa-solid fa-crown" style="color: #ffd700; margin-right: var(--spacing-xs);"></i>';
    else if (index === 1) rankIcon = '<i class="fa-solid fa-medal" style="color: #c0c0c0; margin-right: var(--spacing-xs);"></i>';
    else if (index === 2) rankIcon = '<i class="fa-solid fa-award" style="color: #cd7f32; margin-right: var(--spacing-xs);"></i>';

    row.innerHTML = `
      <td style="text-align: center; padding: var(--spacing-md);">
        ${rankIcon}<span style="font-weight: 600; color: var(--on-surface);">${index + 1}</span>
      </td>
      <td style="text-align: center; padding: var(--spacing-md);">
        <div style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-xs);">
          <i class="fa-solid fa-fire" style="color: var(--error);"></i>
          <span style="font-weight: 700; color: var(--error); font-size: var(--font-size-sm);">${item.dmgIncRounded}%</span>
        </div>
      </td>
      <td style="text-align: center; padding: var(--spacing-md);">
        ${efficiencyText}
      </td>
      <td style="text-align: center; padding: var(--spacing-md);">
        <div style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-xs);">
          <i class="fa-solid fa-exchange-alt" style="color: var(--secondary);"></i>
          <span style="color: var(--on-surface);">${item.tradeLeft}회</span>
        </div>
      </td>
      <td style="text-align: center; padding: var(--spacing-md);">
        <div style="display: flex; align-items: center; justify-content: center; gap: var(--spacing-xs);">
          <i class="fa-solid fa-coins" style="color: var(--primary);"></i>
          <span style="font-weight: 700; color: var(--primary); font-size: var(--font-size-sm);">${item.buyPrice.toLocaleString()}</span>
        </div>
      </td>
    `;

    row.style.borderLeft = `4px solid ${grindColor}`;
    row.title = `${grindLabel} - 클릭하여 구매`;
    tbody.appendChild(row);
  });
}

function updateChart(result, input) {
  // 현재 input 정보를 전역에 저장
  window.currentInput = input;
  
  const datasets = makeDataset(result, input);
  const ctx = document.getElementById("scatter-chart").getContext("2d");
  if (window.myChart) window.myChart.destroy();
  window.myChart = new Chart(ctx, {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => getTooltipLabel(result, input, context),
          },
          bodyFont: { size: 14 },
        },
        zoom: {
          pan: { enabled: true, mode: "xy", modifierKey: "ctrl" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "xy",
            onZoomStart: ({ chart, event }) => {
              if (event.altKey) { chart.options.plugins.zoom.zoom.mode = "x"; return true; }
              if (event.shiftKey) { chart.options.plugins.zoom.zoom.mode = "y"; return true; }
              return false;
            },
            onZoomComplete: ({ chart }) => { chart.options.plugins.zoom.zoom.mode = "xy"; },
          },
          limits: { x: { min: 0, max: 1 }, y: { min: 0 } },
        },
      },
      onClick: handleChartClick(result, input),
      scales: {
        x: { title: { display: true, text: "힘민지%", font: { size: 24 } } },
        y: { title: { display: true, text: "골드", font: { size: 24 } } },
      },
    },
  });

  // 표도 함께 업데이트
  createRankingTable(result, input);
  
  // 플로팅 차트 데이터 업데이트
  updateFloatingChart(result, input);
}

// 플로팅 차트 데이터 업데이트
function updateFloatingChart(result, input) {
  // 플로팅 차트 상태 데이터 업데이트
  floatingChartState.originalData = result;
  floatingChartState.originalInput = input;
  
  // 플로팅 차트가 활성화되어 있다면 업데이트
  if (floatingChartState.isFloating && floatingChartState.floatingChart) {
    const datasets = makeDataset(result, input);
    floatingChartState.floatingChart.data.datasets = datasets;
    floatingChartState.floatingChart.update('none'); // 애니메이션 없이 빠른 업데이트
  }
}

// 플로팅 차트 정리 함수
function cleanupFloatingChart() {
  if (floatingChartState.observer) {
    floatingChartState.observer.disconnect();
    floatingChartState.observer = null;
  }
  
  if (floatingChartState.isFloating) {
    deactivateFloatingChart();
  }
  
  floatingChartState = {
    isFloating: false,
    floatingContainer: null,
    floatingChart: null,
    observer: null,
    originalData: null,
    originalInput: null
  };
}

// 페이지 이벤트 리스너 추가
window.addEventListener('beforeunload', cleanupFloatingChart);
window.addEventListener('unload', cleanupFloatingChart);

// 아이템 구매 처리 함수
async function handleItemPurchase(item, input) {
  var btn = document.createElement("button");
  btn.className = "button button--deal-buy";
  btn.textContent = "구매하기";
  btn.dataset.productid = null;
  btn.hidden = true;
  document.querySelector(".content--auction").appendChild(btn);
  
  var grindOptions = item.effects.slice(5);
  const form = {
    itemName: item.name,
    gradeQuality: item.gradeQuality == 100 ? item.gradeQuality : Math.floor(item.gradeQuality / 10) * 10,
    category: category[input[0]],
    grade: item.grade,
    upgrade: item.grindNum,
    enlightenment: item.effects[0]["Value"],
    grindOption1: grindOptions[0] && {
      type: optionFullName[grindOptions[0]["OptionName"] + "+".repeat(!grindOptions[0]["IsPercentage"])],
      grade: grindOptions[0]["IsPercentage"] ? grindOptions[0]["Value"] * 100 : grindOptions[0]["Value"],
    },
    grindOption2: grindOptions[1] && {
      type: optionFullName[grindOptions[1]["OptionName"] + "+".repeat(!grindOptions[1]["IsPercentage"])],
      grade: grindOptions[1]["IsPercentage"] ? grindOptions[1]["Value"] * 100 : grindOptions[1]["Value"],
    },
    grindOption3: grindOptions[2] && {
      type: optionFullName[grindOptions[2]["OptionName"] + "+".repeat(!grindOptions[2]["IsPercentage"])],
      grade: grindOptions[2]["IsPercentage"] ? grindOptions[2]["Value"] * 100 : grindOptions[2]["Value"],
    },
  };
  
  var pageCount = 0;
  var done = false;
  var maxRetries = 5; // 최대 5페이지까지만 검색
  
  while (!done && pageCount < maxRetries) {
    try {
      // 검색 딜레이 추가 (첫 번째 검색 제외)
      if (pageCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY * 1000));
      }
      
      var doc = await trySearchAuction(form, pageCount);
      const id = findItemEqual(doc, item);
      
      if (id) {
        btn.dataset.productid = id;
        btn.click();
        done = true;
        btn.remove();
        break;
      }
      
      pageCount += 1;
    } catch (error) {
      console.log(`구매 처리 중 오류 발생: ${error.message}`);
      
      // ERR_LIMIT_REACHED 처리
      if (error.message === "ERR_LIMIT_REACHED") {
        alert("경매장 검색 제한에 걸렸습니다. 5분 후에 다시 시도해주세요.");
        btn.remove();
        throw error;
      }
      
      // 기타 오류 처리
      if (error.message === "ERR_MAINTENANCE") {
        alert("경매장 점검 중입니다.");
        btn.remove();
        throw error;
      }
      
      if (error.message === "ERR_NO_LOGIN") {
        alert("로그인이 필요합니다.");
        btn.remove();
        throw error;
      }
      
      // 서버 오류나 기타 오류인 경우 재시도
      if (error.message === "ERR_INTERNAL_SERVER") {
        console.log("서버 오류 발생, 3초 후 재시도합니다.");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue; // 재시도
      }
      
      // 알 수 없는 오류
      console.error("알 수 없는 오류:", error);
      btn.remove();
      throw error;
    }
  }
  
  // 최대 재시도 횟수 초과
  if (!done) {
    alert(`아이템을 찾을 수 없습니다. (${maxRetries}페이지 검색 완료)`);
    btn.remove();
  }
}

// 차트 클릭 핸들러 분리
function handleChartClick(result, input) {
  return async (event, elements) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const grindIdx = elements[0].datasetIndex + input[2].length;
      const item = result[grindIdx] && result[grindIdx][index];
      if (!item) return;
      
      await handleItemPurchase(item, input);
    }
  };
}

// 경매장 검색 함수 (오류 처리 포함)
async function trySearchAuction(form, pageNo) {
  let searchResult;
  let failCount = 0;
  
  while (true) {
    try {
      searchResult = await searchAuction(form, pageNo);
      return searchResult;
    } catch (err) {
      failCount += 1;
      console.log(`searchAuction 오류 발생: ${err.message} (시도 ${failCount}회)`);
      
      if (failCount > 3) {
        throw new Error("경매장 검색에 3회 연속 실패했습니다.");
      }
      
      if (err.message === "ERR_LIMIT_REACHED") {
        throw err; // 상위 함수에서 처리하도록 전달
      }
      
      if (err.message === "ERR_INTERNAL_SERVER") {
        console.log("서버 오류 발생, 3초 후 재시도합니다.");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      
      if (err.message === "ERR_MAINTENANCE") {
        throw err;
      }
      
      if (err.message === "ERR_NO_LOGIN") {
        throw err;
      }
      
      // 알 수 없는 오류
      console.error("알 수 없는 오류:", err);
      throw err;
    }
  }
}

async function searchAuction(form, pageNo) {
  const body = new URLSearchParams();
  body.append("request[firstCategory]", 200000);
  body.append("request[secondCategory]", form.category);
  body.append("request[itemName]", form.itemName);
  body.append("request[itemTier]", 4);
  body.append("request[gradeQuality]", form.gradeQuality);
  body.append("request[itemGrade]", form.grade ?? "");
  body.append("request[itemLevelMin]", 0);
  body.append("request[itemLevelMax]", 1700);
  body.append("request[upgradeLevel]", form.upgrade);
  body.append("request[etcOptionList][0][firstOption]", 8);
  body.append("request[etcOptionList][0][secondOption]", 1);
  body.append("request[etcOptionList][0][minValue]", form.enlightenment ?? "");
  body.append("request[etcOptionList][0][maxValue]", form.enlightenment ?? "");
  body.append("request[etcOptionList][1][firstOption]", 7);
  body.append(
    "request[etcOptionList][1][secondOption]",
    form.grindOption1?.type ?? ""
  );
  body.append(
    "request[etcOptionList][1][minValue]",
    form.grindOption1?.grade ?? ""
  );
  body.append(
    "request[etcOptionList][1][maxValue]",
    form.grindOption1?.grade ?? ""
  );
  body.append("request[etcOptionList][2][firstOption]", 7);
  body.append(
    "request[etcOptionList][2][secondOption]",
    form.grindOption2?.type ?? ""
  );
  body.append(
    "request[etcOptionList][2][minValue]",
    form.grindOption2?.grade ?? ""
  );
  body.append(
    "request[etcOptionList][2][maxValue]",
    form.grindOption2?.grade ?? ""
  );
  body.append("request[etcOptionList][3][firstOption]", 7);
  body.append(
    "request[etcOptionList][3][secondOption]",
    form.grindOption3?.type ?? ""
  );
  body.append(
    "request[etcOptionList][3][minValue]",
    form.grindOption3?.grade ?? ""
  );
  body.append(
    "request[etcOptionList][3][maxValue]",
    form.grindOption3?.grade ?? ""
  );
  body.append("request[pageNo]", pageNo);
  body.append("request[sortOption][Sort]", "BUY_PRICE");
  body.append("request[sortOption][IsDesc]", false);

  return fetch("https://lostark.game.onstove.com/Auction", {
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: body,
    method: "POST",
  })
    .then((res) => {
      if (res.status === 500) {
        throw new Error("ERR_INTERNAL_SERVER");
      }
      return res.text();
    })
    .then((html) => {
      if (html.includes("서비스 점검 중입니다.")) {
        throw new Error("ERR_MAINTENANCE");
      }
      const parser = new DOMParser();
      return parser.parseFromString(html, "text/html");
    })
    .then((document) => {
      if (document.querySelector("#idLogin")) {
        throw new Error("ERR_NO_LOGIN");
      }
      if (document.querySelector("#auctionListTbody > tr.empty")) {
        if (
          document
            .querySelector("#auctionListTbody > tr.empty")
            .innerText.trim() ===
          "경매장 연속 검색으로 인해 검색 이용이 최대 5분간 제한되었습니다."
        ) {
          throw new Error("ERR_LIMIT_REACHED");
        }
        return document;
      }
      return document;
    });
}

function findItemEqual(document, item) {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    .map((index) => {
      const row = document.querySelector(
        `#auctionListTbody > tr:nth-child(${index})`
      );
      if (!row) {
        return false;
      }
      const priceEl = row.querySelector(`td:nth-child(6) > div > em`);
      const nameEl = row.querySelector(`td:nth-child(1) > div.grade > span.name`);
      const statEl = row.querySelector(`td:nth-child(1)>div.grade>span`);
      const countEl = row.querySelector(`td:nth-child(1) > div.grade > span.count`);
      const btnEl = row.querySelector("td:nth-child(7) > button");
      if (!priceEl || !nameEl || !statEl || !countEl || !btnEl) {
        return false;
      }
      const buyPrice = parseFloat(priceEl.innerText.trim().replace(/,/g, ""));
      const name = nameEl.innerText.trim();
      const stat = parseInt(
        JSON.parse(statEl.dataset.item).Element_005.value.Element_001.match(
          /힘 \+(\d+)<BR>민첩 \+\1<BR>지능 \+\1/
        )[1]
      );
      const tradeLeftStr = countEl.innerText.trim();
      const tradeLeft =
        tradeLeftStr === "[구매 후 거래 불가]"
          ? 0
          : parseInt(tradeLeftStr.split("거래 ")[1].split("회")[0], 10);
      const id = btnEl.getAttribute("data-productid");
      return id &&
        buyPrice == item.buyPrice &&
        name == item.name &&
        stat == item.effects[2]["Value"] &&
        tradeLeft == item.tradeLeft
        ? id
        : false;
    })
    .filter((x) => !!x)[0];
}

(function waitForFormAndInject() {
  const form = document.querySelector("form");
  if (!form) {
    requestAnimationFrame(waitForFormAndInject);
    return;
  }

  // 모던 디자인 시스템 CSS 추가
  const designSystem = document.createElement('style');
  designSystem.textContent = `
    /* 디자인 시스템 CSS 변수 */
    :root {
             /* 색상 팔레트 - 로스트아크 테마 */
       --primary: #ffd700;
       --primary-dark: #ffb300;
       --primary-light: rgba(255, 215, 0, 0.1);
       --secondary: #00bcd4;
       --secondary-dark: #0097a7;
       --accent: #ff6b35;
      
      /* 표면 색상 (다크 테마) */
      --surface: #1a1a1a;
      --surface-light: #2d2d2d;
      --surface-lighter: #404040;
      --on-surface: #ffffff;
      --on-surface-variant: #b0b0b0;
      
      /* 연마 단계별 색상 (더 명확하게) */
      --grind-1: #42a5f5;
      --grind-2: #ff7043;
      --grind-3: #ab47bc;
      --grind-1-light: rgba(66, 165, 245, 0.1);
      --grind-2-light: rgba(255, 112, 67, 0.1);
      --grind-3-light: rgba(171, 71, 188, 0.1);
      
      /* 시맨틱 색상 */
      --success: #4caf50;
      --warning: #ff9800;
      --error: #f44336;
      --info: #2196f3;
      
      /* 그림자 */
      --shadow-xs: 0 1px 3px rgba(0, 0, 0, 0.12);
      --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.15);
      --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.18);
      --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.22);
      
      /* 간격 */
      --spacing-xs: 4px;
      --spacing-sm: 8px;
      --spacing-md: 12px;
      --spacing-lg: 16px;
      --spacing-xl: 24px;
      --spacing-2xl: 32px;
      
      /* 타이포그래피 */
      --font-size-xs: 0.75rem;
      --font-size-sm: 0.875rem;
      --font-size-base: 1rem;
      --font-size-lg: 1.125rem;
      --font-size-xl: 1.25rem;
      --font-size-2xl: 1.5rem;
      
      /* 보더 반지름 */
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
      
      /* 트랜지션 */
      --transition-fast: 0.15s ease;
      --transition-base: 0.3s ease;
      --transition-slow: 0.5s ease;
    }
    
    /* 기본 컴포넌트 스타일 */
    .lostark-card {
      background: var(--surface-light);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      transition: all var(--transition-base);
      backdrop-filter: blur(10px);
    }
    
    .lostark-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
      border-color: rgba(255, 215, 0, 0.3);
    }
    
         .lostark-button {
       background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
       color: var(--surface);
       border: none;
       border-radius: var(--radius-md);
       padding: var(--spacing-sm) var(--spacing-md);
       font-weight: 600;
       font-size: var(--font-size-base);
       cursor: pointer;
       transition: all var(--transition-fast);
       box-shadow: var(--shadow-sm);
       position: relative;
       overflow: hidden;
       min-height: 42px;
       display: flex;
       align-items: center;
       justify-content: center;
     }
    
    .lostark-button:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }
    
    .lostark-button:active {
      transform: translateY(0);
    }
    
    .lostark-button:disabled {
      background: var(--surface-lighter);
      color: var(--on-surface-variant);
      cursor: not-allowed;
      transform: none;
      box-shadow: var(--shadow-xs);
    }
    
         .lostark-input {
       background: var(--surface);
       border: 2px solid transparent;
       border-radius: var(--radius-md);
       padding: var(--spacing-sm) var(--spacing-md);
       color: var(--on-surface);
       font-size: var(--font-size-base);
       transition: all var(--transition-fast);
       box-shadow: inset var(--shadow-xs);
       min-height: 42px;
       box-sizing: border-box;
     }
    
    .lostark-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.1);
    }
    
         .lostark-select {
       background: var(--surface);
       border: 2px solid transparent;
       border-radius: var(--radius-md);
       padding: var(--spacing-sm) var(--spacing-md);
       color: var(--on-surface);
       font-size: var(--font-size-base);
       cursor: pointer;
       transition: all var(--transition-fast);
       appearance: none;
       background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
       background-position: right var(--spacing-md) center;
       background-repeat: no-repeat;
       background-size: 16px 12px;
       padding-right: calc(var(--spacing-lg) + 20px);
       min-height: 42px;
       box-sizing: border-box;
     }
    
    .lostark-select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.1);
    }
    
    .lostark-badge {
      display: inline-flex;
      align-items: center;
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .lostark-badge--grind-1 {
      background: var(--grind-1-light);
      color: var(--grind-1);
      border: 1px solid var(--grind-1);
    }
    
    .lostark-badge--grind-2 {
      background: var(--grind-2-light);
      color: var(--grind-2);
      border: 1px solid var(--grind-2);
    }
    
    .lostark-badge--grind-3 {
      background: var(--grind-3-light);
      color: var(--grind-3);
      border: 1px solid var(--grind-3);
    }
    
    .lostark-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-md);
    }
    
    .lostark-table th {
      background: var(--surface-lighter);
      color: var(--on-surface);
      font-weight: 600;
      font-size: var(--font-size-sm);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: var(--spacing-lg);
      text-align: left;
      border-bottom: 2px solid var(--primary);
    }
    
    .lostark-table td {
      padding: var(--spacing-md) var(--spacing-lg);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      color: var(--on-surface);
      transition: background-color var(--transition-fast);
    }
    
    .lostark-table tr:hover td {
      background: rgba(255, 215, 0, 0.05);
    }
    
    /* 애니메이션 */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes shimmer {
      0% {
        background-position: -200px 0;
      }
      100% {
        background-position: calc(200px + 100%) 0;
      }
    }
    
    .animate-fade-in {
      animation: fadeInUp 0.5s ease-out;
    }
    
    .loading-shimmer {
      background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.1), transparent);
      background-size: 200px 100%;
      animation: shimmer 1.5s infinite;
    }
    
         /* 스크롤바 스타일링 */
     ::-webkit-scrollbar {
       width: 8px;
       height: 8px;
     }
     
     ::-webkit-scrollbar-track {
       background: var(--surface);
       border-radius: var(--radius-sm);
     }
     
     ::-webkit-scrollbar-thumb {
       background: var(--surface-lighter);
       border-radius: var(--radius-sm);
       transition: background-color var(--transition-fast);
     }
     
     ::-webkit-scrollbar-thumb:hover {
       background: var(--primary);
     }
     
     /* 차트 컨테이너 스타일 */
     .lostark-chart-container {
       gap: var(--spacing-xl);
       flex-direction: column;
     }
     
     /* 차트 영역 스타일 */
     #chart-wrapper {
       width: 100%;
       min-height: 400px;
     }
     
     /* 표 영역 스타일 */
     #table-wrapper {
       width: 100%;
       max-height: 800px;
     }
     
     /* 차트 컨테이너 반응형 */
     @media (max-width: 900px) {
       .lostark-chart-container {
         gap: var(--spacing-lg);
       }
       
       #chart-wrapper {
         min-height: 300px;
         padding: var(--spacing-lg);
       }
       
       #table-wrapper {
         max-height: 600px;
         padding: var(--spacing-lg);
       }
     }
     
     /* 표 헤더 스타일 */
     .lostark-table-header {
       display: flex;
       align-items: center;
       justify-content: center;
       margin-bottom: var(--spacing-lg);
       padding: var(--spacing-md);
       background: linear-gradient(135deg, var(--primary-light), rgba(0, 188, 212, 0.05));
       border-radius: var(--radius-md);
       border: 1px solid rgba(255, 215, 0, 0.2);
     }
     
     /* 표 스타일 확장 */
     .lostark-table {
       font-size: var(--font-size-sm);
       border-radius: var(--radius-md);
       overflow: hidden;
     }
     
     .lostark-table th {
       cursor: pointer;
       user-select: none;
       transition: all var(--transition-fast);
       position: relative;
       font-size: var(--font-size-xs);
       font-weight: 700;
       letter-spacing: 0.5px;
     }
     
     .lostark-table th:hover {
       background: var(--primary);
       color: var(--surface);
       transform: translateY(-1px);
     }
     
     .lostark-table-row {
       transition: all var(--transition-fast);
       border-bottom: 1px solid rgba(255, 255, 255, 0.03);
     }
     
     .lostark-table-row:nth-child(even) {
       background: rgba(255, 255, 255, 0.02);
     }
     
     .lostark-table-row:hover {
       background: rgba(255, 215, 0, 0.08) !important;
     }
     
           /* 캔버스 스타일 */
      #scatter-chart {
        border-radius: var(--radius-md);
        background: var(--surface-light);
      }
      
      /* 플로팅 차트 스타일 */
      .floating-chart-container {
        font-family: inherit;
        user-select: none;
        box-sizing: border-box;
      }
      
      .floating-chart-header {
        background: linear-gradient(90deg, var(--primary), var(--primary-dark)) !important;
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      }
      
      .floating-control-btn {
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      .floating-control-btn:hover {
        transform: scale(1.1) !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
      }
      
      .floating-control-btn:active {
        transform: scale(0.95) !important;
      }
      
      .floating-chart-content {
        background: var(--surface);
        border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      }
      
      /* 플로팅 차트 리사이즈 핸들 스타일링 */
      .floating-chart-container::-webkit-resizer {
        background: linear-gradient(-45deg, transparent 0%, transparent 40%, var(--primary) 50%, transparent 60%, transparent 100%);
        border-radius: 0 0 var(--radius-lg) 0;
      }
      
      /* 플로팅 차트 반응형 */
      @media (max-width: 600px) {
        .floating-chart-container {
          width: calc(100vw - 20px) !important;
          max-width: calc(100vw - 20px) !important;
          left: 10px !important;
          right: 10px !important;
        }
        
        .floating-chart-header {
          padding: var(--spacing-xs) var(--spacing-sm) !important;
          font-size: var(--font-size-xs) !important;
        }
        
        .floating-control-btn {
          width: 20px !important;
          height: 20px !important;
          font-size: 10px !important;
        }
      }
      
      /* 가격 필터 반응형 */
      @media (max-width: 1200px) {
        #price-filter-wrapper {
          flex-wrap: wrap;
          gap: var(--spacing-sm) !important;
        }
        
        #price-filter-wrapper .lostark-button {
          min-width: 75px !important;
          font-size: var(--font-size-xs) !important;
          padding: var(--spacing-sm) var(--spacing-xs) !important;
        }
        
        #max-price-input {
          width: 150px !important;
        }
      }
      
      @media (max-width: 900px) {
        #price-filter-wrapper {
          flex-direction: column;
          align-items: stretch;
          gap: var(--spacing-md);
        }
        
        #price-filter-wrapper > div:first-child {
          text-align: center;
          margin: 0;
        }
        
        #max-price-input {
          width: 100% !important;
        }
        
        #price-filter-wrapper .lostark-button {
          flex: 1;
          min-width: auto !important;
          font-size: var(--font-size-xs) !important;
        }
        
        /* 버튼 그룹들이 균등하게 분배되도록 */
        #price-filter-wrapper > div {
          display: flex !important;
          gap: var(--spacing-xs) !important;
        }
        
        #price-filter-wrapper > div > .lostark-button {
          flex: 1;
        }
      }
     
     /* 버튼 그룹 스타일 */
     .lostark-button-group {
       display: flex;
       border-radius: var(--radius-md);
       overflow: hidden;
       box-shadow: var(--shadow-sm);
       background: var(--surface);
     }
     
     .lostark-button-group .lostark-toggle-button {
       background: var(--surface-light);
       color: var(--on-surface-variant);
       border: none;
       padding: var(--spacing-sm) var(--spacing-md);
       font-size: var(--font-size-sm);
       font-weight: 500;
       cursor: pointer;
       transition: all var(--transition-fast);
       border-right: 1px solid var(--surface-lighter);
       flex: 1;
       text-align: center;
       line-height: 1.2;
     }
     
     .lostark-button-group .lostark-toggle-button:last-child {
       border-right: none;
     }
     
     .lostark-button-group .lostark-toggle-button:hover {
       background: var(--surface-lighter);
       color: var(--on-surface);
     }
     
     .lostark-button-group .lostark-toggle-button.active {
       background: var(--primary);
       color: var(--surface);
       font-weight: 600;
       box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
     }
     
     .lostark-button-group .lostark-toggle-button.active:hover {
       background: var(--primary-dark);
     }
     
     /* 폼 그룹 스타일 */
     .lostark-form-group {
       display: flex;
       flex-direction: column;
       gap: var(--spacing-xs);
     }
     
     .lostark-form-label {
       font-size: var(--font-size-sm);
       font-weight: 600;
       color: var(--on-surface);
       margin-bottom: var(--spacing-xs);
       line-height: 1.2;
     }
     
     /* 옵션 선택 인라인 스타일 */
     .lostark-option-inline {
       display: flex;
       flex-direction: column;
       gap: var(--spacing-lg);
       margin: 0;
       padding: var(--spacing-xl);
       background: linear-gradient(135deg, var(--surface), var(--surface-light));
       border-radius: var(--radius-lg);
       border: 2px solid var(--primary);
       width: 100%;
       max-width: 100%;
       box-sizing: border-box;
       overflow: hidden;
       box-shadow: var(--shadow-lg);
       position: relative;
       contain: layout style;
     }
     
     /* 상단 배치일 때 추가 스타일 */
     #top-option-area .lostark-option-inline {
       background: linear-gradient(135deg, var(--primary-light), var(--surface));
       border: 3px solid var(--primary);
       box-shadow: 0 8px 32px rgba(255, 215, 0, 0.2), var(--shadow-lg);
     }
     
     .lostark-option-inline::before {
       content: '';
       position: absolute;
       top: 0;
       left: 0;
       right: 0;
       height: 4px;
       background: linear-gradient(90deg, var(--primary), var(--secondary), var(--primary));
       border-radius: var(--radius-lg) var(--radius-lg) 0 0;
     }
     
     .lostark-option-header {
       text-align: center;
       font-size: var(--font-size-xl);
       font-weight: 600;
       color: var(--primary);
       display: flex;
       align-items: center;
       justify-content: center;
       gap: var(--spacing-sm);
       margin-bottom: var(--spacing-lg);
       padding: var(--spacing-md);
       border-radius: var(--radius-md);
       background: rgba(255, 215, 0, 0.1);
       border: 1px solid rgba(255, 215, 0, 0.3);
     }
     
     /* 상단 배치에서 헤더 스타일 강화 */
     #top-option-area .lostark-option-header {
       font-size: var(--font-size-2xl);
       font-weight: 700;
       background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(0, 188, 212, 0.1));
       border: 2px solid var(--primary);
       box-shadow: var(--shadow-sm);
       text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
     }
     
     #top-option-area .lostark-option-header i {
       font-size: 1.2em;
       filter: drop-shadow(0 2px 4px rgba(255, 215, 0, 0.5));
     }
     
     .lostark-option-grid {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
       gap: var(--spacing-md);
       width: 100%;
       max-width: 100%;
       overflow: hidden;
     }
     
     /* 데스크톱에서 3컬럼 강제 */
     @media (min-width: 1200px) {
       .lostark-option-grid {
         grid-template-columns: repeat(3, 1fr);
         gap: var(--spacing-xl);
       }
       
       /* 상단 배치에서는 더 넓은 간격 */
       #top-option-area .lostark-option-grid {
         gap: var(--spacing-2xl);
       }
       
       #top-option-area .lostark-option-column {
         padding: var(--spacing-lg);
       }
     }
     
     /* 큰 화면에서 상단 배치 최적화 */
     @media (min-width: 1400px) {
       #top-option-area .lostark-option-grid {
         grid-template-columns: repeat(3, 1fr);
         gap: calc(var(--spacing-2xl) + var(--spacing-lg));
         max-width: 1200px;
         margin: 0 auto;
       }
     }
     
     .lostark-option-column {
       display: flex;
       flex-direction: column;
       gap: var(--spacing-md);
       padding: var(--spacing-md);
       background: var(--surface-light);
       border-radius: var(--radius-md);
       transition: all var(--transition-fast);
       min-height: 180px;
       max-width: 100%;
       overflow: hidden;
       box-sizing: border-box;
     }
     
     .lostark-option-column.selected {
       background: var(--primary-light);
       border: 2px solid var(--primary);
       box-shadow: var(--shadow-md);
     }
     
     .lostark-option-title {
       text-align: center;
       font-weight: 600;
       color: var(--on-surface);
       margin-bottom: var(--spacing-md);
       padding: var(--spacing-sm);
       border-radius: var(--radius-md);
       background: var(--surface);
     }
     
     .lostark-option-buttons {
       display: flex;
       flex-direction: column;
       gap: var(--spacing-sm);
       flex: 1;
     }
     
     .lostark-option-button {
       background: var(--surface);
       color: var(--on-surface-variant);
       border: 1px solid var(--surface-lighter);
       padding: var(--spacing-sm);
       border-radius: var(--radius-md);
       font-size: var(--font-size-xs);
       cursor: pointer;
       transition: all var(--transition-fast);
       text-align: center;
       font-weight: 500;
       min-height: 50px;
       display: flex;
       flex-direction: column;
       align-items: center;
       justify-content: center;
       position: relative;
       overflow: hidden;
       width: 100%;
       box-sizing: border-box;
     }
     
     .lostark-option-button::before {
       content: '';
       position: absolute;
       top: 0;
       left: 0;
       right: 0;
       height: 2px;
       background: var(--primary);
       transform: scaleX(0);
       transition: transform var(--transition-fast);
     }
     
     .lostark-option-button:hover {
       background: var(--surface-lighter);
       color: var(--on-surface);
       transform: translateY(-2px);
       border-color: var(--primary);
       box-shadow: var(--shadow-md);
     }
     
     .lostark-option-button:hover::before {
       transform: scaleX(1);
     }
     
     .lostark-option-button.active {
       background: linear-gradient(135deg, var(--primary), var(--primary-dark));
       color: var(--surface);
       border-color: var(--primary);
       font-weight: 600;
       box-shadow: var(--shadow-lg);
       transform: translateY(-2px);
     }
     
     .lostark-option-button.active::before {
       transform: scaleX(1);
       background: var(--secondary);
     }
     
     .lostark-option-button.active span {
       color: var(--surface) !important;
     }
     
     .lostark-option-button:disabled {
       background: var(--surface-lighter);
       color: var(--on-surface-variant);
       cursor: not-allowed;
       opacity: 0.5;
       transform: none;
     }
     
     .lostark-grade-buttons {
       display: flex;
       gap: var(--spacing-xs);
       margin-top: var(--spacing-sm);
     }
     
     .lostark-grade-button {
       flex: 1;
       background: var(--surface);
       color: var(--on-surface-variant);
       border: 1px solid var(--surface-lighter);
       padding: var(--spacing-xs);
       border-radius: var(--radius-sm);
       font-size: var(--font-size-xs);
       cursor: pointer;
       transition: all var(--transition-fast);
       text-align: center;
       font-weight: 600;
       text-transform: uppercase;
       letter-spacing: 0.5px;
       min-height: 32px;
       display: flex;
       align-items: center;
       justify-content: center;
       position: relative;
       overflow: hidden;
       box-sizing: border-box;
     }
     
     .lostark-grade-button::before {
       content: '';
       position: absolute;
       bottom: 0;
       left: 0;
       right: 0;
       height: 3px;
       transition: height var(--transition-fast);
     }
     
     .lostark-grade-button[data-grade="상"]::before {
       background: linear-gradient(90deg, #ff6b6b, #ee5a24);
     }
     
     .lostark-grade-button[data-grade="중"]::before {
       background: linear-gradient(90deg, #feca57, #ff9ff3);
     }
     
     .lostark-grade-button[data-grade="하"]::before {
       background: linear-gradient(90deg, #48dbfb, #0abde3);
     }
     
     .lostark-grade-button:hover:not(:disabled) {
       background: var(--surface-lighter);
       color: var(--on-surface);
       transform: translateY(-1px);
       box-shadow: var(--shadow-sm);
     }
     
     .lostark-grade-button:hover:not(:disabled)::before {
       height: 6px;
     }
     
     .lostark-grade-button.active {
       color: var(--surface);
       border-width: 3px;
       font-weight: 800;
       transform: translateY(-2px);
       box-shadow: var(--shadow-md);
     }
     
     .lostark-grade-button.active[data-grade="상"] {
       background: linear-gradient(135deg, #ff6b6b, #ee5a24);
       border-color: #ee5a24;
     }
     
     .lostark-grade-button.active[data-grade="중"] {
       background: linear-gradient(135deg, #feca57, #ff9ff3);
       border-color: #ff9ff3;
     }
     
     .lostark-grade-button.active[data-grade="하"] {
       background: linear-gradient(135deg, #48dbfb, #0abde3);
       border-color: #0abde3;
     }
     
     .lostark-grade-button.active::before {
       height: 100%;
       opacity: 0.1;
     }
     
     .lostark-grade-button:disabled {
       background: var(--surface-lighter);
       color: var(--on-surface-variant);
       cursor: not-allowed;
       opacity: 0.3;
       transform: none;
     }
     
     .lostark-grade-button:disabled::before {
       height: 0;
     }
     
     /* 반응형 옵션 그리드 */
     @media (max-width: 900px) {
       .lostark-option-grid {
         grid-template-columns: 1fr !important;
         gap: var(--spacing-sm);
       }
       
       .lostark-option-inline {
         padding: var(--spacing-md);
         margin: 0;
       }
       
       .lostark-option-column {
         padding: var(--spacing-sm);
         min-height: auto;
       }
       
       .lostark-option-button {
         min-height: 45px;
         padding: var(--spacing-xs);
       }
       
       .lostark-grade-button {
         min-height: 28px;
         padding: var(--spacing-xs);
       }
       
       /* 상단 배치 모바일 최적화 */
       #top-option-area .lostark-option-inline {
         padding: var(--spacing-lg);
         border-width: 2px;
       }
       
       #top-option-area .lostark-option-header {
         font-size: var(--font-size-xl);
         padding: var(--spacing-sm);
       }
     }
     
     @media (max-width: 1200px) and (min-width: 901px) {
       .lostark-option-grid {
         grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important;
         gap: var(--spacing-sm);
       }
       
       .lostark-option-column {
         padding: var(--spacing-sm);
       }
       
       .lostark-option-button {
         min-height: 48px;
         font-size: var(--font-size-xs);
       }
     }
     
     /* 메인 폼 반응형 */
     @media (max-width: 1000px) {
       .lostark-card:has(.lostark-form-group) {
         padding: var(--spacing-md);
       }
       
       .lostark-form-group {
         gap: var(--spacing-xs);
       }
       
       .lostark-button-group .lostark-toggle-button {
         padding: var(--spacing-xs) var(--spacing-sm);
         font-size: var(--font-size-xs);
       }
     }
     
     @media (max-width: 600px) {
       .lostark-card:has(.lostark-form-group) {
         padding: var(--spacing-sm);
         gap: var(--spacing-sm);
       }
       
       .lostark-form-label {
         font-size: var(--font-size-xs);
         margin-bottom: var(--spacing-xs);
       }
       
       .lostark-button-group .lostark-toggle-button {
         padding: var(--spacing-xs);
         font-size: var(--font-size-xs);
       }
     }
   `;
   document.head.appendChild(designSystem);

  // 퀵 메뉴(aside) 제거 함수
  function removeQuickMenu() {
    const asideElement = document.querySelector('.aside');
    if (asideElement) {
      asideElement.remove();
      console.log('퀵 메뉴가 제거되었습니다.');
      return true;
    }
    return false;
  }

  // 즉시 실행
  if (!removeQuickMenu()) {
    // 없다면 DOM이 완전히 로드될 때까지 기다렸다가 재시도
    document.addEventListener('DOMContentLoaded', removeQuickMenu);
    // 또는 일정 시간 후 재시도
    setTimeout(removeQuickMenu, 1000);
  }

  // CSS로도 숨기기 (더 확실하게)
  const style = document.createElement('style');
  style.textContent = `
    .aside {
      display: none !important;
      visibility: hidden !important;
    }
  `;
  document.head.appendChild(style);

  // 도움말(Help) 아이콘 및 팝오버 생성
  const helpWrapper = document.createElement("div");
  helpWrapper.style.position = "fixed";
  helpWrapper.style.bottom = "var(--spacing-xl)";
  helpWrapper.style.right = "var(--spacing-xl)";
  helpWrapper.style.zIndex = "2000";

  const helpIcon = document.createElement("div");
  helpIcon.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
  helpIcon.className = "lostark-button";
  helpIcon.style.width = "56px";
  helpIcon.style.height = "56px";
  helpIcon.style.borderRadius = "50%";
  helpIcon.style.display = "flex";
  helpIcon.style.alignItems = "center";
  helpIcon.style.justifyContent = "center";
  helpIcon.style.fontSize = "var(--font-size-xl)";
  helpIcon.style.boxShadow = "var(--shadow-lg)";
  helpIcon.title = "도움말 보기";

  // 팝오버(툴팁) 내용
  const helpPopover = document.createElement("div");
  helpPopover.className = "lostark-card";
  helpPopover.style.display = "none";
  helpPopover.style.position = "absolute";
  helpPopover.style.bottom = "70px";
  helpPopover.style.right = "0";
  helpPopover.style.padding = "var(--spacing-xl)";
  helpPopover.style.fontSize = "var(--font-size-sm)";
  helpPopover.style.lineHeight = "1.6";
  helpPopover.style.minWidth = "320px";
  helpPopover.style.maxWidth = "400px";
  helpPopover.style.zIndex = "2001";
  helpPopover.style.animation = "fadeInUp 0.3s ease-out";
  helpPopover.innerHTML = `
    <h3 style="margin: 0 0 var(--spacing-lg) 0; color: var(--primary); font-size: var(--font-size-lg);">
      <i class="fa-solid fa-gem" style="margin-right: var(--spacing-sm);"></i>
      JangSinGu-SsalMukGi 도움말
    </h3>
    <ul style="padding-left: var(--spacing-lg); margin: 0; color: var(--on-surface);">
      <li style="margin-bottom: var(--spacing-sm);">
        <strong style="color: var(--primary);">특정등급필터</strong>: 
        <code style="background: var(--surface); padding: 2px 6px; border-radius: var(--radius-sm); color: var(--accent);">상중</code> 
        입력시, 해당 등급 조합으로 검색
      </li>
      <li style="margin-bottom: var(--spacing-sm);">
        <strong style="color: var(--primary);">특정옵션필터</strong>: 옵션을 직접 선택하여 검색
      </li>
      <li style="margin-bottom: var(--spacing-sm);">
        <strong style="color: var(--primary);">히스토리</strong>: 이전 검색을 클릭해 결과를 다시 볼 수 있음
      </li>
      <li style="margin-bottom: var(--spacing-sm);">
        <strong style="color: var(--primary);">차트</strong>: 점 클릭 시 해당 아이템 구매창 이동
      </li>
      <li style="margin-bottom: var(--spacing-sm);">
        <strong style="color: var(--primary);">가격 필터</strong>: 최대 가격 입력 후 적용 버튼 클릭
      </li>
      <li style="margin-bottom: var(--spacing-sm);">
        <strong style="color: var(--primary);">연마단계</strong>: 검색 후 그래프위에 연마단계를 누르면 제외할 수 있음
      </li>
    </ul>
    <div style="text-align: right; margin-top: var(--spacing-lg);">
      <button id="help-close-btn" type="button" class="lostark-button" style="font-size: var(--font-size-sm); padding: var(--spacing-sm) var(--spacing-md);">
        <i class="fa-solid fa-times" style="margin-right: var(--spacing-xs);"></i>
        닫기
      </button>
    </div>
  `;

  helpIcon.onclick = () => {
    helpPopover.style.display = helpPopover.style.display === "none" ? "block" : "none";
  };
  helpPopover.querySelector("#help-close-btn").onclick = () => {
    helpPopover.style.display = "none";
  };

  helpWrapper.appendChild(helpIcon);
  helpWrapper.appendChild(helpPopover);

  // body에 부착 (fixed)
  document.body.appendChild(helpWrapper);
 
   // form에 상대적으로 배치
   form.style.position = "relative";
   form.appendChild(helpWrapper);

  // form이 발견되면 실행
  const container = document.createElement("div");
  container.className = "lostark-card animate-fade-in";
  container.style.marginBottom = "var(--spacing-xl)";
  container.style.padding = "var(--spacing-lg)";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "var(--spacing-lg)";

  // 옵션 선택 영역 (위쪽에 배치)
  const topOptionArea = document.createElement("div");
  topOptionArea.id = "top-option-area";
  topOptionArea.style.width = "100%";
  topOptionArea.style.display = "none"; // 초기에는 숨김
  topOptionArea.style.opacity = "0";
  topOptionArea.style.transform = "translateY(-20px)";
  topOptionArea.style.transition = "all var(--transition-base)";
  container.appendChild(topOptionArea);

  // 메인 폼 래퍼
  const mainFormWrapper = document.createElement("div");
  mainFormWrapper.style.display = "flex";
  mainFormWrapper.style.flexDirection = "column";
  mainFormWrapper.style.gap = "var(--spacing-md)";

  const inlineWrapper = document.createElement("div");
  inlineWrapper.style.display = "grid";
  inlineWrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(180px, 1fr))";
  inlineWrapper.style.gap = "var(--spacing-md)";
  inlineWrapper.style.alignItems = "end";
  inlineWrapper.style.maxWidth = "100%";

  // 이벤트 처리 함수들 미리 정의
  let typeButtonGroup, gradeButtonGroup, modeButtonGroup;
  
  // 모드 변경 이벤트 처리 함수
  function handleModeChange(mode) {
    // 두 영역 모두 초기화
    inputAreaWrapper.innerHTML = "";
    topOptionArea.innerHTML = "";
    
    if (mode === "특정등급필터") {
      // 기본 레이아웃 - 하단 영역 사용
      topOptionArea.style.opacity = "0";
      topOptionArea.style.transform = "translateY(-20px)";
      setTimeout(() => {
        topOptionArea.style.display = "none";
      }, 300);
      
      // inputAreaWrapper 표시
      inputAreaWrapper.style.display = "grid";
      inputAreaWrapper.innerHTML = "";
      inputAreaWrapper.appendChild(textInputGroup);
      inputAreaWrapper.appendChild(checkboxGroup);
    } else {
      // 옵션 선택 모드 - 상단 영역에 배치
      topOptionArea.style.display = "block";
      
      // inputAreaWrapper 숨기기
      inputAreaWrapper.style.display = "none";
      
      optionButtonsWrapper = createOptionInline(optionFullName, typeButtonGroup.getValue(), (names, grades) => {
        selectedOptionNames = names;
        selectedOptionGrades = grades;
      });
      
      // 옵션 선택을 상단 영역에 배치
      topOptionArea.appendChild(optionButtonsWrapper);
      
      // 애니메이션으로 나타나기
      setTimeout(() => {
        topOptionArea.style.opacity = "1";
        topOptionArea.style.transform = "translateY(0)";
      }, 50);
    }
  }

  // 타입 변경 이벤트 처리 함수
  function handleTypeChange(type) {
    if (modeButtonGroup.getValue() === "특정옵션필터") {
      topOptionArea.innerHTML = ""; // 상단 영역 초기화
      
      optionButtonsWrapper = createOptionInline(optionFullName, type, (names, grades) => {
        selectedOptionNames = names;
        selectedOptionGrades = grades;
      });
      
      // 옵션 선택을 상단 영역에 배치
      topOptionArea.appendChild(optionButtonsWrapper);
    }
  }

  // 장신구 타입 버튼 그룹
  const typeGroup = document.createElement("div");
  typeGroup.className = "lostark-form-group";
  const typeLabel = document.createElement("div");
  typeLabel.className = "lostark-form-label";
  typeLabel.textContent = "장신구 타입";
  typeGroup.appendChild(typeLabel);
  typeButtonGroup = createButtonGroup(["목걸이", "귀걸이", "반지"], "목걸이", handleTypeChange);
  typeGroup.appendChild(typeButtonGroup);

  // 등급 버튼 그룹
  const gradeGroup = document.createElement("div");
  gradeGroup.className = "lostark-form-group";
  const gradeLabel = document.createElement("div");
  gradeLabel.className = "lostark-form-label";
  gradeLabel.textContent = "등급";
  gradeGroup.appendChild(gradeLabel);
  gradeButtonGroup = createButtonGroup(["고대", "유물"], "고대");
  gradeGroup.appendChild(gradeButtonGroup);

  // 모드 선택 버튼 그룹
  const modeGroup = document.createElement("div");
  modeGroup.className = "lostark-form-group";
  const modeLabel = document.createElement("div");
  modeLabel.className = "lostark-form-label";
  modeLabel.textContent = "검색 모드";
  modeGroup.appendChild(modeLabel);
  modeButtonGroup = createButtonGroup(["특정등급필터", "특정옵션필터"], "특정등급필터", handleModeChange);
  modeGroup.appendChild(modeButtonGroup);

  // 연마옵션 입력 그룹
  const textInputGroup = document.createElement("div");
  textInputGroup.className = "lostark-form-group";
  const textInputLabel = document.createElement("div");
  textInputLabel.className = "lostark-form-label";
  textInputLabel.textContent = "연마옵션";
  textInputGroup.appendChild(textInputLabel);
  
  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.placeholder = "연마옵션 (ex.상중)";
  textInput.className = "lostark-input";
  textInput.setAttribute("autocomplete", "off");
  textInput.style.minHeight = "42px";
  textInput.style.padding = "var(--spacing-sm) var(--spacing-md)";
  textInputGroup.appendChild(textInput);

  const optionCheckbox = document.createElement("input");
  optionCheckbox.type = "checkbox";
  optionCheckbox.id = "myCheckbox";
  optionCheckbox.checked = true;
  optionCheckbox.style.margin = "0";

  const checkboxLabel = document.createElement("label");
  checkboxLabel.textContent = "깡공/깡무공 고려";
  checkboxLabel.setAttribute("for", "myCheckbox");

  // 체크박스 그룹
  const checkboxGroup = document.createElement("div");
  checkboxGroup.className = "lostark-form-group";
  const checkboxGroupLabel = document.createElement("div");
  checkboxGroupLabel.className = "lostark-form-label";
  checkboxGroupLabel.textContent = "추가 옵션";
  checkboxGroup.appendChild(checkboxGroupLabel);
  
  // 스타일 통일을 위해 감싸는 div
  const checkboxWrapper = document.createElement("div");
  checkboxWrapper.className = "lostark-card";
  checkboxWrapper.style.display = "flex";
  checkboxWrapper.style.alignItems = "center";
  checkboxWrapper.style.gap = "var(--spacing-sm)";
  checkboxWrapper.style.padding = "var(--spacing-sm)";
  checkboxWrapper.style.cursor = "pointer";
  checkboxWrapper.style.transition = "all var(--transition-fast)";
  checkboxWrapper.style.minHeight = "42px";
  checkboxWrapper.appendChild(checkboxLabel);
  checkboxWrapper.appendChild(optionCheckbox);
  
  // 체크박스 스타일링
  optionCheckbox.style.accentColor = "var(--primary)";
  optionCheckbox.style.transform = "scale(1.2)";
  checkboxLabel.style.color = "var(--on-surface)";
  checkboxLabel.style.fontSize = "var(--font-size-sm)";
  checkboxLabel.style.fontWeight = "500";
  
  checkboxGroup.appendChild(checkboxWrapper);

  let optionButtonsWrapper = null;
  let selectedOptionNames = [];
  let selectedOptionGrades = [];

  const submitInput = document.createElement("input");
  submitInput.type = "submit";
  submitInput.value = "실행";
  submitInput.className = "lostark-button";
  submitInput.style.minWidth = "100%";
  submitInput.style.fontWeight = "600";
  submitInput.style.textTransform = "uppercase";
  submitInput.style.letterSpacing = "0.5px";
  submitInput.style.padding = "var(--spacing-md)";
  submitInput.style.fontSize = "var(--font-size-base)";

  submitInput.addEventListener("click", (e) => {
    e.preventDefault();
    const type = typeButtonGroup.getValue();
    const grade = gradeButtonGroup.getValue();
    const mode = modeButtonGroup.getValue();
    const longText = longTextInput.value;
    const checkboxState = optionCheckbox.checked;
    if (mode === "특정등급필터") {
      const shortText = textInput.value;
      handleInputs(
        type,
        grade,
        mode,
        shortText,
        checkboxState,
        null,
        longText,
        submitInput
      );
    } else {
      handleInputs(type, grade, mode, null, null, [
        selectedOptionNames[0] || "",
        selectedOptionGrades[0] || "",
        selectedOptionNames[1] || "",
        selectedOptionGrades[1] || "",
        selectedOptionNames[2] || "",
        selectedOptionGrades[2] || ""
      ], longText, submitInput);
    }
  });

  // DOM 구성 (나중에 inlineWrapper에서 일괄 처리됨)

  // 하단 입력 영역 (특정등급필터용)
  const inputAreaWrapper = document.createElement("div");
  inputAreaWrapper.style.display = "grid";
  inputAreaWrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(180px, 1fr))";
  inputAreaWrapper.style.gap = "var(--spacing-md)";
  inputAreaWrapper.style.width = "100%";
  inputAreaWrapper.appendChild(textInputGroup); // 초기값은 textInputGroup
  inputAreaWrapper.appendChild(checkboxGroup);

  // 실행 버튼 그룹 생성
  const submitGroup = document.createElement("div");
  submitGroup.className = "lostark-form-group";
  const submitLabel = document.createElement("div");
  submitLabel.className = "lostark-form-label";
  submitLabel.textContent = "실행";
  submitGroup.appendChild(submitLabel);
  submitGroup.appendChild(submitInput);

  // 메인 폼 구성 (그리드에 모든 요소 포함)
  inlineWrapper.appendChild(typeGroup);
  inlineWrapper.appendChild(gradeGroup);
  inlineWrapper.appendChild(modeGroup);
  inlineWrapper.appendChild(submitGroup);
  
  mainFormWrapper.appendChild(inlineWrapper);
  mainFormWrapper.appendChild(inputAreaWrapper);
  container.appendChild(mainFormWrapper);



  // API 키 입력 카드
  const apiKeyCard = document.createElement("div");
  apiKeyCard.className = "lostark-card animate-fade-in";
  apiKeyCard.style.marginTop = "var(--spacing-lg)";
  apiKeyCard.style.padding = "var(--spacing-lg)";

  const apiKeyTitle = document.createElement("h3");
  apiKeyTitle.textContent = "API 키 설정";
  apiKeyTitle.style.margin = "0 0 var(--spacing-lg) 0";
  apiKeyTitle.style.color = "var(--on-surface)";
  apiKeyTitle.style.fontSize = "var(--font-size-lg)";
  apiKeyTitle.style.fontWeight = "600";
  apiKeyCard.appendChild(apiKeyTitle);

  const longInputWrapper = document.createElement("div");
  longInputWrapper.style.display = "flex";
  longInputWrapper.style.gap = "var(--spacing-md)";
  longInputWrapper.style.alignItems = "center";
  longInputWrapper.style.position = "relative";
  longInputWrapper.style.width = "100%";

  const longTextInput = document.createElement("input");
  longTextInput.type = "password";
  longTextInput.placeholder = "Lost Ark API Key를 입력하세요";
  longTextInput.className = "lostark-input";
  longTextInput.style.flex = "1";
  longTextInput.style.paddingRight = "calc(var(--spacing-xl) + 2.5rem)"; // 아이콘과 저장버튼을 위한 여백
  longTextInput.style.minHeight = "42px";
  longTextInput.setAttribute("autocomplete", "off");

  const faLink = document.createElement("link");
  faLink.rel = "stylesheet";
  faLink.href =
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css";
  document.head.appendChild(faLink);

  const toggleIcon = document.createElement("i");
  toggleIcon.className = "fa-solid fa-eye-slash";
  toggleIcon.style.position = "absolute";
  toggleIcon.style.top = "50%";
  toggleIcon.style.right = "calc(100px + var(--spacing-lg))"; // 저장 버튼 너비 + 간격
  toggleIcon.style.transform = "translateY(-50%)";
  toggleIcon.style.cursor = "pointer";
  toggleIcon.style.color = "var(--on-surface-variant)";
  toggleIcon.style.fontSize = "var(--font-size-lg)";
  toggleIcon.style.transition = "color var(--transition-fast)";
  toggleIcon.style.zIndex = "10";

  toggleIcon.addEventListener("click", () => {
    const isPassword = longTextInput.type === "password";
    longTextInput.type = isPassword ? "text" : "password";
    toggleIcon.className = isPassword
      ? "fa-solid fa-eye-slash"
      : "fa-solid fa-eye";
  });

  toggleIcon.addEventListener("mouseenter", () => {
    toggleIcon.style.color = "var(--primary)";
  });

  toggleIcon.addEventListener("mouseleave", () => {
    toggleIcon.style.color = "var(--on-surface-variant)";
  });

  // 저장 버튼 (input으로 변경)
  const saveButton = document.createElement("input");
  saveButton.type = "button";
  saveButton.value = "저장";
  saveButton.className = "lostark-button";
  saveButton.style.minWidth = "100px";
  saveButton.style.background = "var(--secondary)";
  saveButton.style.fontSize = "var(--font-size-sm)";
  saveButton.style.minHeight = "42px";

  saveButton.addEventListener("click", () => {
    localStorage.setItem("myLongInput", longTextInput.value);
    alert("저장되었습니다!");
  });

  // 저장된 값이 있다면 불러오기
  const saved = localStorage.getItem("myLongInput");
  if (saved) {
    longTextInput.value = saved;
  }

  longInputWrapper.appendChild(longTextInput);
  longInputWrapper.appendChild(toggleIcon);
  longInputWrapper.appendChild(saveButton);
  
  apiKeyCard.appendChild(longInputWrapper);
  
  form.insertBefore(container, form.firstChild);
  form.insertBefore(apiKeyCard, container.nextSibling);

  function handleInputs(
    type,
    grade,
    mode,
    shortText,
    checkbox,
    options,
    longText,
    submitBtn
  ) {
    const input = [];
    const apikey = longText;
    var optionResult = [];
    let result;
    if (mode == "특정등급필터") {
      input.push(type, grade, shortText);
      console.log(input);
      console.log("타입:", type);
      console.log("등급:", grade);
      console.log("짧은 입력:", shortText);
      console.log("체크박스:", checkbox);
      console.log("긴 입력:", longText);
    } else {
      input.push(type, grade, options[1] + options[3] + options[5]);
      optionResult.push(
        [options[0], options[2], options[4]].map(
          (optionName) => reduceOptionName[optionName]
        )
      );
      console.log(input);
      console.log("타입:", type);
      console.log("등급:", grade);
      console.log("옵션:", options);
      console.log("긴 입력:", longText);
    }
    const btn = document.getElementById("copyBtn");
    if (btn) {
      btn.remove();
    }
    getSearchResult(input, apikey, optionResult, checkbox, submitBtn).then(
      (res) => {
        console.log("[!] 검색 결과:", res);
        result = res;
        // 히스토리 추가
        let label = `[${input[0]}][${input[1]}]`;
        if (optionResult && optionResult.length && optionResult[0]) {
          // 특정옵션필터일 때는 options 원본을 중복 없이 join
          if (mode === "특정옵션필터" && options) {
            // 전체 options에서 undefined/빈값/중복 제거
            const filtered = options.filter((v, i, arr) => v && arr.indexOf(v) === i);
            label += ` 옵션:${filtered.join(",")}`;
          } else {
            label += ` 옵션:${optionResult[0].join(",")}`;
          }
        } else if (input[2]) {
          label += ` 등급:${input[2]}`;
        }
        searchHistory.push({
          label,
          input: JSON.parse(JSON.stringify(input)),
          result: res.map((arr) => arr.slice()),
        });
        // 새 히스토리 추가 시 선택 인덱스를 마지막으로 이동
        window.selectedHistoryIdx = searchHistory.length - 1;
        renderHistoryUI();
        createChartAndOpenImage(res, input);
        submitBtn.value = "실행";
      }
    );
  }
})();
