/**
 * Random data for generating bot users
 * These users will behave like real players but are AI-controlled
 */

export const BOT_FIRST_NAMES = {
  US: ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Christopher', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen'],
  GB: ['Oliver', 'George', 'Harry', 'Jack', 'Jacob', 'Noah', 'Charlie', 'Muhammad', 'Thomas', 'Oscar', 'Olivia', 'Amelia', 'Isla', 'Emily', 'Poppy', 'Ava', 'Isabella', 'Jessica', 'Ella', 'Sophie'],
  TR: ['Mehmet', 'Mustafa', 'Ali', 'Ahmet', 'Hüseyin', 'İbrahim', 'Hasan', 'Yusuf', 'Ömer', 'Fatma', 'Ayşe', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Özlem', 'Selin', 'Deniz', 'Can'],
  IR: ['محمد', 'علی', 'حسن', 'حسین', 'رضا', 'مهدی', 'احمد', 'امیر', 'سعید', 'محسن', 'فاطمه', 'زهرا', 'مریم', 'سارا', 'نرگس', 'لیلا', 'نازنین', 'مهسا', 'سمیرا', 'آزاده'],
  DE: ['Lukas', 'Leon', 'Tim', 'Paul', 'Jonas', 'Finn', 'Felix', 'Max', 'Ben', 'Noah', 'Emma', 'Mia', 'Hannah', 'Sofia', 'Anna', 'Emilia', 'Lina', 'Marie', 'Lena', 'Lea'],
  FR: ['Louis', 'Gabriel', 'Raphaël', 'Arthur', 'Lucas', 'Jules', 'Adam', 'Hugo', 'Maël', 'Tom', 'Emma', 'Léa', 'Chloé', 'Manon', 'Camille', 'Inès', 'Sarah', 'Jade', 'Lola', 'Zoé'],
  IT: ['Leonardo', 'Francesco', 'Alessandro', 'Lorenzo', 'Mattia', 'Andrea', 'Gabriele', 'Matteo', 'Riccardo', 'Davide', 'Sofia', 'Giulia', 'Aurora', 'Alice', 'Ginevra', 'Emma', 'Giorgia', 'Greta', 'Beatrice', 'Anna'],
  ES: ['Hugo', 'Martín', 'Lucas', 'Mateo', 'Leo', 'Daniel', 'Alejandro', 'Pablo', 'Manuel', 'Álvaro', 'Lucía', 'María', 'Martina', 'Paula', 'Sofía', 'Julia', 'Daniela', 'Valeria', 'Alba', 'Emma'],
  RU: ['Александр', 'Дмитрий', 'Максим', 'Сергей', 'Андрей', 'Алексей', 'Артём', 'Илья', 'Кирилл', 'Михаил', 'Анастасия', 'Мария', 'Дарья', 'Елена', 'Ольга', 'Татьяна', 'Наталья', 'Юлия', 'Ирина', 'Анна'],
  JP: ['太郎', '一郎', '健太', '翔太', '大輔', '陽太', '蓮', '悠斗', '大翔', '陽向', '花子', '美咲', '結衣', '陽菜', '凛', '葵', '莉子', '結菜', 'さくら', '美羽'],
  CN: ['伟', '强', '磊', '军', '勇', '鹏', '杰', '峰', '超', '辉', '芳', '娜', '秀英', '敏', '静', '丽', '强', '燕', '艳', '玲'],
  BR: ['Miguel', 'Arthur', 'Heitor', 'Bernardo', 'Theo', 'Davi', 'Lorenzo', 'Gabriel', 'Pedro', 'Benjamin', 'Alice', 'Sophia', 'Helena', 'Valentina', 'Laura', 'Isabella', 'Manuela', 'Júlia', 'Luiza', 'Beatriz'],
  IN: ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Arnav', 'Dhruv', 'Krishna', 'Ishaan', 'Aadhya', 'Ananya', 'Anika', 'Diya', 'Ira', 'Kiara', 'Navya', 'Saanvi', 'Sara', 'Anaya'],
  KR: ['민준', '서준', '예준', '도윤', '시우', '주원', '하준', '지호', '지후', '준서', '서연', '서현', '지우', '서윤', '지유', '하은', '예은', '지민', '하윤', '윤서'],
  AE: ['Mohammed', 'Ahmed', 'Khalid', 'Ali', 'Omar', 'Abdullah', 'Salem', 'Rashid', 'Saeed', 'Hassan', 'Fatima', 'Aisha', 'Mariam', 'Noura', 'Moza', 'Sheikha', 'Hessa', 'Salama', 'Latifa', 'Maitha'],
};

