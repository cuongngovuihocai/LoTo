// --- CÁC HẰNG SỐ CẤU HÌNH ---
const COLS_PER_ROW = 9;
const ROWS_PER_TICKET = 3;
const TOTAL_TICKETS = 6; // Một bộ (Sheet) gồm 6 vé sẽ phủ hết 90 số

// Định nghĩa dải số cho từng cột
// Cột 0: 1-9, Cột 1: 10-19, ..., Cột 8: 80-90
const COLUMN_RANGES = [
    { min: 1, max: 9, count: 9 },
    { min: 10, max: 19, count: 10 },
    { min: 20, max: 29, count: 10 },
    { min: 30, max: 39, count: 10 },
    { min: 40, max: 49, count: 10 },
    { min: 50, max: 59, count: 10 },
    { min: 60, max: 69, count: 10 },
    { min: 70, max: 79, count: 10 },
    { min: 80, max: 90, count: 11 }
];

// --- CÁC HÀM HỖ TRỢ (HELPER FUNCTIONS) ---

// Hàm xáo trộn mảng (Shuffle)
function shuffle(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

// Hàm lấy tổ hợp (Combinations) - Dùng cho thuật toán quay lui
function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const first = arr[0];
    const rest = arr.slice(1);
    const combsWithoutFirst = getCombinations(rest, k);
    const combsWithFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
    return [...combsWithoutFirst, ...combsWithFirst];
}

// Hàm tìm cách xếp số vào hàng (Backtracking Solver)
function solveRowPattern(colCounts) {
    // Ma trận 3x9 chứa 0 hoặc 1 (1 là có số, 0 là ô trống)
    const matrix = [
        Array(9).fill(0),
        Array(9).fill(0),
        Array(9).fill(0)
    ];
    const rowSums = [0, 0, 0];

    // Hàm đệ quy
    const solve = (colIdx) => {
        if (colIdx === 9) {
            // Kiểm tra điều kiện cuối: Mỗi hàng phải đúng 5 số
            return rowSums[0] === 5 && rowSums[1] === 5 && rowSums[2] === 5;
        }

        const count = colCounts[colIdx];
        // Cần chọn 'count' hàng trong [0, 1, 2] để đặt số
        const possibleRows = [0, 1, 2];
        const combinations = getCombinations(possibleRows, count);
        
        // Xáo trộn để tạo sự ngẫu nhiên cho vị trí ô trống
        const shuffledCombos = shuffle(combinations);

        for (const combo of shuffledCombos) {
            // Kiểm tra xem nếu thêm vào thì hàng có bị quá 5 số không
            let valid = true;
            for (const r of combo) {
                if (rowSums[r] >= 5) valid = false;
            }

            if (valid) {
                // Thử đặt vào
                for (const r of combo) {
                    matrix[r][colIdx] = 1;
                    rowSums[r]++;
                }

                if (solve(colIdx + 1)) return true;

                // Quay lui (Backtrack) - Gỡ ra nếu không giải được
                for (const r of combo) {
                    matrix[r][colIdx] = 0;
                    rowSums[r]--;
                }
            }
        }
        return false;
    };

    if (solve(0)) return matrix;
    return null; // Không tìm thấy giải pháp
}

// Hàm điền số vào vé dựa trên pattern đã tìm được
function fillTicket(ticketGrid, ticketNumbers) {
    // ticketNumbers: mảng các mảng số cho từng cột
    const colCounts = ticketNumbers.map(n => n.length);
    
    // Tìm pattern sắp xếp (xác định ô nào có số, ô nào để trống)
    const rowPattern = solveRowPattern(colCounts);
    
    if (!rowPattern) return false;

    // Điền số thực tế vào lưới
    for (let c = 0; c < 9; c++) {
        const nums = ticketNumbers[c]; // Đã được sort
        let numIdx = 0;
        for (let r = 0; r < 3; r++) {
            if (rowPattern[r][c] === 1) {
                ticketGrid[r][c] = nums[numIdx++];
            } else {
                ticketGrid[r][c] = 0; // 0 đại diện cho ô trống
            }
        }
    }
    return true;
}

// --- HÀM CHÍNH (MAIN FUNCTION) ---

/**
 * Tạo ra một bộ (Sheet) gồm 6 vé Lô tô.
 * Đảm bảo sử dụng hết các số từ 1 đến 90 không trùng lặp giữa các vé.
 * Trả về: Mảng 6 vé. Mỗi vé là mảng 3 dòng x 9 cột.
 */
