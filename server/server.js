import express from 'express';
import cors from 'cors';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const app = express();
const adapter = new JSONFile('db.json');
const defaultData = { bookings: [], contacts: [] }; // 기본 데이터 구조 정의
const db = new Low(adapter, defaultData);

app.use(cors());
app.use(express.json());

// 데이터베이스 초기화
await db.read();
if (!db.data) {
  db.data = { bookings: [] };
  await db.write();
}

// 예약 생성
app.post('/api/bookings', async (req, res) => {
  const booking = req.body;
  db.data.bookings.push(booking);
  await db.write();
  res.status(201).json(booking);
});

// 모든 예약 조회
app.get('/api/bookings', async (req, res) => {
  await db.read();
  res.json(db.data.bookings);
});

// 연락처 메시지 저장
app.post('/api/contacts', async (req, res) => {
  const contact = req.body;
  db.data.contacts.push(contact);
  await db.write();
  res.status(201).json(contact);
});

// 모든 연락처 메시지 조회
app.get('/api/contacts', async (req, res) => {
  await db.read();
  res.json(db.data.contacts);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;