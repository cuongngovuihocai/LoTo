/**
 * PLAYER.JS - PHIÊN BẢN LÔ TÔ TẾT ĐẠI CÁT 2026
 * TRẠNG THÁI: FULL VERSION (400+ LINES)
 * TÍNH NĂNG: 
 * - Chống nhân đôi người chơi (Dùng 1 ID duy nhất)
 * - Khống chế số vé tối đa từ Nhà cái (Real-time)
 * - Chế độ Dò Thủ công / Tự động (Manual / Auto)
 * - Hiệu ứng Missed-pulse (Nhắc số khi dò sót)
 * - Tự động tô màu Vàng hàng đủ 5 số
 * - Xử lý thông báo VAR (Kinh trễ / Kinh sai / Thắng cuộc)
 */

// ==========================================
// 1. KHAI BÁO BIẾN TOÀN CỤC (GLOBAL STATES)
// ==========================================
let currentRoomId = null;
let playerId = null;
let playerName = "";
let myTickets = [];           // Chứa dữ liệu 1-6 vé người chơi chọn
let currentSheet = [];        // Chứa bộ 6 vé đang hiển thị ở sảnh chọn
let selectedIndices = new Set(); // Lưu index các vé đang được click chọn (0-5)
let myMaxTickets = 0;         // Hạn mức vé Nhà cái cấp (Mặc định 0 để chờ duyệt)

let isAutoMode = false;       // Trạng thái nút gạt Dò tự động
let serverNumbers = [];       // Danh sách các số Nhà cái đã gọi (Array of Numbers)
let myMarkedNumbers = new Set(); // Danh sách các số người chơi đã click (Set of Numbers)

