// Script để import proxy vào MongoDB
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const dbName = 'mkt_db';

// Dữ liệu proxy mẫu - bạn có thể thay thế bằng dữ liệu thực tế
const proxies = [
  {
    ip: '103.149.130.38',
    port: 8080,
    user: 'user1',
    pass: 'pass1',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 ngày
  },
  {
    ip: '103.149.130.39',
    port: 8080,
    user: 'user2',
    pass: 'pass2',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
  {
    ip: '103.149.130.40',
    port: 8080,
    user: 'user3',
    pass: 'pass3',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
  {
    ip: '103.149.130.41',
    port: 8080,
    user: 'user4',
    pass: 'pass4',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
  {
    ip: '103.149.130.42',
    port: 8080,
    user: 'user5',
    pass: 'pass5',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
  {
    ip: '103.149.130.43',
    port: 8080,
    user: 'user6',
    pass: 'pass6',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
  {
    ip: '103.149.130.44',
    port: 8080,
    user: 'user7',
    pass: 'pass7',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
  {
    ip: '103.149.130.45',
    port: 8080,
    user: 'user8',
    pass: 'pass8',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
  {
    ip: '103.149.130.46',
    port: 8080,
    user: 'user9',
    pass: 'pass9',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
  {
    ip: '103.149.130.47',
    port: 8080,
    user: 'user10',
    pass: 'pass10',
    expired_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  },
];

async function importProxies() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Đã kết nối MongoDB');

    const db = client.db(dbName);
    const collection = db.collection('proxies');

    // Xóa dữ liệu cũ (nếu có)
    await collection.deleteMany({});
    console.log('🗑️  Đã xóa dữ liệu cũ');

    // Insert dữ liệu mới
    const result = await collection.insertMany(proxies);
    console.log(`✅ Đã import ${result.insertedCount} proxy thành công`);

    // Hiển thị một số proxy đã import
    const imported = await collection.find({}).limit(5).toArray();
    console.log('\n📋 Một số proxy đã import:');
    imported.forEach((proxy, index) => {
      console.log(`${index + 1}. ${proxy.ip}:${proxy.port}:${proxy.user}:${proxy.pass}`);
    });

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await client.close();
    console.log('\n✅ Đã đóng kết nối MongoDB');
  }
}

importProxies();
