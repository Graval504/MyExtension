// CGV 좌석선택 이벤트 시스템 (학습용 데모)
// Educational purpose only - CGV-style seat selection events

class CGVSeatManager {
  constructor() {
    this.selectedSeats = new Map();
    this.maxSeats = 4;
    this.seatTypes = {
      normal: { price: 12000, icon: 'seat_normal.svg' },
      prime: { price: 15000, icon: 'seat_prime.svg' },
      gold: { price: 18000, icon: 'seat_gold.svg' },
      couple: { price: 24000, icon: 'seat_couple.svg' },
      fourDX: { price: 22000, icon: 'seat_4dx.svg' }
    };
    
    this.initEventListeners();
  }
  
  // 1. 메인 이벤트 리스너 초기화
  initEventListeners() {
    document.addEventListener('click', (event) => {
      if (this.isSeatElement(event.target)) {
        this.handleSeatClick(event);
      }
    });
    
    // 키보드 접근성 지원
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && this.isSeatElement(event.target)) {
        this.handleSeatClick(event);
      }
    });
  }
  
  // 2. 좌석 요소 판별
  isSeatElement(element) {
    return element.matches('.seatMap_seatNumber__JHck5') ||
           element.classList.contains('seat-selectable');
  }
  
  // 3. 좌석 클릭 메인 핸들러
  handleSeatClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const seatElement = event.target;
    const seatInfo = this.extractSeatInfo(seatElement);
    
    console.log('🎬 좌석 클릭 이벤트:', seatInfo);
    
    // 좌석 상태 검증
    if (!this.validateSeatSelection(seatElement, seatInfo)) {
      return;
    }
    
    // 좌석 선택/해제 토글
    this.toggleSeatSelection(seatElement, seatInfo);
  }
  
  // 4. 좌석 정보 추출
  extractSeatInfo(seatElement) {
    const classList = Array.from(seatElement.classList);
    
    return {
      id: seatElement.id || `seat-${Date.now()}`,
      row: seatElement.dataset.row || this.extractRowFromElement(seatElement),
      col: seatElement.dataset.col || this.extractColFromElement(seatElement),
      seatType: this.getSeatType(classList),
      zone: seatElement.dataset.zone || 'general',
      price: this.getSeatPrice(classList),
      element: seatElement
    };
  }
  
  // 5. 좌석 타입 판별
  getSeatType(classList) {
    if (classList.some(cls => cls.includes('Prime'))) return 'prime';
    if (classList.some(cls => cls.includes('Gold'))) return 'gold';
    if (classList.some(cls => cls.includes('Couple'))) return 'couple';
    if (classList.some(cls => cls.includes('FourDX'))) return 'fourDX';
    return 'normal';
  }
  
  // 6. 좌석 가격 계산
  getSeatPrice(classList) {
    const seatType = this.getSeatType(classList);
    return this.seatTypes[seatType]?.price || 12000;
  }
  
  // 7. 좌석 선택 검증
  validateSeatSelection(seatElement, seatInfo) {
    // 이미 예약된 좌석
    if (seatElement.classList.contains('seatMap_seatComplete__BkqOH')) {
      this.showToast('이미 예약된 좌석입니다.', 'error');
      return false;
    }
    
    // 선택 불가능한 좌석
    if (seatElement.classList.contains('seatMap_seatDisabled__II0B_')) {
      this.showToast('선택할 수 없는 좌석입니다.', 'error');
      return false;
    }
    
    // 최대 선택 가능 좌석 수 체크
    const isSelected = seatElement.classList.contains('seatMap_active__I_XA6');
    if (!isSelected && this.selectedSeats.size >= this.maxSeats) {
      this.showToast(`최대 ${this.maxSeats}개 좌석까지 선택 가능합니다.`, 'warning');
      return false;
    }
    
    return true;
  }
  
  // 8. 좌석 선택/해제 토글
  toggleSeatSelection(seatElement, seatInfo) {
    const isSelected = seatElement.classList.contains('seatMap_active__I_XA6');
    
    if (isSelected) {
      this.deselectSeat(seatElement, seatInfo);
    } else {
      this.selectSeat(seatElement, seatInfo);
    }
  }
  
  // 9. 좌석 선택
  selectSeat(seatElement, seatInfo) {
    console.log('✅ 좌석 선택:', seatInfo);
    
    // DOM 업데이트
    seatElement.classList.add('seatMap_active__I_XA6');
    seatElement.style.backgroundImage = "url('seat_active.svg')";
    seatElement.style.color = '#ffffff';
    
    // 상태 저장
    const seatKey = `${seatInfo.row}-${seatInfo.col}`;
    this.selectedSeats.set(seatKey, {
      ...seatInfo,
      timestamp: Date.now()
    });
    
    // 커스텀 이벤트 발생
    this.dispatchSeatEvent('seat:selected', seatInfo);
    
    // UI 업데이트
    this.updateUI();
    
    this.showToast(`${seatInfo.row}열 ${seatInfo.col}번 좌석이 선택되었습니다.`, 'success');
  }
  
  // 10. 좌석 선택 해제
  deselectSeat(seatElement, seatInfo) {
    console.log('❌ 좌석 선택 해제:', seatInfo);
    
    // DOM 업데이트
    seatElement.classList.remove('seatMap_active__I_XA6');
    seatElement.style.backgroundImage = `url('${this.seatTypes[seatInfo.seatType]?.icon}')`;
    seatElement.style.color = '';
    
    // 상태 제거
    const seatKey = `${seatInfo.row}-${seatInfo.col}`;
    this.selectedSeats.delete(seatKey);
    
    // 커스텀 이벤트 발생
    this.dispatchSeatEvent('seat:deselected', seatInfo);
    
    // UI 업데이트
    this.updateUI();
    
    this.showToast(`${seatInfo.row}열 ${seatInfo.col}번 좌석 선택이 해제되었습니다.`, 'info');
  }
  
  // 11. 커스텀 이벤트 발생
  dispatchSeatEvent(eventType, seatInfo) {
    const eventDetail = {
      seatInfo: seatInfo,
      selectedSeats: Array.from(this.selectedSeats.values()),
      selectedCount: this.selectedSeats.size,
      totalPrice: this.calculateTotalPrice(),
      timestamp: Date.now()
    };
    
    const customEvent = new CustomEvent(eventType, {
      detail: eventDetail,
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(customEvent);
    
    console.log(`📢 이벤트 발생: ${eventType}`, eventDetail);
  }
  
  // 12. 총 가격 계산
  calculateTotalPrice() {
    let total = 0;
    this.selectedSeats.forEach(seat => {
      total += seat.price;
    });
    return total;
  }
  
  // 13. UI 업데이트
  updateUI() {
    this.updateSeatCounter();
    this.updatePriceDisplay();
    this.updateBookingButton();
    this.updateSeatAvailability();
  }
  
  updateSeatCounter() {
    const counter = document.querySelector('.seat-counter');
    if (counter) {
      counter.textContent = `${this.selectedSeats.size}/${this.maxSeats}`;
    }
  }
  
  updatePriceDisplay() {
    const priceDisplay = document.querySelector('.total-price');
    if (priceDisplay) {
      const total = this.calculateTotalPrice();
      priceDisplay.textContent = `${total.toLocaleString()}원`;
    }
  }
  
  updateBookingButton() {
    const bookingBtn = document.querySelector('.booking-button');
    if (bookingBtn) {
      bookingBtn.disabled = this.selectedSeats.size === 0;
      bookingBtn.classList.toggle('enabled', this.selectedSeats.size > 0);
    }
  }
  
  updateSeatAvailability() {
    const isMaxReached = this.selectedSeats.size >= this.maxSeats;
    const availableSeats = document.querySelectorAll('.seat-selectable:not(.seatMap_active__I_XA6)');
    
    availableSeats.forEach(seat => {
      seat.classList.toggle('disabled-temp', isMaxReached);
    });
  }
  
  // 14. 토스트 메시지
  showToast(message, type = 'info') {
    console.log(`🔔 [${type.toUpperCase()}] ${message}`);
    
    // 실제 토스트 UI가 있다면 여기서 표시
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
  
  // 15. 유틸리티 함수들
  extractRowFromElement(element) {
    const text = element.textContent || element.innerText;
    const match = text.match(/([A-Z]+)/);
    return match ? match[1] : 'A';
  }
  
  extractColFromElement(element) {
    const text = element.textContent || element.innerText;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
  }
  
  // 16. 디버그/학습용 메서드
  getSelectedSeatsInfo() {
    return Array.from(this.selectedSeats.values());
  }
  
  resetAllSelections() {
    this.selectedSeats.forEach((seat) => {
      this.deselectSeat(seat.element, seat);
    });
  }
  
  simulateSeatClick(row, col) {
    const seatSelector = `[data-row="${row}"][data-col="${col}"]`;
    const seatElement = document.querySelector(seatSelector);
    
    if (seatElement) {
      this.handleSeatClick({ target: seatElement, preventDefault: () => {}, stopPropagation: () => {} });
    }
  }
}

// 전역 이벤트 리스너들 (학습용)
document.addEventListener('seat:selected', (event) => {
  console.log('🎯 좌석 선택 이벤트 수신:', event.detail);
});

document.addEventListener('seat:deselected', (event) => {
  console.log('🎯 좌석 해제 이벤트 수신:', event.detail);
});

// 초기화
const cgvSeatManager = new CGVSeatManager();

// 전역으로 노출 (디버깅용)
window.CGVSeatManager = cgvSeatManager;

console.log('🎬 CGV 좌석선택 이벤트 시스템 초기화 완료!');
console.log('사용법: window.CGVSeatManager.simulateSeatClick("A", 1)');