export const BOT_LAST_NAMES = {
  US: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'],
  GB: ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Robinson', 'Wright', 'Thompson', 'Evans', 'Walker', 'White', 'Roberts', 'Green', 'Hall', 'Wood', 'Jackson', 'Clarke'],
  TR: ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek'],
  IR: ['احمدی', 'محمدی', 'رضایی', 'حسینی', 'موسوی', 'کریمی', 'علی‌پور', 'رحمانی', 'اکبری', 'صادقی', 'ناصری', 'ملکی', 'جعفری', 'قاسمی', 'حیدری', 'یوسفی', 'اسماعیلی', 'صفری', 'باقری', 'نوری'],
  DE: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann'],
  FR: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Richard', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier'],
  IT: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti'],
  ES: ['García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Álvarez', 'Muñoz', 'Romero', 'Alonso', 'Gutiérrez'],
  RU: ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Михайлов', 'Новиков', 'Фёдоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семёнов', 'Егоров', 'Павлов', 'Козлов', 'Степанов', 'Николаев'],
  JP: ['佐藤', '鈴木', '高橋', '田中', '渡辺', '伊藤', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '山崎'],
  CN: ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'],
  BR: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa'],
  IN: ['Kumar', 'Singh', 'Sharma', 'Patel', 'Gupta', 'Khan', 'Reddy', 'Verma', 'Jain', 'Agarwal', 'Mehta', 'Desai', 'Shah', 'Malhotra', 'Chopra', 'Kapoor', 'Bhatia', 'Saxena', 'Sinha', 'Rao'],
  KR: ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '홍', '전'],
  AE: ['Al Maktoum', 'Al Nahyan', 'Al Qasimi', 'Al Sharqi', 'Al Nuaimi', 'Ahmed', 'Mohammed', 'Hassan', 'Ali', 'Abdullah', 'Sultan', 'Rashid', 'Salem', 'Saeed', 'Khalid', 'Hamad', 'Majid', 'Nasser', 'Omar', 'Zayed'],
};

export const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
];

// Avatar URLs (matching register form - 25 avatars)
export const AVATAR_OPTIONS = Array.from({ length: 25 }, (_, i) => 
  `/assets/images/avatar/avatar-${i + 1}.webp`
);

/**
 * Generate a random username from first and last name
 */
export function generateUsername(firstName: string, lastName: string): string {
  // Remove all non-English characters and convert to lowercase
  const cleanFirst = firstName.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const cleanLast = lastName.replace(/[^a-zA-Z]/g, '').toLowerCase();
  
  // If names are not in English, generate random username
  if (!cleanFirst || !cleanLast) {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const randomStr = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `user_${randomStr}`;
  }
  
  const patterns = [
    `${cleanFirst}${cleanLast}`,
    `${cleanFirst}_${cleanLast}`,
    `${cleanFirst}.${cleanLast}`,
    `${cleanFirst}${cleanLast}${Math.floor(Math.random() * 100)}`,
    `${cleanFirst}_${Math.floor(Math.random() * 1000)}`,
    `${cleanLast}_${cleanFirst}`,
  ];
  
  return patterns[Math.floor(Math.random() * patterns.length)];
}

/**
 * Generate a random secure password
 */
export function generatePassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Get random item from array
 */
export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}
