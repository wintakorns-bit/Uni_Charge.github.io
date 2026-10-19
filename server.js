const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ==================== 1. สร้างข้อมูล 54 ช่องชาร์จ 9 ตำแหน่ง ====================
const cables = ['Type-C', 'Lightning', 'Micro-USB'];
const locationsConfig = [
  { prefix: '01', count: 6, loc: 'หัวเรือตึกคณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี ชั้น 1' },
  { prefix: '02', count: 6, loc: 'หน้าห้องประชุมชูพันธ์ ชั้น 2' },
  { prefix: '03', count: 5, loc: 'หน้าลิฟต์ ชั้น 3' },
  { prefix: '04', count: 6, loc: 'หน้าลิฟต์ ชั้น 4' },
  { prefix: '05', count: 6, loc: 'หน้าลิฟต์ ชั้น 5' },
  { prefix: '06', count: 6, loc: 'หน้าลิฟต์ ชั้น 6' },
  { prefix: '07', count: 6, loc: 'หน้าลิฟต์ ชั้น 7' },
  { prefix: '08', count: 6, loc: 'หน้าลิฟต์ ชั้น 8' },
  { prefix: '09', count: 7, loc: 'หน้าลิฟต์ ชั้น 9' }
];

let slotsData = [];
let slotIndex = 1;

locationsConfig.forEach(config => {
  for (let i = 0; i < config.count; i++) {
    const slotNumber = `${config.prefix}${i}`;
    slotsData.push({
      rowIndex: slotIndex++,
      slotNumber: slotNumber,
      location: config.loc,
      cableType: cables[i % 3],
      status: 'ว่าง', // สถานะ: 'ว่าง', 'มีผู้จองแล้ว', 'ปิดซ่อม'
      bookedBy: null,
      bookedEmail: null,
      bookTime: null,
      durationHours: 1,
      totalAmount: 20
    });
  }
});

let bookingHistory = [];

// ==================== 2. ตั้งค่าการส่งอีเมล (Nodemailer) ====================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'unicharge.rmutsv@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

async function sendConfirmationEmail(userEmail, slotNumber, location, amount) {
  const mailOptions = {
    from: '"Uni Charge System" <unicharge.rmutsv@gmail.com>',
    to: userEmail,
    subject: `⚡ ยืนยันการจองตู้ชาร์จ Uni Charge ช่อง ${slotNumber}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #0d6efd;">⚡ ยืนยันการจองตู้ชาร์จสำเร็จ</h2>
        <p>คุณได้ทำรายการจองช่องชาร์จแบตเตอรี่อัจฉริยะ Uni Charge เรียบร้อยแล้ว</p>
        <hr>
        <p><strong>ช่องชาร์จ:</strong> ช่อง ${slotNumber}</p>
        <p><strong>สถานที่:</strong> ${location}</p>
        <p><strong>ยอดชำระเงิน:</strong> ${amount} บาท (20 บาท/ชม.)</p>
        <p><strong>สถานะการชำระเงิน:</strong> ชำระเงินเรียบร้อยแล้วผ่าน PromptPay/Online Banking</p>
        <hr>
        <p style="color: #6c757d; font-size: 12px;">ขอบคุณที่ใช้บริการ Uni Charge คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี มทร.ศรีวิชัย</p>
      </div>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.log('Email Notification Note: Mock mode or configure valid SMPT credentials.');
  }
}

// ==================== 3. API ROUTES ====================

// ดึงข้อมูลช่องชาร์จทั้งหมด
app.get('/api/slots', (req, res) => {
  res.json(slotsData);
});

// ยืนยันชำระเงินและจองช่องชาร์จ
app.post('/api/book', async (req, res) => {
  const { rowIndex, studentEmail, studentName, hours, paymentMethod } = req.body;
  const slot = slotsData.find(s => s.rowIndex === parseInt(rowIndex));

  if (!slot) return res.status(404).json({ success: false, message: 'ไม่พบช่องชาร์จ' });
  if (slot.status !== 'ว่าง') return res.status(400).json({ success: false, message: 'ช่องชาร์จนี้ไม่พร้อมใช้งาน' });

  const totalAmount = (parseInt(hours) || 1) * 20;
  const now = new Date().toLocaleString('th-TH');

  slot.status = 'มีผู้จองแล้ว';
  slot.bookedBy = studentName || studentEmail;
  slot.bookedEmail = studentEmail;
  slot.bookTime = now;
  slot.durationHours = hours || 1;
  slot.totalAmount = totalAmount;

  const record = {
    id: 'BK' + Date.now(),
    slotNumber: slot.slotNumber,
    location: slot.location,
    cableType: slot.cableType,
    studentEmail: studentEmail,
    studentName: studentName,
    bookTime: now,
    hours: hours || 1,
    amount: totalAmount,
    paymentMethod: paymentMethod || 'PromptPay QR',
    status: 'กำลังใช้งาน'
  };

  bookingHistory.unshift(record);

  // ส่งอีเมลแจ้งเตือน
  sendConfirmationEmail(studentEmail, slot.slotNumber, slot.location, totalAmount);

  res.json({ success: true, message: 'จองและชำระเงินสำเร็จ!', booking: record });
});

// หยุดการชาร์จ/คืนช่องชาร์จ
app.post('/api/release', (req, res) => {
  const { rowIndex } = req.body;
  const slot = slotsData.find(s => s.rowIndex === parseInt(rowIndex));

  if (slot) {
    slot.status = 'ว่าง';
    slot.bookedBy = null;
    slot.bookedEmail = null;
    slot.bookTime = null;
    
    // อัปเดตสถานะประวัติ
    const historyItem = bookingHistory.find(h => h.slotNumber === slot.slotNumber && h.status === 'กำลังใช้งาน');
    if (historyItem) historyItem.status = 'เสร็จสิ้น';

    return res.json({ success: true, message: ' คืนช่องชาร์จเรียบร้อยแล้ว' });
  }
  res.status(400).json({ success: false, message: 'ไม่พบข้อมูลช่องชาร์จ' });
});

// อัปเดตสถานะจากผู้ดูแล (Admin)
app.post('/api/admin/status', (req, res) => {
  const { rowIndex, newStatus } = req.body;
  const slot = slotsData.find(s => s.rowIndex === parseInt(rowIndex));
  if (slot) {
    slot.status = newStatus;
    if (newStatus === 'ว่าง') {
      slot.bookedBy = null;
      slot.bookedEmail = null;
    }
    return res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
  }
  res.status(400).json({ success: false, message: 'ไม่พบข้อมูล' });
});

// ดึงประวัติการจองของผู้ใช้
app.get('/api/history', (req, res) => {
  const { email } = req.query;
  if (email) {
    const userHistory = bookingHistory.filter(h => h.studentEmail === email);
    return res.json(userHistory);
  }
  res.json(bookingHistory);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚡ Uni Charge Server running at http://localhost:${PORT}`);
});