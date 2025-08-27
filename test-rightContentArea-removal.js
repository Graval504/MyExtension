/**
 * CGV Right Content Area 제거 테스트 함수
 * 브라우저 콘솔에서 실행하여 즉시 테스트 가능
 */

function testRightContentAreaRemoval() {
    console.log('🧪 CGV Right Content Area 제거 테스트 시작');
    
    // 1. 현재 존재하는 요소 찾기
    console.log('\n📋 1단계: 현재 상태 확인');
    
    const elements1 = document.querySelectorAll('[class*="mets01390_rightContentArea__"]');
    const elements2 = document.querySelectorAll('.mets01390_rightContentArea__gfYhZ');
    
    console.log(`- [class*="mets01390_rightContentArea__"] 선택자로 찾은 요소: ${elements1.length}개`);
    console.log(`- .mets01390_rightContentArea__gfYhZ 선택자로 찾은 요소: ${elements2.length}개`);
    
    if (elements1.length > 0) {
        elements1.forEach((el, idx) => {
            console.log(`  ${idx + 1}. 클래스: ${el.className}`);
            console.log(`     내용 미리보기: ${el.textContent.substring(0, 50)}...`);
        });
    }
    
    // 2. CSS 주입으로 숨기기
    console.log('\n🎨 2단계: CSS 주입으로 숨기기');
    
    const existingStyle = document.getElementById('test-rightContentArea-css');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    const css = `
        div[class*="mets01390_rightContentArea__"] {
            display: none !important;
            visibility: hidden !important;
        }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'test-rightContentArea-css';
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
    
    console.log('✅ CSS 주입 완료');
    
    // 3. DOM에서 완전 제거
    console.log('\n🗑️ 3단계: DOM에서 완전 제거');
    
    const elementsToRemove = document.querySelectorAll('[class*="mets01390_rightContentArea__"]');
    let removedCount = 0;
    
    elementsToRemove.forEach(element => {
        try {
            console.log(`제거 중: ${element.className}`);
            element.remove();
            removedCount++;
        } catch (error) {
            console.log(`제거 실패: ${error.message}`);
        }
    });
    
    console.log(`✅ ${removedCount}개 요소 DOM에서 제거 완료`);
    
    // 4. 결과 확인
    console.log('\n✨ 4단계: 제거 결과 확인');
    
    const remainingElements = document.querySelectorAll('[class*="mets01390_rightContentArea__"]');
    console.log(`남은 요소: ${remainingElements.length}개`);
    
    if (remainingElements.length === 0) {
        console.log('🎉 모든 rightContentArea 요소가 성공적으로 제거되었습니다!');
    } else {
        console.log('⚠️ 일부 요소가 여전히 남아있습니다.');
        remainingElements.forEach((el, idx) => {
            console.log(`  ${idx + 1}. ${el.className}`);
        });
    }
    
    return {
        initialCount: elements1.length,
        removedCount: removedCount,
        remainingCount: remainingElements.length,
        success: remainingElements.length === 0
    };
}

// 더 강력한 제거 함수
function forceRemoveRightContentArea() {
    console.log('💪 강제 제거 시작');
    
    // 모든 가능한 선택자 시도
    const selectors = [
        '[class*="mets01390_rightContentArea__"]',
        '[class^="mets01390_rightContentArea__"]',
        '.mets01390_rightContentArea__gfYhZ',
        'div[class*="rightContentArea"]'
    ];
    
    let totalRemoved = 0;
    
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`${selector}: ${elements.length}개 발견`);
        
        elements.forEach(element => {
            // 1. 스타일로 숨김
            element.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
            
            // 2. 클래스 제거
            element.className = '';
            
            // 3. 내용 제거
            element.innerHTML = '';
            
            // 4. DOM에서 제거
            if (element.parentNode) {
                element.parentNode.removeChild(element);
                totalRemoved++;
            }
        });
    });
    
    console.log(`💥 총 ${totalRemoved}개 요소 강제 제거 완료`);
    return totalRemoved;
}

// 전역으로 함수 노출
window.testRightContentAreaRemoval = testRightContentAreaRemoval;
window.forceRemoveRightContentArea = forceRemoveRightContentArea;

console.log('🔧 테스트 함수 준비 완료:');
console.log('- testRightContentAreaRemoval() : 단계별 테스트');
console.log('- forceRemoveRightContentArea() : 강제 제거');