// Bộ màu sắc rực rỡ cho 6 vé khác nhau
const TICKET_THEMES = [
    { name: 'Hồng', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', numColor: 'text-rose-700', dot: 'bg-rose-300' },
    { name: 'Xanh Lá', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', numColor: 'text-emerald-700', dot: 'bg-emerald-300' },
    { name: 'Xanh Dương', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', numColor: 'text-blue-700', dot: 'bg-blue-300' },
    { name: 'Tím', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', numColor: 'text-purple-700', dot: 'bg-purple-300' },
    { name: 'Cam', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', numColor: 'text-orange-700', dot: 'bg-orange-300' },
    { name: 'Ngọc', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', numColor: 'text-cyan-700', dot: 'bg-cyan-300' },
];

// 8 màu tươi sáng cho ô trống (Empty cells)
const TICKET_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#F39C12'];
let currentEmptyColor = TICKET_COLORS[0];

// ==========================================
// 2. MÀN HÌNH 1 & 2: VÀO PHÒNG & CHỌN VÉ
// ==========================================

/**
 * Xử lý khi người chơi nhập tên và mã phòng
 */
function handleJoinRoom() {
    playerName = document.getElementById('input-name').value.trim();
    currentRoomId = document.getElementById('input-room').value.trim();

    if (!playerName || !currentRoomId) {
        return showToast("Vui lòng nhập đủ tên và mã phòng!");
    }

    // Kiểm tra phòng có tồn tại trên Firebase không
    db.ref(`rooms/${currentRoomId}`).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            return showToast("Phòng này không tồn tại!");
        }

        // TẠO ID DUY NHẤT CHO NGƯỜI CHƠI (Push 1 lần duy nhất)
        const playerRef = db.ref(`rooms/${currentRoomId}/players`).push();
        playerId = playerRef.key; 
        
        // Khởi tạo dữ liệu người chơi ở trạng thái Chờ
        playerRef.set({
            name: playerName,
            maxTickets: 0, 
            tickets: [],
            status: 'WAITING_FOR_HOST'
        });

        // LẮNG NGHE HẠN MỨC VÉ TỪ NHÀ CÁI (Real-time)
        playerRef.on('value', (pSnapshot) => {
            const data = pSnapshot.val();
            if (data) {
                myMaxTickets = data.maxTickets || 0;
                const maxDisplay = document.getElementById('max-ticket-display');
                if (maxDisplay) maxDisplay.innerText = myMaxTickets;
                
                // Ẩn/Hiện lớp phủ chờ Nhà cái phê duyệt
                const waitOverlay = document.getElementById('selection-waiting-overlay');
                if (myMaxTickets > 0) {
                    waitOverlay.classList.add('hidden');
                } else {
                    waitOverlay.classList.remove('hidden');
                }
            }
        });

        // Chuyển từ màn hình Đăng nhập sang màn hình Chọn vé
        document.getElementById('screen-join').classList.add('hidden');
        document.getElementById('screen-selection').classList.remove('hidden');
        
        // Sinh bộ 6 vé đầu tiên
        renderNewSheet();
    });
}

/**
 * Sinh bộ 6 vé mới và hiển thị ở Sảnh chọn
 */
function renderNewSheet() {
    currentSheet = generateLotoSheet(); // Thuật toán từ loto-logic.js
    selectedIndices.clear(); // Xóa các lựa chọn cũ
    
    // Chọn ngẫu nhiên màu cho ô trống của bộ vé này
    currentEmptyColor = TICKET_COLORS[Math.floor(Math.random() * TICKET_COLORS.length)];
    
    const container = document.getElementById('sheet-container');
    container.innerHTML = '';

    currentSheet.forEach((ticket, idx) => {
        const ticketDiv = document.createElement('div');
        ticketDiv.id = `select-ticket-${idx}`;
        ticketDiv.className = `mini-ticket-box cursor-pointer shadow-xl overflow-hidden bg-white rounded-2xl border-2 border-slate-200 transition-all duration-300 hover:scale-105`;
        
        ticketDiv.onclick = () => {
            if (selectedIndices.has(idx)) {
                selectedIndices.delete(idx);
                ticketDiv.classList.remove('selected', 'ring-4', 'ring-yellow-500');
            } else {
                if (selectedIndices.size >= myMaxTickets) {
                    return showToast(`Bạn chỉ được Nhà cái cấp tối đa ${myMaxTickets} vé!`);
                }
                selectedIndices.add(idx);
                ticketDiv.classList.add('selected', 'ring-4', 'ring-yellow-500');
            }
        };

        ticketDiv.innerHTML = `
            <div class="bg-red-700 text-yellow-300 py-2 px-4 text-center font-black text-[11px] uppercase tracking-widest border-b border-black">
                MÃ VÉ #${idx + 1}
            </div>
            <div class="p-4">
                ${renderMiniTable(ticket)}
            </div>
        `;
        container.appendChild(ticketDiv);
    });
}

/**
 * Xác nhận các vé đã chọn và bắt đầu vào trận
 */
function confirmTickets() {
    if (selectedIndices.size === 0) {
        return showToast("Vui lòng chọn ít nhất 1 vé!");
    }

    // Lọc ra danh sách vé người dùng đã chọn
    myTickets = Array.from(selectedIndices).map(idx => currentSheet[idx]);

    // Cập nhật trạng thái READY và danh sách vé lên Firebase (Dùng ID cũ để không bị nhân đôi)
    const playerRef = db.ref(`rooms/${currentRoomId}/players/${playerId}`);
    playerRef.update({
        tickets: myTickets,
        status: 'READY'
    }, (error) => {
        if (error) {
            showToast("Lỗi đồng bộ dữ liệu!");
        } else {
            // Chuyển màn hình
            document.getElementById('screen-selection').classList.add('hidden');
            document.getElementById('screen-game').classList.remove('hidden');

            // Khởi động các hàm lắng nghe Game
            startListeningToFirebase();
            renderMyGameTickets();
        }
    });
}

// ==========================================
// 3. MÀN HÌNH 3: TRONG TRẬN ĐẤU (GAMEPLAY)
// ==========================================

//Lắng nghe toàn bộ thay đổi từ Nhà cái (Số xổ, Người thắng)
/**
 * Lắng nghe toàn bộ thay đổi từ Nhà cái (Số xổ, Người thắng, Reset game)
 */
function startListeningToFirebase() {
    // 1. LẮNG NGHE LỊCH SỬ SỐ TỪ HOST
    db.ref(`rooms/${currentRoomId}/history`).on('value', (snapshot) => {
        try {
            const data = snapshot.val();
            
            // Chuyển đổi dữ liệu an toàn (tránh lỗi null hoặc object)
            let rawList = [];
            if (Array.isArray(data)) {
                rawList = data;
            } else if (data && typeof data === 'object') {
                rawList = Object.values(data);
            }

            // === LOGIC TỰ ĐỘNG VỀ SẢNH CHỌN VÉ KHI RESET ===
            if (rawList.length === 0) {
                const screenGame = document.getElementById('screen-game');
                const screenSelection = document.getElementById('screen-selection');

                // Chỉ thực hiện nếu đang ở màn hình Game (tránh lặp vô tận)
                if (!screenGame.classList.contains('hidden')) {
                    showToast("♻️ VÁN MỚI! MỜI BẠN CHỌN VÉ...");

                    // 1. Reset dữ liệu cục bộ
                    serverNumbers = [];
                    myMarkedNumbers.clear();
                    myTickets = [];
                    selectedIndices.clear();

                    // 2. Chuyển giao diện về Sảnh Chọn Vé
                    screenGame.classList.add('hidden');       // Ẩn bàn cờ
                    screenSelection.classList.remove('hidden'); // Hiện sảnh chọn vé

                    // 3. Reset trạng thái trên Firebase (Để Host thấy đèn chuyển màu đỏ/vàng)
                    db.ref(`rooms/${currentRoomId}/players/${playerId}`).update({
                        status: 'WAITING_FOR_HOST', // Trạng thái chờ chọn vé
                        tickets: []                 // Xóa vé cũ trên server
                    });

                    // 4. Sinh ra bộ vé mới ngẫu nhiên (để người chơi không bị chán vé cũ)
                    renderNewSheet();
                }
            } 
            // === LOGIC ĐANG CHƠI BÌNH THƯỜNG ===
            else {
                // Cập nhật danh sách số từ Server
                serverNumbers = rawList.map(n => Number(n));
                
                // Nếu đang bật Auto -> Tự động đánh dấu số mới
                if (isAutoMode) {
                    serverNumbers.forEach(n => myMarkedNumbers.add(Number(n)));
                }
                
                // Vẽ lại giao diện bàn cờ ngay lập tức
                requestAnimationFrame(() => {
                    updateGameUI();
                    renderMyGameTickets();
                });
                
                // Rung máy báo hiệu số mới (chỉ rung khi có số về, không rung khi reset)
                if (rawList.length > 0 && window.navigator && window.navigator.vibrate) {
                    try { window.navigator.vibrate(200); } catch(e) {}
                }
            }

        } catch (err) {
            console.error("Lỗi đồng bộ:", err);
        }
    });

    // 2. LẮNG NGHE THÔNG BÁO WINNER (TỰ ĐỘNG TẮT KHI HOST RESET)
    db.ref(`rooms/${currentRoomId}/winner`).on('value', (snapshot) => {
        const winnerData = snapshot.val();
        const modal = document.getElementById('announcement-modal');
        
        if (!winnerData) {
            // TRƯỜNG HỢP: NHÀ CÁI ĐÃ XÓA NGƯỜI THẮNG HOẶC RESET GAME
            // Tự động đóng modal ngay lập tức
            if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        } else {
            // TRƯỜNG HỢP: CÓ THÔNG BÁO MỚI (KINH/THẮNG/PHẠT)
            renderWinnerModalLogic(winnerData);
        }
    });
}

// Hàm phụ trợ vẽ Modal (như cũ, tách ra cho gọn code)
function renderWinnerModalLogic(winnerData) {
    const modal = document.getElementById('announcement-modal');
    const msg = document.getElementById('announce-msg');
    const title = document.getElementById('announce-title');
    const icon = document.getElementById('announce-icon');
    const closeBtn = document.getElementById('btn-close-announce');

    modal.classList.remove('hidden');
    
    if (winnerData.isVerified === true) {
        icon.innerText = "👑";
        title.innerText = "THẮNG CUỘC!";
        title.className = "text-3xl font-sigmar text-green-600 mb-2 animate-bounce";
        msg.innerHTML = `<span class="text-xl text-red-600 font-bold">${winnerData.name.toUpperCase()}</span><br><span class="text-[12px] text-slate-500 font-bold">BỘ SỐ: ${winnerData.winningRow.join(' - ')}</span>`;
        closeBtn.classList.remove('hidden'); 
    } else if (winnerData.isRejected === true) {
        icon.innerText = "❌";
        title.innerText = winnerData.reason || "KINH SAI!";
        title.className = "text-3xl font-sigmar text-orange-600 mb-2";
        msg.innerHTML = `Người chơi <span class="font-bold text-red-600">${winnerData.name}</span> báo lỗi.<br><span class="text-slate-500 text-[10px]">Ván chơi tiếp tục...</span>`;
        closeBtn.classList.add('hidden');
    } else {
        icon.innerText = "🔔";
        title.innerText = "ĐANG HÔ KINH!";
        title.className = "text-3xl font-sigmar text-red-600 mb-2 animate-pulse";
        msg.innerText = `${winnerData.name} đang hô Kinh...`;
        closeBtn.classList.add('hidden');
    }
}

// Vẽ lại danh sách vé người chơi đang sở hữu
function renderMyGameTickets() {
    const container = document.getElementById('my-game-tickets');
    if (!container) return;
    
    // Lưu lại vị trí cuộn hiện tại để khi vẽ lại không bị nhảy trang
    const scrollPos = container.scrollTop;
    
    container.innerHTML = '';

    const serverSet = new Set(serverNumbers.map(n => Number(n)));
    
    // FIX: Logic Active Numbers
    // Ở chế độ Auto: Active là tất cả số Server đã gọi
    // Ở chế độ Manual: Active là những số User đã click (myMarkedNumbers)
    const activeNumbers = isAutoMode ? serverSet : myMarkedNumbers;

    myTickets.forEach((ticket, tIdx) => {
        // ... (Phần tạo thẻ div giữ nguyên code cũ) ...
        const ticketCard = document.createElement('div');
        ticketCard.className = "bg-white border-2 border-red-800 shadow-2xl rounded-2xl overflow-hidden w-full max-w-2xl self-start mb-6";
        
        let rowsHtml = '';
        ticket.forEach((row) => {
            const rowNums = row.filter(n => n !== 0).map(n => Number(n));
            const isWinnerRow = rowNums.length > 0 && rowNums.every(n => activeNumbers.has(n));

            rowsHtml += `<div class="grid grid-cols-9 h-12 md:h-14 border-b border-black relative ${isWinnerRow ? 'bg-yellow-100' : ''}">`; 
            
            row.forEach(num => {
                const n = Number(num);
                const isMarked = n !== 0 && activeNumbers.has(n);
                
                // FIX: Logic Missed Pulse (Chỉ hiện ở Manual)
                // Số đã xổ (có trong serverSet) NHƯNG chưa được đánh dấu (chưa có trong myMarkedNumbers)
                const isMissed = n !== 0 && !isAutoMode && serverSet.has(n) && !myMarkedNumbers.has(n);
                
                let cellBg = n === 0 ? currentEmptyColor : '#FFFFFF';
                if (isWinnerRow && n !== 0) cellBg = '#fef08a';

                rowsHtml += `
                    <div class="flex items-center justify-center border-r border-black cursor-pointer relative" 
                         style="background-color: ${cellBg}"
                         onclick="handleCellClick(${n})">
                        ${n !== 0 ? `
                            <div class="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center font-black text-lg md:text-2xl transition-all duration-300
                                ${isMarked ? 'bg-red-600 text-white scale-110 shadow-lg' : 'text-black'}
                                ${isMissed ? 'missed-pulse' : ''} 
                            ">
                                ${n}
                            </div>
                        ` : ''}
                    </div>`;
            });
            rowsHtml += `</div>`;
        });

        ticketCard.innerHTML = `
            <div class="bg-red-800 text-yellow-300 py-2 px-4 flex justify-between items-center font-black uppercase text-[10px] tracking-widest border-b border-black">
                <span>VÉ MAY MẮN #${tIdx + 1}</span>
                <span class="text-white/40 text-[8px]">${isAutoMode ? 'AUTO' : 'MANUAL'}</span>
            </div>
            <div>${rowsHtml}</div>
        `;
        container.appendChild(ticketCard);
    });
    
    // Khôi phục vị trí cuộn
    container.scrollTop = scrollPos;
}

/**
 * Xử lý khi người chơi tự tay click vào một ô số
 */
function handleCellClick(num) {
    if (isAutoMode) return; // Đang Auto thì không cho click tay

    const n = Number(num);
    // Chỉ cho phép đánh dấu nếu số đó đã được Nhà cái xổ
    if (serverNumbers.map(s => Number(s)).includes(n)) {
        if (myMarkedNumbers.has(n)) {
            myMarkedNumbers.delete(n);
        } else {
            myMarkedNumbers.add(n);
        }
        renderMyGameTickets(); // Vẽ lại để cập nhật màu đỏ
    } else {
        showToast("Số này chưa xổ mà bạn ơi!");
    }
}

/**
 * Chuyển đổi qua lại giữa Dò tay và Dò tự động
 */
function toggleAutoMode() {
    isAutoMode = document.getElementById('auto-toggle').checked;
    const label = document.getElementById('mode-label');
    
    if (isAutoMode) {
        label.innerText = "CHẾ ĐỘ: DÒ TỰ ĐỘNG";
        label.classList.replace('text-yellow-500', 'text-green-400');
        // Quét lại toàn bộ số đã xổ để đánh dấu ngay lập tức
        serverNumbers.forEach(n => myMarkedNumbers.add(Number(n)));
    } else {
        label.innerText = "CHẾ ĐỘ: DÒ THỦ CÔNG";
        label.classList.replace('text-green-400', 'text-yellow-500');
    }
    renderMyGameTickets();
}

/**
 * Hàm hô KINH !!! Gửi lệnh lên Nhà cái
 */
function callKinh() {
    // Sử dụng hàm đối soát chuẩn từ loto-logic.js
    const result = checkWin(myTickets, serverNumbers);

    if (result.isWin) {
        // Gửi thông tin chiến thắng lên Firebase để Nhà cái kiểm tra (VAR)
        db.ref(`rooms/${currentRoomId}/winner`).set({
            name: playerName,
            playerId: playerId,
            winningRow: result.winningRow, // Gửi hàng số trúng để Host đối chiếu
            ticketIndex: result.ticketIndex,
            rowIndex: result.rowIndex,
            isVerified: false, 
            timestamp: Date.now()
        });
        showToast("🔥 BẠN ĐÃ KINH! ĐANG CHỜ GIÁM ĐỊNH... 🔥");
    } else {
        showToast("⚠️ Chưa đủ số đâu! Đừng kinh bậy nha.");
    }
}

// ==========================================
// 4. HÀM HỖ TRỢ (UI HELPERS)
// ==========================================

/**
 * Vẽ bảng số nhỏ cho Sảnh chọn vé
 */
function renderMiniTable(ticket) {
    let html = '<div class="grid grid-cols-9 gap-0 border-[1.5px] border-black overflow-hidden rounded-md shadow-inner">';
    ticket.forEach(row => {
        row.forEach(num => {
            const bgColor = num === 0 ? currentEmptyColor : '#FFFFFF';
            const textColor = num === 0 ? 'transparent' : '#000000';
            
            html += `
                <div class="h-8 flex items-center justify-center text-xs font-black border-[0.5px] border-black" 
                     style="background-color: ${bgColor}; color: ${textColor};">
                    ${num === 0 ? '' : num}
                </div>`;
        });
    });
    html += '</div>';
    return html;
}

/**
 * Cập nhật Header: Số to vừa xổ và hiệu ứng nhảy số
 */
function updateGameUI() {
    const currentNum = serverNumbers[serverNumbers.length - 1] || "--";
    const currentNumDisplay = document.getElementById('display-current-num');
    
    if (currentNumDisplay && currentNumDisplay.innerText !== currentNum.toString()) {
        currentNumDisplay.innerText = currentNum;
        currentNumDisplay.classList.remove('ball-pop');
        void currentNumDisplay.offsetWidth; // Thủ thuật restart CSS Animation
        currentNumDisplay.classList.add('ball-pop');
    }
}

/**
 * Hiển thị thông báo nhỏ (Toast)
 */
function showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.innerText = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), duration);
    }
}

/**
 * Đóng Modal thông báo
 */
function closeAnnounce() {
    document.getElementById('announcement-modal').classList.add('hidden');
}

/**
 * Lấy mã phòng từ URL (Nếu có)
 */
function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Hết file player.js