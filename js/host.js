/**
 * HOST.JS - LÔ TÔ TẾT ĐẠI CÁT (FIXED)
 */

let roomId = null;
let allNumbersPool = []; 
let drawnHistory = [];   
let isGameRunning = false;
let isSpinning = false; 
let autoDrawInterval = null;

let startConfirmState = false;
let deleteConfirmState = false;
let resetConfirmState = false;

// Đợi trang web tải xong mới chạy
document.addEventListener('DOMContentLoaded', () => {
    initRoom();
    initBoardUI();
    initCageBalls();
});

function initRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('room');

    if (!roomId) {
        roomId = Math.floor(100000 + Math.random() * 900000).toString();
        db.ref(`rooms/${roomId}`).set({
            status: 'WAITING',
            current_number: 0,
            history: [],
            created_at: Date.now()
        }).then(() => {
            window.history.pushState({}, '', `?room=${roomId}`);
            setupListeners();
        });
    } else {
        setupListeners();
    }
    document.getElementById('display-room-id').innerText = roomId;
}

function setupListeners() {
    db.ref(`rooms/${roomId}/players`).on('value', (snapshot) => {
        renderPlayerList(snapshot.val());
    });

    db.ref(`rooms/${roomId}/winner`).on('value', (snapshot) => {
        const winner = snapshot.val();
        if (winner) handleWinnerFound(winner);
    });
}

function initBoardUI() {
    const board = document.getElementById('loto-board');
    if(!board) return;
    board.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
        const cell = document.createElement('div');
        cell.id = `cell-${i}`;
        cell.className = "number-cell";
        cell.innerText = i;
        board.appendChild(cell);
    }
}