function generateLotoSheet() {
    // 1. Tạo các xô số (bucket) cho từng cột và xáo trộn chúng
    const colBuckets = COLUMN_RANGES.map(range => {
        const nums = [];
        for (let i = range.min; i <= range.max; i++) nums.push(i);
        return shuffle(nums);
    });

    // 2. Ma trận phân phối số lượng số cho mỗi vé (6 vé x 9 cột)
    // Khởi tạo ma trận đếm số lượng
    let countsMatrix = Array(TOTAL_TICKETS).fill(0).map(() => Array(COLS_PER_ROW).fill(0));

    // Chiến thuật phân phối cứng để đảm bảo cân bằng
    // Cột 0 (9 số): 3 vé có 2 số, 3 vé có 1 số
    // Cột 1-7 (10 số): 4 vé có 2 số, 2 vé có 1 số
    // Cột 8 (11 số): 5 vé có 2 số, 1 vé có 1 số
    const colDistributions = [
        [2, 2, 2, 1, 1, 1], // Col 0
        [2, 2, 2, 2, 1, 1], // Col 1
        [2, 2, 2, 2, 1, 1], // Col 2
        [2, 2, 2, 2, 1, 1], // Col 3
        [2, 2, 2, 2, 1, 1], // Col 4
        [2, 2, 2, 2, 1, 1], // Col 5
        [2, 2, 2, 2, 1, 1], // Col 6
        [2, 2, 2, 2, 1, 1], // Col 7
        [2, 2, 2, 2, 2, 1], // Col 8 (11 số)
    ];

    // Xáo trộn phân phối cho mỗi cột để ngẫu nhiên vé nào nhận nhiều số
    const finalCountsPerCol = colDistributions.map(dist => shuffle(dist));

    // Chuyển vị ma trận (từ theo cột sang theo vé)
    for (let t = 0; t < TOTAL_TICKETS; t++) {
        for (let c = 0; c < COLS_PER_ROW; c++) {
            countsMatrix[t][c] = finalCountsPerCol[c][t];
        }
    }

    // 3. Cân bằng lại để đảm bảo tổng mỗi vé là 15 số
    // (Đoạn code gốc của bạn có logic swap rất hay ở đây, tôi giữ nguyên logic nhưng viết lại JS)
    let balanced = false;
    let attempts = 0;
    while (!balanced && attempts < 1000) {
        attempts++;
        const sums = countsMatrix.map(row => row.reduce((a, b) => a + b, 0));
        
        // Tìm vé thừa số (>15) và vé thiếu số (<15)
        const donorIdx = sums.findIndex(s => s > 15);
        const receiverIdx = sums.findIndex(s => s < 15);

        if (donorIdx === -1 && receiverIdx === -1) {
            balanced = true;
            break;
        }

        if (donorIdx !== -1 && receiverIdx !== -1) {
            let swapped = false;
            const cols = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
            
            // Tìm cột mà bên thừa có nhiều số (>1) để chuyển bớt cho bên thiếu
            for (const col of cols) {
                if (countsMatrix[donorIdx][col] > 1) { 
                    countsMatrix[donorIdx][col]--;
                    countsMatrix[receiverIdx][col]++;
                    swapped = true;
                    break;
                }
            }
            
            // Nếu không tìm được cột >1, đành lấy cột có 1 số (chấp nhận cột đó về 0)
            if (!swapped) {
                for (const col of cols) {
                    if (countsMatrix[donorIdx][col] > 0) {
                        countsMatrix[donorIdx][col]--;
                        countsMatrix[receiverIdx][col]++;
                        swapped = true;
                        break;
                    }
                }
            }
        }
    }

    // 4. Tạo vé thực tế từ ma trận đếm
    const sheets = [];

    for (let t = 0; t < TOTAL_TICKETS; t++) {
        const ticketNumbers = []; 
        
        // Lấy số từ bucket ra theo số lượng đã tính
        for (let c = 0; c < COLS_PER_ROW; c++) {
            const count = countsMatrix[t][c];
            const nums = colBuckets[c].splice(0, count);
            ticketNumbers.push(nums.sort((a, b) => a - b));
        }

        // Tạo lưới 3x9
        const ticketGrid = [
            Array(9).fill(0),
            Array(9).fill(0),
            Array(9).fill(0)
        ];

        // Điền số vào lưới (Backtracking)
        // Nếu không điền được (do xui xẻo rơi vào thế bí), đệ quy gọi lại hàm chính để tạo lại từ đầu
        if (!fillTicket(ticketGrid, ticketNumbers)) {
            console.warn("Vé bị lỗi cấu trúc, đang tạo lại...");
            return generateLotoSheet(); 
        }
        
        sheets.push(ticketGrid);
    }

    return sheets;
}

/**
 * Kiểm tra xem người chơi có trúng (Kinh) hay không.
 * @param {Array} tickets - Mảng chứa các vé người chơi đã chọn (1 đến 6 vé)
 * @param {Array} drawnNumbers - Mảng chứa các số Nhà cái đã xổ (VD: [12, 45, 88, 7...])
 * @returns {Object} - Trả về kết quả trúng hay trượt, và trúng ở vé nào, hàng nào.
 */
function checkWin(tickets, drawnNumbers) {
    const drawnSet = new Set(drawnNumbers);

    for (let t = 0; t < tickets.length; t++) {
        const ticket = tickets[t];

        for (let r = 0; r < 3; r++) {
            const row = ticket[r];
            let matchCount = 0;
            let rowNumbers = []; // Mảng chứa 5 số thực tế của hàng này

            for (let c = 0; c < 9; c++) {
                const num = row[c];
                if (num !== 0) {
                    rowNumbers.push(num); // Thu thập đủ 5 số của hàng
                    if (drawnSet.has(num)) {
                        matchCount++;
                    }
                }
            }

            // Nếu khớp đủ 5 số đã xổ
            if (matchCount === 5) {
                return {
                    isWin: true,
                    winningRow: rowNumbers, // Trả về 5 số này để Host đối soát
                    ticketIndex: t + 1,    // Trả về số thứ tự vé (1-6) cho dễ đọc
                    rowIndex: r + 1        // Trả về số thứ tự hàng (1-3) cho dễ đọc
                };
            }
        }
    }

    return { isWin: false };
}