/**
 * PLAYER.JS - LÔ TÔ ĐẠI CÁT
 * Quản lý logic chọn vé, dò số (Thủ công/Tự động) và Real-time Firebase
 */

// --- 1. BIẾN TRẠNG THÁI (STATE) ---
let currentRoomId = null;
let playerId = null;
let playerName = "";
let myTickets = []; // Danh sách vé người chơi đã chọn
let currentSheet = []; // Bộ 6 vé đang hiển thị để chọn
let selectedIndices = new Set(); // Vị trí các vé được chọn (0-5)
let myMaxTickets = 6; // Mặc định
let isAutoMode = false;
let serverNumbers = []; // Danh sách số nhà cái đã xổ
let myMarkedNumbers = new Set(); // Các số người chơi đã click (dành cho chế độ thủ công)

// Định nghĩa 6 tông màu cho 6 vé khác nhau
const TICKET_THEMES = [
    { name: 'Hồng', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', numColor: 'text-rose-700', dot: 'bg-rose-300' },
    { name: 'Xanh Lá', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', numColor: 'text-emerald-700', dot: 'bg-emerald-300' },
    { name: 'Xanh Dương', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', numColor: 'text-blue-700', dot: 'bg-blue-300' },
    { name: 'Tím', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', numColor: 'text-purple-700', dot: 'bg-purple-300' },
    { name: 'Cam', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', numColor: 'text-orange-700', dot: 'bg-orange-300' },
    { name: 'Ngọc', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', numColor: 'text-cyan-700', dot: 'bg-cyan-300' },
];

// Danh sách các màu nền tươi sáng cho ô trống (phong cách vé giấy)
const TICKET_COLORS = [
    '#FF6B6B', // Đỏ san hô
    '#4ECDC4', // Xanh ngọc
    '#45B7D1', // Xanh dương dịu
    '#96CEB4', // Xanh lá pastel
    '#FFEEAD', // Vàng kem
    '#D4A5A5', // Hồng đất nhạt
    '#9B59B6', // Tím nhẹ
    '#F39C12'  // Cam nghệ
];

let currentEmptyColor = TICKET_COLORS[0]; // Màu mặc định


// --- 2. XỬ LÝ VÀO PHÒNG & CHỌN VÉ ---

// Hàm xử lý khi bấm nút "VÀO PHÒNG"
function handleJoinRoom() {
    playerName = document.getElementById('input-name').value.trim();
    currentRoomId = document.getElementById('input-room').value.trim();

    if (!playerName || !currentRoomId) return showToast("Vui lòng nhập đủ tên và mã phòng!");

    db.ref(`rooms/${currentRoomId}`).once('value', (snapshot) => {
        if (!snapshot.exists()) return showToast("Phòng không tồn tại!");

        const playerRef = db.ref(`rooms/${currentRoomId}/players`).push();
        playerId = playerRef.key;
        
        // KHỞI TẠO VỚI 0 VÉ
        playerRef.set({
            name: playerName,
            maxTickets: 0, 
            tickets: [],
            status: 'WAITING_FOR_HOST' // Trạng thái chờ cấp phép
        });

        playerRef.on('value', (pSnapshot) => {
            const data = pSnapshot.val();
            if (data) {
                myMaxTickets = data.maxTickets || 0;
                document.getElementById('max-ticket-display').innerText = myMaxTickets;
                
                // HIỂN THỊ TRẠNG THÁI DỰA TRÊN HẠN MỨC
                const waitOverlay = document.getElementById('selection-waiting-overlay');
                if (myMaxTickets > 0) {
                    waitOverlay.classList.add('hidden'); // Được phép chọn vé
                } else {
                    waitOverlay.classList.remove('hidden'); // Phải chờ
                }
            }
        });

        document.getElementById('screen-join').classList.add('hidden');
        document.getElementById('screen-selection').classList.remove('hidden');
        renderNewSheet();
    });
}

function confirmTickets() {
    if (selectedIndices.size === 0) return showToast("Chọn ít nhất 1 vé đi bạn ơi!");

    myTickets = Array.from(selectedIndices).map(idx => currentSheet[idx]);

    // Tạo ID người chơi và lưu lên Firebase
    const playerRef = db.ref(`rooms/${currentRoomId}/players`).push();
    playerId = playerRef.key; // Gán ID thật tại đây
    
    playerRef.set({
        name: playerName,
        tickets: myTickets,
        maxTickets: myMaxTickets // Lưu hạn mức hiện tại
	status: 'READY'
    });

    // BẮT ĐẦU LẮNG NGHE HẠN MỨC TỪ HOST (Di chuyển vào đây để có playerId)
    db.ref(`rooms/${currentRoomId}/players/${playerId}`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.maxTickets) {
            myMaxTickets = data.maxTickets;
            const display = document.getElementById('max-ticket-display');
            if(display) display.innerText = myMaxTickets;
            
            if (selectedIndices.size > myMaxTickets) {
                selectedIndices.clear();
                renderNewSheet();
                showToast(`Nhà cái đã đổi hạn mức còn ${myMaxTickets} vé!`);
            }
        }
    });

    // Chuyển màn hình
    document.getElementById('screen-selection').classList.add('hidden');
    document.getElementById('screen-game').classList.remove('hidden');

    // QUAN TRỌNG: Vẽ vé ngay lập tức để không bị trắng màn hình
    renderMyGameTickets();
    startListeningToFirebase();
}

// Cập nhật logic click chọn vé
function toggleSelectTicket(idx, ticketDiv) {
    if (selectedIndices.has(idx)) {
        selectedIndices.delete(idx);
        ticketDiv.classList.remove('selected');
    } else {
        // Kiểm tra với hạn mức từ Host
        if (selectedIndices.size >= myMaxTickets) {
            return showToast(`Bạn chỉ được chọn tối đa ${myMaxTickets} vé!`);
        }
        selectedIndices.add(idx);
        ticketDiv.classList.add('selected');
    }
}

// Tạo bộ 6 vé mới cho người dùng chọn
function renderNewSheet() {
    currentSheet = generateLotoSheet();
    selectedIndices.clear();
    currentEmptyColor = TICKET_COLORS[Math.floor(Math.random() * TICKET_COLORS.length)];
    
    const container = document.getElementById('sheet-container');
    container.innerHTML = '';

    currentSheet.forEach((ticket, idx) => {
        const ticketDiv = document.createElement('div');
        ticketDiv.id = `select-ticket-${idx}`;
        // Class mini-ticket-box sẽ được định nghĩa lại trong CSS
        ticketDiv.className = `mini-ticket-box cursor-pointer shadow-xl overflow-hidden`;
        
        ticketDiv.onclick = () => {
            if (selectedIndices.has(idx)) {
                selectedIndices.delete(idx);
                ticketDiv.classList.remove('selected');
            } else {
                if (selectedIndices.size >= myMaxTickets) return showToast(`Bạn chỉ được chọn tối đa ${myMaxTickets} vé!`);
                selectedIndices.add(idx);
                ticketDiv.classList.add('selected');
            }
        };

        ticketDiv.innerHTML = `
            <div class="bg-red-700 text-yellow-300 py-1.5 px-4 text-center font-black text-[10px] uppercase tracking-widest border-b border-black">
                Mã Vé #${idx + 1}
            </div>
            <div class="p-3 bg-white">
                ${renderMiniTable(ticket)}
            </div>
        `;
        container.appendChild(ticketDiv);
    });
}

// --- 3. LOGIC TRONG TRẬN ĐẤU ---

function startListeningToFirebase() {
    // 1. Lắng nghe lịch sử số đã xổ
    db.ref(`rooms/${currentRoomId}/history`).on('value', (snapshot) => {
        const data = snapshot.val();
        serverNumbers = data ? data : [];
        
        // Nếu bật chế độ tự động, tự động đánh dấu số
        if (isAutoMode) {
            serverNumbers.forEach(n => myMarkedNumbers.add(n));
        }

        updateGameUI();
        // Rung điện thoại khi có số mới (nếu trình duyệt hỗ trợ)
        if (window.navigator.vibrate) window.navigator.vibrate(200);
    });

    // Thay thế đoạn lắng nghe node Winner cũ bằng đoạn này trong player.js
db.ref(`rooms/${currentRoomId}/winner`).on('value', (snapshot) => {
    const winnerData = snapshot.val();
    const modal = document.getElementById('announcement-modal');
    const msg = document.getElementById('announce-msg');
    const title = document.getElementById('announce-title');
    const icon = document.getElementById('announce-icon');
    const closeBtn = document.getElementById('btn-close-announce');

    if (winnerData) {
        modal.classList.remove('hidden');
        
        if (winnerData.isVerified === true) {
            // --- 1. TRƯỜNG HỢP: THẮNG THẬT (ĐÃ XÁC NHẬN) ---
            icon.innerText = "👑";
            title.innerText = "THẮNG CUỘC!";
            title.className = "text-3xl font-sigmar text-green-600 mb-2 animate-bounce";
            msg.innerHTML = `
                <span class="text-xl text-red-600 font-bold">${winnerData.name.toUpperCase()}</span><br>
                <span class="text-sm text-slate-500 italic">Đã trúng bộ số: ${winnerData.winningRow.join(' - ')}</span>
            `;
            closeBtn.classList.remove('hidden'); // Hiện nút đóng để người dùng tự tắt
            
        } else if (winnerData.isRejected === true) {
            // --- 2. TRƯỜNG HỢP: BỊ TỪ CHỐI (KINH TRỄ / KINH SAI) ---
            icon.innerText = "❌";
            title.innerText = winnerData.reason || "TỪ CHỐI!"; // Hiện "KINH TRỄ!" hoặc "KINH SAI!"
            title.className = "text-3xl font-sigmar text-orange-600 mb-2";
            msg.innerHTML = `
                <span class="font-bold text-red-600">${winnerData.name}</span> báo không hợp lệ.<br>
                <span class="text-slate-500 uppercase text-[10px] font-bold">Ván chơi vẫn tiếp tục!</span>
            `;
            closeBtn.classList.add('hidden'); // Không hiện nút, Nhà cái sẽ tự xoá sau 2s

        } else {
            // --- 3. TRƯỜNG HỢP: ĐANG CHỜ KIỂM TRA ---
            icon.innerText = "🔔";
            title.innerText = "ĐANG HÔ KINH!";
            title.className = "text-3xl font-sigmar text-red-600 mb-2 animate-pulse";
            msg.innerText = `${winnerData.name} đang hô Kinh... Chờ Nhà cái kiểm tra số!`;
            closeBtn.classList.add('hidden');
        }
    } else {
        // --- 4. TRƯỜNG HỢP: NODE BỊ XOÁ (KẾT THÚC QUY TRÌNH KIỂM VÉ) ---
        // Chỉ ẩn modal nếu nó không phải là modal đang hiện người thắng cuộc (isVerified)
        // Điều này giúp người thắng vẫn thấy bảng chúc mừng cho đến khi họ tự đóng.
        if (!modal.classList.contains('hidden') && title.innerText !== "THẮNG CUỘC!") {
            modal.classList.add('hidden');
        }
    }
});
}

function closeAnnounce() {
    document.getElementById('announcement-modal').classList.add('hidden');
}

// Cập nhật toàn bộ giao diện chơi game
function updateGameUI() {
    // 1. Chỉ cập nhật số to vừa xổ
    const currentNum = serverNumbers[serverNumbers.length - 1] || "--";
    const currentNumDisplay = document.getElementById('display-current-num');
    
    // Tạo hiệu ứng nhảy số nếu số mới khác số cũ
    if (currentNumDisplay.innerText !== currentNum.toString()) {
        currentNumDisplay.innerText = currentNum;
        currentNumDisplay.classList.remove('ball-pop');
        void currentNumDisplay.offsetWidth; // Force reflow để chạy lại animation
        currentNumDisplay.classList.add('ball-pop');
    }
}

    // 2. Vẽ lại các vé của tôi
function renderMyGameTickets() {
    const container = document.getElementById('my-game-tickets');
    if (!container) return;
    container.innerHTML = '';

    if (!myTickets || myTickets.length === 0) return;

    // Tự động nhảy bố cục
    if (myTickets.length < 4) {
        container.className = "flex-1 overflow-y-auto px-4 py-2 grid grid-cols-1 gap-6 no-scrollbar min-h-0 justify-items-center items-start";
    } else {
        container.className = "flex-1 overflow-y-auto px-4 py-2 grid grid-cols-1 md:grid-cols-2 gap-4 no-scrollbar min-h-0 items-start";
    }

    const activeNumbers = isAutoMode ? new Set(serverNumbers) : myMarkedNumbers;
    const serverSet = new Set(serverNumbers);
    const emptyColor = (typeof currentEmptyColor !== 'undefined') ? currentEmptyColor : '#FFCCCC';

    myTickets.forEach((ticket, tIdx) => {
        const ticketCard = document.createElement('div');
        ticketCard.className = "bg-white border-2 border-red-800 shadow-2xl rounded-2xl overflow-hidden w-full max-w-2xl self-start";
        
        let rowsHtml = '';
        ticket.forEach((row) => {
            rowsHtml += `<div class="grid grid-cols-9 h-10 md:h-12 border-b border-black relative">`; // Viền đen
            row.forEach(num => {
                const isMarked = num !== 0 && activeNumbers.has(num);
                const isMissed = num !== 0 && !isMarked && serverSet.has(num);
                const cellBg = num === 0 ? emptyColor : '#FFFFFF';

                rowsHtml += `
                    <div class="flex items-center justify-center border-r border-black cursor-pointer relative" 
                         style="background-color: ${cellBg}"
                         onclick="handleCellClick(${num})">
                        ${num !== 0 ? `
                            <div class="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-black text-sm md:text-xl transition-all duration-300
                                ${isMarked ? 'bg-red-600 text-white scale-110 shadow-lg' : 'text-black'}
                                ${isMissed && !isAutoMode ? 'missed-pulse' : ''}
                            ">
                                ${num}
                            </div>
                        ` : ''}
                    </div>`;
            });
            rowsHtml += `</div>`;
        });

        ticketCard.innerHTML = `
            <div class="bg-red-800 text-yellow-300 py-1.5 px-4 flex justify-between items-center font-black uppercase text-[10px] border-b border-black">
                <span>VÉ #${tIdx + 1}</span>
                <span class="text-white/40 text-[7px]">${isAutoMode ? 'AUTO' : 'MANUAL'}</span>
            </div>
            <div>${rowsHtml}</div>
        `;
        container.appendChild(ticketCard);
    });
}

// Xử lý khi người chơi tự click vào số trên vé
function handleCellClick(num) {
    if (isAutoMode) return; // Nếu bật auto thì ko cần click tay

    if (serverNumbers.includes(num)) {
        if (myMarkedNumbers.has(num)) {
            myMarkedNumbers.delete(num);
        } else {
            myMarkedNumbers.add(num);
        }
        renderMyGameTickets();
    } else {
        showToast("Số này nhà cái chưa kêu nha!");
    }
}

// Bật tắt chế độ Tự động/Thủ công
function toggleAutoMode() {
    isAutoMode = document.getElementById('auto-toggle').checked;
    const label = document.getElementById('mode-label');
    
    if (isAutoMode) {
        label.innerText = "Chế độ: Dò Tự Động";
        label.classList.replace('text-yellow-500', 'text-green-400');
        serverNumbers.forEach(n => myMarkedNumbers.add(n));
    } else {
        label.innerText = "Chế độ: Dò Thủ Công";
        label.classList.replace('text-green-400', 'text-yellow-500');
    }
    renderMyGameTickets();
}

// Hàm hô KINH !!!
function callKinh() {
    // checkWin() là hàm từ loto-logic.js (đối soát vé người chơi với serverNumbers)
    const result = checkWin(myTickets, serverNumbers);

    if (result.isWin) {
        // 2. Gửi bằng chứng trúng thưởng lên Firebase
        db.ref(`rooms/${currentRoomId}/winner`).set({
            name: playerName,
            playerId: playerId,
            winningRow: result.winningRow, // Gửi 5 số trúng để Host kiểm tra
            ticketIndex: result.ticketIndex,
            rowIndex: result.rowIndex,
	    isVerified: false, // Trạng thái chờ Host duyệt
            timestamp: Date.now()
        });
        showToast("🔥 BẠN ĐÃ KINH! HÃY CHỜ NHÀ CÁI GIÁM ĐỊNH... 🔥");
    } else {
        showToast("⚠️ Chưa đủ số đâu! Kiểm tra kỹ lại các hàng ngang nha.");
    }
}

// --- 4. HÀM HỖ TRỢ (HELPERS) ---

function renderMiniTable(ticket) {
    // Đường kẻ đen (border-black) và ô trống có màu
    let html = '<div class="grid grid-cols-9 gap-0 border-[1px] border-black overflow-hidden rounded-sm">';
    ticket.forEach(row => {
        row.forEach(num => {
            const bgColor = num === 0 ? currentEmptyColor : '#FFFFFF';
            const textColor = num === 0 ? 'transparent' : '#000000';
            
            html += `
                <div class="h-8 md:h-8 flex items-center justify-center text-xs md:text-sm font-black border-[0.5px] border-black" 
                     style="background-color: ${bgColor}; color: ${textColor};">
                    ${num === 0 ? '' : num}
                </div>`;
        });
    });
    html += '</div>';
    return html;
}

function showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}