function renderPlayerList(players) {
    const listContainer = document.getElementById('player-list');
    const countDisplay = document.getElementById('player-count');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    if (!players) { 
        countDisplay.innerText = "0"; 
        listContainer.innerHTML = '<p class="text-center text-[10px] text-yellow-900/50 italic py-4">Chưa có khách vào...</p>';
        return; 
    }

    const entries = Object.entries(players); // Biến này tên là entries
    countDisplay.innerText = entries.length;

    entries.forEach(([id, data]) => { // Sửa playerEntries thành entries
        const maxV = data.maxTickets || 0;
        const isApproved = maxV > 0;
        const isReady = data.status === 'READY'; // Kiểm tra xem khách đã chọn vé xong chưa

        const item = document.createElement('div');
        // Trạng thái: Đỏ nhấp nháy (Chưa cấp) -> Đỏ nhạt (Đã cấp nhưng đang chọn) -> Xanh (Đã xong)
        let statusClass = '';
        if (!isApproved) statusClass = 'bg-red-600/20 border-red-500 animate-pulse';
        else if (isReady) statusClass = 'bg-green-900/30 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]';
        else statusClass = 'bg-red-950/20 border-red-900/50';

        item.className = `flex justify-between items-center p-2 rounded-xl border mb-2 transition-all ${statusClass}`;
        
        item.innerHTML = `
            <div class="flex flex-col flex-1">
                <div class="flex items-center gap-2">
                    <!-- Đèn báo trạng thái -->
                    <div class="w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-400 shadow-[0_0_5px_#4ade80]' : 'bg-slate-600'}"></div>
                    <span class="font-bold text-xs ${isApproved ? 'text-green-100' : 'text-red-400'}">${data.name}</span>
                </div>
                <span class="text-[8px] font-bold uppercase mt-0.5 ${isApproved ? 'text-yellow-600' : 'text-red-500'}">
                    ${isApproved ? (isReady ? '✅ ĐÃ CHỐT VÉ' : `Hạn mức: ${maxV} vé`) : '⚠️ CHỜ CẤP VÉ'}
                </span>
            </div>
            
            <div class="flex items-center gap-1 bg-black/40 p-1 rounded-lg ml-2">
                <!-- Nút Giảm Vé (-) -->
                <button onclick="changeMaxTickets('${id}', ${Math.max(0, maxV - 1)})" 
                    class="bg-red-700 hover:bg-red-600 text-white w-6 h-6 rounded border border-red-500 flex items-center justify-center font-bold transition-colors">-</button>
                
                <span class="text-xs font-bold w-5 text-center text-white">${maxV}</span>
                
                <!-- Nút Tăng Vé (+) -->
                <button onclick="changeMaxTickets('${id}', ${Math.min(6, maxV + 1)})" 
                    class="bg-green-700 hover:bg-green-600 text-white w-6 h-6 rounded border border-green-500 flex items-center justify-center font-bold transition-colors">+</button>

                <!-- [MỚI] Nút Đá Người Chơi (x) -->
                <button onclick="kickPlayer('${id}')" 
                    class="ml-1 bg-slate-700 hover:bg-slate-600 text-white w-6 h-6 rounded border border-slate-500 flex items-center justify-center font-bold transition-colors" title="Đuổi khỏi phòng">
                    ✕
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// Hàm gửi lệnh đổi hạn mức lên Firebase
function changeMaxTickets(pId, newVal) {
    if (newVal < 1 || newVal > 6) return; // Giới hạn 1-6 vé
    db.ref(`rooms/${roomId}/players/${pId}`).update({ maxTickets: newVal });
}

// --- NÚT BẮT ĐẦU ---
function handleStartGame() {
    const btn = document.getElementById('btn-start');
    if (!startConfirmState) {
        startConfirmState = true;
        btn.innerText = "🛑 SẴN SÀNG?";
        btn.style.backgroundColor = "#f97316"; // Màu cam
        setTimeout(() => {
            startConfirmState = false;
            btn.innerText = "BẮT ĐẦU";
            btn.style.backgroundColor = "#16a34a"; // Màu xanh gốc
        }, 3000);
    } else {
        startConfirmState = false;
        startGame();
    }
}

// --- NÚT RESET ---
function forceResetGame() {
    const btn = document.getElementById('btn-reset-game');
    if (!resetConfirmState) {
        resetConfirmState = true;
        btn.innerText = "🔄 TẠO VÁN MỚI?";
        btn.classList.add('bg-orange-600', 'animate-pulse');
        setTimeout(() => {
            resetConfirmState = false;
            btn.innerText = "RESET";
            btn.classList.remove('bg-orange-600', 'animate-pulse');
        }, 3000);
    } else {
        resetConfirmState = false;
        // Thực hiện logic Reset
        isGameRunning = false;
        isSpinning = false;
        if (autoDrawInterval) clearInterval(autoDrawInterval);
        document.getElementById('auto-draw-toggle').checked = false;

        db.ref(`rooms/${roomId}`).update({
            status: 'WAITING',
            current_number: 0,
            history: [],
            winner: null
        });

        drawnHistory = [];
        allNumbersPool = [];
        initBoardUI(); 
        document.getElementById('current-num').classList.add('hidden');
        document.getElementById('btn-draw').disabled = true;
        
        const btnStart = document.getElementById('btn-start');
        btnStart.innerText = "BẮT ĐẦU";
        btnStart.disabled = false;
        btnStart.style.backgroundColor = "#16a34a";

        showToast("♻️ Reset thành công!");
    }
}

// --- NÚT XOÁ PHÒNG ---
function handleDeleteRoom() {
    const btn = document.getElementById('btn-delete');
    if (!deleteConfirmState) {
        deleteConfirmState = true;
        btn.innerText = "⚠️ XÁC NHẬN XOÁ?";
        btn.classList.add('bg-red-600', 'text-white', 'animate-pulse');
        setTimeout(() => {
            deleteConfirmState = false;
            btn.innerText = "XOÁ PHÒNG";
            btn.classList.remove('bg-red-600', 'text-white', 'animate-pulse');
        }, 3000);
    } else {
        db.ref(`rooms/${roomId}`).remove().then(() => {
            window.location.href = 'index.html';
        });
    }
}

function startGame() {
    allNumbersPool = Array.from({ length: 90 }, (_, i) => i + 1);
    for (let i = allNumbersPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allNumbersPool[i], allNumbersPool[j]] = [allNumbersPool[j], allNumbersPool[i]];
    }

    drawnHistory = [];
    isGameRunning = true;

    initBoardUI();
    document.getElementById('current-num').classList.add('hidden');
    document.getElementById('btn-draw').disabled = false;
    document.getElementById('btn-start').innerText = "VÁN ĐANG CHẠY";
    document.getElementById('btn-start').disabled = true;

    db.ref(`rooms/${roomId}`).update({
        status: 'PLAYING',
        history: [],
        current_number: 0,
        winner: null
    });

    showToast("✨ VẠN SỰ NHƯ Ý - VÁN MỚI BẮT ĐẦU!");
}

// 1. Tạo bóng với các biến quỹ đạo ngẫu nhiên (CSS Variables)
function initCageBalls() {
    const cage = document.getElementById('cage-balls');
    cage.innerHTML = '';
    const colors = ['#ff4d4d', '#ffdb4d', '#4d94ff', '#4dff88', '#ff944d', '#ffffff', '#ef4444', '#facc15', '#3b82f6', '#22c55e', '#f97316', '#ffffff'];
    
    for (let i = 0; i < 40; i++) {
        const ball = document.createElement('div');
        ball.className = `absolute w-4 h-4 rounded-full border border-black/20 shadow-lg`;
// Tạo hiệu ứng bóng đổ bên trong để quả cầu nhìn 3D hơn
        const color = colors[i % colors.length];
        ball.style.background = `radial-gradient(circle at 30% 30%, ${color}, #000)`;
        
        ball.style.top = `${Math.random() * 65 + 18}%`;
        ball.style.left = `${Math.random() * 75 + 18}%`;
        
        // Gán các biến quỹ đạo ngẫu nhiên
        for(let j=1; j<=4; j++) {
            ball.style.setProperty(`--x${j===1?'':j}`, Math.random() * 80 - 40);
            ball.style.setProperty(`--y${j===1?'':j}`, Math.random() * 80 - 40);
        }
        cage.appendChild(ball);
    }
}

// 2. Quay số với hiệu ứng bóng nhảy loạn xạ
function drawNumber() {
    if (isSpinning || !isGameRunning || allNumbersPool.length === 0) return;

    isSpinning = true;
    const balls = document.querySelectorAll('#cage-balls div');
    const display = document.getElementById('current-num');
    const loading = document.getElementById('draw-loading');

    // Từng quả bóng nhảy theo hướng riêng
    balls.forEach(b => b.classList.add('animate-popcorn'));
    display.classList.add('hidden');
    loading.classList.remove('hidden');

    setTimeout(() => {
        const nextNum = allNumbersPool.pop();
        drawnHistory.push(nextNum);
        db.ref(`rooms/${roomId}`).update({ current_number: nextNum, history: drawnHistory });

        loading.classList.add('hidden');
        display.innerText = nextNum;
        display.classList.remove('hidden');
        display.classList.add('ball-pop');
        
        document.getElementById(`cell-${nextNum}`).classList.add('active');
        updateProgressBar();
        renderRecentNumbers();

        // Ngừng nhảy bóng
        balls.forEach(b => b.classList.remove('animate-popcorn'));
        isSpinning = false;

        if (document.getElementById('voice-toggle').checked) speakNumber(nextNum);
    }, 1200); // Tăng thời gian xáo trộn lên 1.2s cho kịch tính
}

function updateSpeedDisplay() {
    const speed = document.getElementById('speed-range').value;
    document.getElementById('speed-val').innerText = speed + 's';
    if (autoDrawInterval) {
        clearInterval(autoDrawInterval);
        const isAuto = document.getElementById('auto-draw-toggle').checked;
        if(isAuto) toggleAutoDraw(); 
    }
}

function toggleAutoDraw() {
    const isAuto = document.getElementById('auto-draw-toggle').checked;
    const speed = document.getElementById('speed-range').value * 1000; // Đổi sang miligiây

    if (isAuto) {
        if (autoDrawInterval) clearInterval(autoDrawInterval);
        autoDrawInterval = setInterval(() => {
            if (isGameRunning && !isSpinning) drawNumber();
        }, speed);
    } else {
        clearInterval(autoDrawInterval);
        autoDrawInterval = null;
    }
}

function updateProgressBar() {
    const bar = document.getElementById('progress-bar');
    if(bar) bar.innerText = `ĐÃ GỌI: ${drawnHistory.length}/90`;
}

function renderRecentNumbers() {
    const container = document.getElementById('recent-numbers');
    if(!container) return;
    container.innerHTML = drawnHistory.slice(-10).reverse().map(n => `
        <div class="w-10 h-10 bg-yellow-500 text-red-900 rounded-full flex items-center justify-center font-bold shadow-md border-2 border-yellow-200">
            ${n}
        </div>
    `).join('');
}

function speakNumber(num) {
    // 1. Ngừng các âm thanh đang đọc dở để tránh chồng chéo
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance();
    
    // 2. Nội dung đọc: Thêm khoảng nghỉ để rõ ràng hơn
    speech.text = `Số... ${num}`; 
    
    // 3. Lấy danh sách tất cả các giọng đọc có trong máy/trình duyệt
    const voices = window.speechSynthesis.getVoices();

    // 4. Tìm giọng Tiếng Việt (thường có mã 'vi-VN' hoặc tên 'Vietnamese')
    const vietnameseVoice = voices.find(v => 
        v.lang.indexOf('vi-VN') !== -1 || 
        v.name.toLowerCase().indexOf('vietnamese') !== -1
    );

    // 5. Nếu tìm thấy giọng Việt thì áp dụng, nếu không thì ép mã ngôn ngữ
    if (vietnameseVoice) {
        speech.voice = vietnameseVoice;
    } else {
        speech.lang = 'vi-VN';
    }

    // 6. Điều chỉnh tốc độ (0.8 - 0.9 là vừa nghe, không bị quá nhanh)
    speech.rate = 0.85; 
    speech.pitch = 1; // Độ cao của giọng

    // 7. Thực hiện đọc
    window.speechSynthesis.speak(speech);
}

// MẸO: Một số trình duyệt cần "khởi động" danh sách giọng đọc
// Đoạn này giúp nạp danh sách giọng ngay khi vừa mở trang
window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
};

function handleWinnerFound(winner) {
    if (!winner) return;

    // 1. Tạm dừng quay số để trọng tài làm việc
    isGameRunning = false;
    document.getElementById('btn-draw').disabled = true;
    if (autoDrawInterval) {
        clearInterval(autoDrawInterval);
        document.getElementById('auto-draw-toggle').checked = false;
    }

    // 2. LẤY DỮ LIỆU ĐỐI SOÁT
    const serverHistory = drawnHistory; // Mảng các số đã xổ theo thứ tự
    const winningRow = winner.winningRow || []; // 5 số người chơi gửi lên
    const winnerModal = document.getElementById('winner-modal');
    const winnerNameEl = document.getElementById('winner-name');

    // 3. KIỂM TRA TÍNH HỢP LỆ (BẰNG CHỨNG CÓ THẬT KHÔNG?)
    const isLegit = winningRow.every(num => serverHistory.includes(Number(num)));

    if (!isLegit) {
        // TRƯỜNG HỢP 1: KINH LÁO (Có số chưa xổ mà dám báo)
        renderWinnerModal(winnerNameEl, winner, "KINH SAI!", `Người chơi ${winner.name} báo số chưa xổ: ${winningRow.join(', ')}`, "text-red-500");
    } else {
        // 4. KIỂM TRA KINH TRỄ (QUAN TRỌNG)
        // Tìm vị trí của số cuối cùng trong bộ 5 số trúng nằm ở đâu trong lịch sử
        const indices = winningRow.map(num => serverHistory.indexOf(Number(num)));
        const lastNumIndex = Math.max(...indices); // Vị trí của con số "vừa đủ"
        const currentServerIndex = serverHistory.length - 1; // Vị trí của con số vừa xổ xong trên màn hình

        if (lastNumIndex < currentServerIndex - 1) { // Cho phép trễ 1 số
            // TRƯỜNG HỢP 2: KINH TRỄ (Số đủ từ đời nào rồi giờ mới báo)
            const missedNum = serverHistory[lastNumIndex];
            const lateCount = currentServerIndex - lastNumIndex;
            
            renderWinnerModal(winnerNameEl, winner, "KINH TRỄ!", 
                `${winner.name} đã đủ hàng từ số [${missedNum}], nhưng đã để qua thêm ${lateCount} số mới báo. Rất tiếc!`, 
                "text-orange-500");
            
            // Đổi tên nút xác nhận thành "Bỏ qua & Chơi tiếp"
            document.querySelector('#winner-modal button').innerText = "BỎ QUA & CHƠI TIẾP";
        } else {
            // TRƯỜNG HỢP 3: THẮNG HỢP LỆ (Kinh ngay khi số vừa ra)
            renderWinnerModal(winnerNameEl, winner, "THẮNG CUỘC!", 
                `${winner.name} đã Kinh hợp lệ!<br>Bộ số: ${winningRow.join(' - ')}`, 
                "text-green-500");
            
            document.querySelector('#winner-modal button').innerText = "XÁC NHẬN KẾT THÚC";
        }
    }

    winnerModal.classList.remove('hidden');
}

// Hàm phụ để vẽ nội dung Modal cho gọn code
function renderWinnerModal(el, winner, title, desc, colorClass) {
    el.innerHTML = `
        <div class="text-4xl font-sigmar ${colorClass} mb-2">${title}</div>
        <div class="text-white text-2xl font-bold uppercase mb-2">${winner.name}</div>
        <div class="text-sm text-slate-300 font-goldman italic">
            ${desc}
        </div>
    `;
}

function verifyWinner(isValid) {
    // Lấy tiêu đề hiện tại của Modal để biết Host đang xử lý ca Thắng hay ca Trễ
    const modalTitle = document.querySelector('#winner-name .text-4xl').innerText;

    if (isValid && modalTitle === "THẮNG CUỘC!") {
        // Chốt thắng thật
        db.ref(`rooms/${roomId}/winner`).update({ isVerified: true });
        showToast("🧧 ĐÃ XÁC NHẬN NGƯỜI THẮNG!");
        isGameRunning = false;
    } else {
        // TRƯỜNG HỢP KINH SAI HOẶC KINH TRỄ
        // Trước khi xoá node winner, ta cập nhật trạng thái lỗi để người chơi cùng thấy
        db.ref(`rooms/${roomId}/winner`).update({
            isRejected: true,
            reason: modalTitle // "KINH TRỄ!" hoặc "KINH SAI!"
        }).then(() => {
            // Đợi 2 giây cho mọi người đọc tin nhắn rồi mới xoá hẳn node để chơi tiếp
            setTimeout(() => {
                db.ref(`rooms/${roomId}/winner`).remove();
                isGameRunning = true;
                document.getElementById('btn-draw').disabled = false;
		showToast("Ván chơi tiếp tục...");
            }, 2000);
        });
    }
    document.getElementById('winner-modal').classList.add('hidden');
}

function closeWinnerModal() {
    document.getElementById('winner-modal').classList.add('hidden');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    if(msgEl) msgEl.innerText = msg;
    if(toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

// Chức năng Đá người chơi
function kickPlayer(pId) {
    if(confirm("Bạn muốn mời người chơi này ra khỏi phòng?")) {
        db.ref(`rooms/${roomId}/players/${pId}`).remove();
    }
}