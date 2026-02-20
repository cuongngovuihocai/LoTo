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

let isMusicPlaying = false;
let lastSpokenNum = null; // Để tránh máy đọc lặp đi lặp lại một số
let wakeLock = null; // Để quản lý việc giữ màn hình luôn sáng

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
    // GỌI NGAY LẬP TỨC KHI BẤM NÚT
    primeSpeechForIOS(); 

    playerName = document.getElementById('input-name').value.trim();
    currentRoomId = document.getElementById('input-room').value.trim();
    
    // 1. Kiểm tra đầu vào
    if (!playerName || !currentRoomId) return showToast("Vui lòng nhập đủ tên và mã phòng!");

    // 2. Lấy thông tin đã lưu trong bộ nhớ trình duyệt (LocalStorage) để tránh nick ảo
    const savedRoom = localStorage.getItem('loto_room_id');
    const savedId = localStorage.getItem('loto_player_id');
    const savedName = localStorage.getItem('loto_player_name');

    // 3. Truy cập Firebase để kiểm tra sự tồn tại của phòng
    db.ref(`rooms/${currentRoomId}`).once('value', (snapshot) => {
        if (!snapshot.exists()) return showToast("Phòng này không tồn tại!");

        const roomData = snapshot.val();
        let isReturning = false;

        // 4. LOGIC XÁC ĐỊNH ID NGƯỜI CHƠI
        // Nếu trùng mã phòng + trùng tên đã lưu -> Lấy lại ID cũ (khôi phục trạng thái)
        if (savedRoom === currentRoomId && savedName === playerName && savedId) {
            playerId = savedId;
            isReturning = true;
        } else {

            // Nếu là người mới hoàn toàn -> Tạo mã ID mới trên Firebase
            const playerRef = db.ref(`rooms/${currentRoomId}/players`).push();
            playerId = playerRef.key;

            // Lưu lại thông tin mới vào máy người dùng
            localStorage.setItem('loto_room_id', currentRoomId);
            localStorage.setItem('loto_player_id', playerId);
            localStorage.setItem('loto_player_name', playerName);
        }

        const myRef = db.ref(`rooms/${currentRoomId}/players/${playerId}`);
        
        // 5. Cập nhật thông tin lên Server (Dùng .update để không làm mất dữ liệu vé cũ nếu có)
        myRef.update({ name: playerName });

        // 6. Lắng nghe dữ liệu cá nhân (Real-time)
        myRef.on('value', (pSnapshot) => {
            const data = pSnapshot.val();
            if (!data) return;

            // Cập nhật hạn mức vé từ Nhà cái
            myMaxTickets = data.maxTickets || 0;
            const maxDisplay = document.getElementById('max-ticket-display');
            if (maxDisplay) maxDisplay.innerText = myMaxTickets;

            // Xử lý Lớp phủ chờ Nhà cái phê duyệt vé
            const waitOverlay = document.getElementById('selection-waiting-overlay');
            if (waitOverlay) {
		
		// Nếu đã được cấp vé (max > 0) hoặc đã có vé trong tay -> Ẩn lớp phủ
                if (myMaxTickets > 0 || (data.tickets && data.tickets.length > 0)) {
                    waitOverlay.classList.add('hidden');
                } else {
                    waitOverlay.classList.remove('hidden');
                }
            }

            // --- QUAN TRỌNG: LOGIC ĐIỀU HƯỚNG MÀN HÌNH THÔNG MINH --
            
            // TRƯỜNG HỢP A: Nếu người chơi đã có vé (do quay lại ván đang chơi)
            if (data.tickets && data.tickets.length > 0) {
                myTickets = data.tickets;
                
                // Nếu đang ở màn hình Đăng nhập (vừa mới vào lại)
                if (!document.getElementById('screen-join').classList.contains('hidden')) {
                    document.getElementById('screen-join').classList.add('hidden');
                    document.getElementById('screen-game').classList.remove('hidden');
                    
                    // Khởi động dò lại số và vẽ lại vé
                    startListeningToFirebase(); 
                    renderMyGameTickets();
                }
            } 
            // TRƯỜNG HỢP B: Người mới chưa có vé
            else {
                // Nếu đang đứng ở màn hình Đăng nhập
                if (!document.getElementById('screen-join').classList.contains('hidden')) {
                    document.getElementById('screen-join').classList.add('hidden');
                    document.getElementById('screen-selection').classList.remove('hidden');
                    
                    // Chỉ render bộ vé mới nếu màn hình lựa chọn đang trống (tránh lặp vé)
                    if (document.getElementById('sheet-container').innerHTML === "") {
                        renderNewSheet();
                    }
                }
            }
        });

	// 7. KHỞI TẠO CÁC TÍNH NĂNG BỔ TRỢ
        
        // Phát nhạc nền Tết 
        if (typeof playBackgroundMusic === "function") {
            playBackgroundMusic();
        }
        
        
        // VỊ TRÍ QUAN TRỌNG: GỌI HÀM CHỐNG TẮT MÀN HÌNH (WAKE LOCK)
        // Cần gọi ngay sau tương tác người dùng (Click nút Vào phòng)
        if (typeof requestWakeLock === "function") {
            requestWakeLock(); 
        }
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
    primeSpeechForIOS(); 
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
            
            // Bước A: Chuẩn hóa dữ liệu từ Firebase (Xử lý cả mảng và Object)
            let rawList = [];
            if (Array.isArray(data)) {
                rawList = data;
            } else if (data && typeof data === 'object') {
                rawList = Object.values(data);
            }

            // =============================================================
            // LOGIC PHÁT HIỆN LỆNH RESET (TRỌNG TÂM SỬA LỖI)
            // =============================================================
            // ĐIỀU KIỆN: Danh sách mới TRỐNG (length === 0) 
            // VÀ Danh sách cũ trong máy ĐANG CÓ SỐ (serverNumbers.length > 0)
            if (rawList.length === 0 && serverNumbers.length > 0) {
                
                const screenGame = document.getElementById('screen-game');
                
                // Chỉ đẩy về sảnh chọn vé nếu người chơi đang ở trong màn hình bàn cờ
                if (!screenGame.classList.contains('hidden')) {
                    showToast("♻️ VÁN MỚI! MỜI BẠN CHỌN VÉ...");

                    // 1. Dọn dẹp dữ liệu cũ trong máy
                    serverNumbers = [];         // Xóa lịch sử cũ
                    myMarkedNumbers.clear();    // Xóa các số đã đánh dấu (chấm đỏ)
                    myTickets = [];             // Xóa vé cũ
                    selectedIndices.clear();    // Xóa lựa chọn vé cũ
                    lastSpokenNum = null;       // Reset bộ nhớ giọng đọc

                    // 2. Chuyển đổi giao diện về Sảnh Chọn Vé
                    screenGame.classList.add('hidden');
                    document.getElementById('screen-selection').classList.remove('hidden');

                    // 3. Báo cáo trạng thái lên Server để Nhà cái thấy đèn đỏ/vàng
                    db.ref(`rooms/${currentRoomId}/players/${playerId}`).update({
                        status: 'WAITING_FOR_HOST',
                        tickets: []
                    });

                    // 4. Sinh bộ 6 vé mới cho ván mới
                    renderNewSheet();
                    
                    return; // Ngắt hàm tại đây, không chạy các lệnh phía dưới
                }
            } 
            // =============================================================
            // LOGIC CẬP NHẬT SỐ BÌNH THƯỜNG
            // =============================================================
            if (rawList.length > 0) {
                // Cập nhật danh sách "cũ" bằng danh sách "mới" vừa nhận
                serverNumbers = rawList.map(n => Number(n));
                
                // Lấy con số mới nhất để đọc
                const latestNum = serverNumbers[serverNumbers.length - 1];
                if (latestNum) {
                    speakNumber(latestNum); // Gọi giọng đọc (đã kèm Audio Ducking)
                }

                // Nếu đang ở chế độ Dò Tự Động -> Đánh dấu ngay
                if (isAutoMode) {
                    serverNumbers.forEach(n => myMarkedNumbers.add(Number(n)));
                }
                
                // Vẽ lại giao diện
                requestAnimationFrame(() => {
                    updateGameUI();
                    renderMyGameTickets();
                });
                
                // Rung máy báo hiệu
                if (window.navigator && window.navigator.vibrate) {
                    try { window.navigator.vibrate(200); } catch(e) {}
                }
            } 
            else {
                // TRƯỜNG HỢP: Vừa vào phòng, cả server và máy đều chưa có số
                // (Giúp người chơi ở lại màn hình chờ ván đầu tiên mà không bị đẩy đi)
                serverNumbers = []; 
                updateGameUI();
                renderMyGameTickets();
            }

        } catch (err) {
            console.error("Lỗi đồng bộ lịch sử số:", err);
        }
    });

    // 2. LẮNG NGHE THÔNG BÁO WINNER (HỆ THỐNG VAR)
    db.ref(`rooms/${currentRoomId}/winner`).on('value', (snapshot) => {
        const winnerData = snapshot.val();
        const modal = document.getElementById('announcement-modal');
        
        if (!winnerData) {
            // Khi Host Reset hoặc xóa thông báo trúng, tự động đóng Modal
            if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        } else {
            // Hiển thị thông báo (Kinh/Thắng/Kinh sai)
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
        const ticketCard = document.createElement('div');
        // Dùng border mỏng, shadow nhẹ cho thanh thoát
	ticketCard.className = "bg-white border border-red-800 shadow-lg rounded-xl overflow-hidden w-full mb-2";
        
        let rowsHtml = '';
        ticket.forEach((row) => {
            const rowNums = row.filter(n => n !== 0).map(n => Number(n));
            const isWinnerRow = rowNums.length > 0 && rowNums.every(n => activeNumbers.has(n));

            rowsHtml += `<div class="grid grid-cols-9 h-10 md:h-14 border-b border-black relative loto-row ${isWinnerRow ? 'bg-yellow-100' : ''}">`; 
            
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
                            <div class="cell-num-box w-8 h-8 md:w-11 md:h-11 rounded-full flex items-center justify-center font-black text-base md:text-2xl transition-all duration-300
                                ${isMarked ? 'bg-red-600 text-white scale-105 shadow-lg' : 'text-black'}
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
            <div class="bg-red-800 text-yellow-300 py-1 px-3 flex justify-between items-center font-black uppercase text-[10px] tracking-tight border-b border-black">
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

/**
 * Hàm xử lý Bật/Tắt nhạc nền Tết - Được gọi khi người dùng tác động vào nút gạt "Nhạc Tết"
 */
function toggleMusic() {
    const music = document.getElementById('bg-music');
    const musicToggle = document.getElementById('music-toggle');

    // 1. Kiểm tra xem nút gạt đang ở trạng thái nào (ON hay OFF)
    const isChecked = musicToggle.checked;
    
    if (isChecked) {
        // --- TRƯỜNG HỢP: BẬT NHẠC ---
        music.volume = 0.3; // Thiết lập âm lượng chuẩn (30%) cho nhạc nền
        
        // Sử dụng .play() với Promise để xử lý lỗi nếu trình duyệt chặn phát nhạc
        music.play()
            .then(() => {
                isMusicPlaying = true; // Đánh dấu trạng thái là ĐANG PHÁT để hỗ trợ Audio Ducking
                console.log("Nhạc nền Tết đã bắt đầu phát.");
            })
            .catch(error => {
                // Nếu trình duyệt chặn (do người dùng chưa bấm gì trên trang), trả nút gạt về OFF
                console.warn("Phát nhạc thất bại (Cần tương tác người dùng):", error);
                musicToggle.checked = false; 
                isMusicPlaying = false;
                showToast("Vui lòng tương tác với trang web để phát nhạc!");
            });
    } else {
        // --- TRƯỜNG HỢP: TẮT NHẠC ---
        music.pause();
        isMusicPlaying = false; // Đánh dấu trạng thái là ĐÃ TẮT
        console.log("Nhạc nền Tết đã tạm dừng.");
    }
}

/**
 * Hàm khởi động nhạc nền hệ thống - Được gọi tự động khi người chơi bấm nút "Vào phòng" hoặc "Chơi ngay"
 */
function playBackgroundMusic() {
    const music = document.getElementById('bg-music');
    const musicToggle = document.getElementById('music-toggle'); // Nút gạt Nhạc Tết mới
    
    // Chỉ cố gắng phát nhạc nếu thẻ audio tồn tại và nhạc chưa được đánh dấu là đang phát
    if (music && !isMusicPlaying) {
        
        // 1. Thiết lập âm lượng mặc định (30% để không làm giật mình người chơi)
        music.volume = 0.3; 

        // 2. Thực hiện lệnh phát nhạc
        // Vì lệnh .play() trả về một Promise, chúng ta xử lý theo 2 hướng thành công/thất bại
        music.play()
            .then(() => {
                // --- TRƯỜNG HỢP: TRÌNH DUYỆT CHO PHÉP PHÁT ---
                isMusicPlaying = true; // Cập nhật biến trạng thái toàn cục
                
                // Tự động gạt nút Switch trên giao diện sang trạng thái ON (màu xanh)
                if (musicToggle) {
                    musicToggle.checked = true;
                }
                console.log("Khởi động nhạc nền thành công.");
            })
            .catch(error => {
                // --- TRƯỜNG HỢP: TRÌNH DUYỆT CHẶN (Do chưa có tương tác người dùng) ---
                console.warn("Nhạc nền bị chặn bởi chính sách trình duyệt:", error);
                
                isMusicPlaying = false;
                
                // Đảm bảo nút Switch trên giao diện ở trạng thái OFF (màu xám)
                if (musicToggle) {
                    musicToggle.checked = false;
                }
            });
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

/**
 * Hàm đọc số bằng giọng nói (Global Voice)
 * @param {number} num - Con số vừa mới xổ từ Nhà cái
 */
function speakNumber(num) {
    // 1. KIỂM TRA AN TOÀN (QUAN TRỌNG): Tránh lỗi "Cannot read properties of null"
    const voiceToggle = document.getElementById('voice-toggle');
    const music = document.getElementById('bg-music');
    
    // Nếu không tìm thấy nút gạt (đang ở màn hình đăng nhập chẳng hạn) thì thoát luôn
    if (!voiceToggle || !num || num === lastSpokenNum) return;

    // Lấy trạng thái bật/tắt
    const isVoiceOn = voiceToggle.checked;
    if (!isVoiceOn) return;
    
    // 2. NHẬN DIỆN THIẾT BỊ iOS: iPhone/iPad xử lý âm thanh rất khác biệt
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // 3. Hủy bỏ các giọng đọc cũ đang dang dở để tránh đọc chồng chéo lên nhau
    window.speechSynthesis.cancel();

    // 4. Khởi tạo đối tượng giọng đọc
    const speech = new SpeechSynthesisUtterance();
    speech.text = `Số... ${num}`;    // Nội dung đọc
    speech.lang = 'vi-VN';           // Ngôn ngữ Tiếng Việt
    speech.rate = isIOS ? 1.0 : 0.9; // Tốc độ đọc (0.9 là vừa nghe, không quá nhanh)
    speech.pitch = 1;                // Độ cao của giọng

    // 5. --- LOGIC AUDIO DUCKING (TỰ ĐỘNG GIẢM NHẠC) ---
    
    // Sự kiện: Bắt đầu đọc số
    speech.onstart = () => {
        // Nếu nhạc đang phát, giảm âm lượng xuống mức cực thấp (5%) để ưu tiên giọng đọc
        if (!isIOS && music && isMusicPlaying) {
            music.volume = 0.05; 
        }
    };
    // Sự kiện: Kết thúc đọc số (hoặc bị hủy)
    speech.onend = () => {
        // Trả âm lượng nhạc về mức bình thường (30%) sau khi chị Google đọc xong
        if (!isIOS && music && isMusicPlaying) {
            music.volume = 0.3;
        }
    };

    // 6. Tìm giọng Việt (Nên ưu tiên các giọng có tên "Linh" hoặc "Vietnamese")
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(v => v.lang.includes('vi-VN'));
    if (viVoice) {
        speech.voice = viVoice;
    }

    // 7. Thực hiện phát giọng đọc
    window.speechSynthesis.speak(speech);

    // 8. Ghi nhớ con số đã đọc
    lastSpokenNum = num; 
}

/**
 * Một số trình duyệt cần "khởi động" danh sách giọng đọc khi vừa load trang
 */
if (window.speechSynthesis) {
    // 1. Gán sự kiện lắng nghe khi danh sách giọng đọc thay đổi
    speechSynthesis.onvoiceschanged = () => {
        const voices = speechSynthesis.getVoices();
        console.log("Đã nạp " + voices.length + " giọng đọc.");
    };
    
    // 2. Gọi ngay lập tức để kích hoạt trình duyệt nạp danh sách (CỰC KỲ QUAN TRỌNG CHO IOS)
    speechSynthesis.getVoices();
}

/**
 * Hàm yêu cầu giữ màn hình luôn sáng (Screen Wake Lock)
 * Giúp ngăn điện thoại tự động khóa màn hình hoặc giảm độ sáng khi đang chơi game.
 */
async function requestWakeLock() {
    // 1. Kiểm tra xem trình duyệt có hỗ trợ API Wake Lock hay không
    if ('wakeLock' in navigator) {
        try {
            // 2. Yêu cầu quyền giữ màn hình sáng
            // Lệnh này trả về một đối tượng "Sentinel" để quản lý việc khóa màn hình
            wakeLock = await navigator.wakeLock.request('screen');

            console.log('✅ Chế độ chống tắt màn hình đã được kích hoạt.');

            // 3. Lắng nghe sự kiện "release" (bị nhả quyền)
            // Quyền này sẽ bị nhả ra nếu người chơi chuyển sang tab khác hoặc thu nhỏ trình duyệt
            wakeLock.addEventListener('release', () => {
                console.log('⚠️ Chế độ chống tắt màn hình đã bị tạm dừng.');
            });

        } catch (err) {
            // Trường hợp lỗi (thường do hệ thống hoặc cấu hình pin của điện thoại)
            console.warn(`❌ Không thể giữ màn hình sáng: ${err.name}, ${err.message}`);
        }
    } else {
        console.log('🚫 Trình duyệt của bạn không hỗ trợ API Wake Lock.');
    }
}

// Hàm "mồi" giọng nói cho iPhone
function primeSpeechForIOS() {
    // Thay vì chuỗi rỗng hoàn toàn, ta dùng một khoảng trắng
    // Khoảng trắng giúp trình duyệt "nghĩ" là có nội dung nhưng thực tế không phát ra tiếng
    const dummy = new SpeechSynthesisUtterance(" "); 
    
    // Không cần đặt volume = 0, cứ để mặc định cho nó "thật"
    window.speechSynthesis.speak(dummy);
    
    console.log("iOS Speech Engine Primed!");
}

/**
 * TỰ ĐỘNG XIN LẠI QUYỀN KHI QUAY LẠI TRÌNH DUYỆT
 * Nếu người chơi thoát ra màn hình chính rồi quay lại trình duyệt, 
 * chúng ta cần xin lại quyền Wake Lock ngay lập tức.
 */
document.addEventListener('visibilitychange', async () => {
    // Nếu trang web hiện diện trở lại và trước đó đã từng có quyền Wake Lock
    if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

// Hết file player.js