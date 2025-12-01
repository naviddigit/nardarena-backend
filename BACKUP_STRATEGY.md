# 🔒 استراتژی Backup حرفه‌ای NardArena

## 📦 1. انواع Backup

### A) Full Database Backup (روزانه)
```bash
# خودکار در ساعت 3 صبح
pg_dump -h localhost -U postgres -d nardarena > backup_$(date +%Y%m%d).sql
```

### B) Incremental Backup (هر 6 ساعت)
- فقط تغییرات از آخرین backup
- حجم کمتر، سریع‌تر

### C) Archive Old Games (ماهانه)
```sql
-- بازی‌های قدیمی‌تر از 6 ماه رو آرشیو کن
INSERT INTO games_archive 
SELECT * FROM games 
WHERE ended_at < NOW() - INTERVAL '6 months';

-- حذف حرکات جزئی (فقط moveHistory کافیه)
DELETE FROM game_moves 
WHERE game_id IN (
  SELECT id FROM games 
  WHERE ended_at < NOW() - INTERVAL '3 months'
);
```

---

## 🗄️ 2. ساختار Backup

### سطح 1: Real-time Replication
```yaml
# PostgreSQL Streaming Replication
primary_server: production-db
standby_servers:
  - standby-1 (hot standby)
  - standby-2 (warm standby)
```

### سطح 2: Daily Automated Backups
```yaml
schedule: "0 3 * * *"  # هر روز 3 صبح
retention: 
  daily: 7 days       # 7 backup روزانه
  weekly: 4 weeks     # 4 backup هفتگی  
  monthly: 12 months  # 12 backup ماهانه
```

### سطح 3: Cloud Storage (S3/Wasabi)
```typescript
// Automatic upload to cloud
import { S3 } from '@aws-sdk/client-s3';

async function uploadBackupToCloud(filePath: string) {
  const s3 = new S3({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });

  await s3.putObject({
    Bucket: 'nardarena-backups',
    Key: `backups/${Date.now()}_backup.sql.gz`,
    Body: fs.createReadStream(filePath),
  });
}
```

---

## 📊 3. Data Archival Strategy

### Phase 1: Active Games (0-1 month)
- Full data در PostgreSQL
- تمام `game_moves` نگه داری میشه
- سریع‌ترین access

### Phase 2: Recent History (1-6 months)
- فقط `moveHistory` JSON
- `game_moves` پاک میشه (90% کاهش حجم)
- هنوز قابل دسترسی سریع

### Phase 3: Archive (6+ months)
- انتقال به جدول جداگانه `games_archive`
- Compressed storage
- فقط برای گزارش‌گیری

### Phase 4: Cold Storage (1+ year)
- Export به فایل JSON/CSV
- آپلود به Cloud Storage
- حذف از database اصلی

---

## 🔢 4. محاسبه حجم (1000 بازی/روز)

### Scenario 1: بدون بهینه‌سازی
```
Daily: 150,000 moves × 500 bytes = 75 MB/day
Monthly: 2.25 GB
Yearly: 27 GB
```

### Scenario 2: با بهینه‌سازی (پیشنهادی)
```
Active (1 month): 150,000 × 500 = 75 MB
Archived (JSON only): 30,000 games × 50 KB = 1.5 GB
Total: ~2 GB/month (93% کاهش)
```

---

## ⚙️ 5. پیاده‌سازی Cron Jobs

### A) Backup Script
```bash
#!/bin/bash
# /opt/scripts/backup-nardarena.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/nardarena"
DB_NAME="nardarena"
DB_USER="postgres"

# Full backup
pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_DIR/full_$DATE.sql.gz"

# Upload to cloud
aws s3 cp "$BACKUP_DIR/full_$DATE.sql.gz" s3://nardarena-backups/

# Clean old local backups (keep 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# Log
echo "[$DATE] Backup completed" >> /var/log/nardarena-backup.log
```

### B) Crontab Configuration
```cron
# Daily full backup at 3 AM
0 3 * * * /opt/scripts/backup-nardarena.sh

# Hourly incremental backup
0 * * * * /opt/scripts/incremental-backup.sh

# Monthly archive old games
0 4 1 * * /opt/scripts/archive-old-games.sh

# Weekly cleanup
0 5 * * 0 /opt/scripts/cleanup-archives.sh
```

---

## 🏥 6. Disaster Recovery Plan

### RPO (Recovery Point Objective): 1 hour
- حداکثر 1 ساعت داده از دست میره

### RTO (Recovery Time Objective): 30 minutes
- ظرف 30 دقیقه سیستم بر می‌گرده

### Recovery Steps:
```bash
# 1. Stop application
docker-compose down

# 2. Restore from latest backup
gunzip -c /backups/latest.sql.gz | psql -U postgres nardarena

# 3. Verify data integrity
psql -U postgres nardarena -c "SELECT COUNT(*) FROM users;"

# 4. Start application
docker-compose up -d

# 5. Monitor logs
docker-compose logs -f backend
```

---

## 💰 7. هزینه‌ها (تخمینی)

### Storage Costs (Wasabi S3):
```
10 GB backup data
$0.0059/GB/month = ~$0.06/month
```

### Database Size Management:
```
Active data: 5 GB (fast SSD)
Archive data: 50 GB (slower HDD/S3)
Total cost: ~$5/month
```

---

## ✅ 8. Checklist پیاده‌سازی

- [ ] راه‌اندازی PostgreSQL Replication
- [ ] نصب و تنظیم backup scripts
- [ ] ایجاد S3/Wasabi bucket
- [ ] تست restore process
- [ ] راه‌اندازی monitoring/alerts
- [ ] مستندسازی recovery procedures
- [ ] تست disaster recovery
- [ ] آموزش تیم

---

## 📝 9. Best Practices

1. **هرگز backup رو روی همون سرور نگه ندار**
2. **حتماً restore رو تست کن** (backup بدون test = backup نداری)
3. **Encrypt کردن backups** (خصوصاً تو cloud)
4. **Monitor backup success/failure**
5. **Document everything**
6. **Automate everything possible**

---

## 🔐 10. Security

### Encryption at Rest
```bash
# Encrypt backup before upload
gpg --encrypt --recipient backup@nardarena.com backup.sql
```

### Access Control
```yaml
backup_access:
  - admin@nardarena.com
  - devops@nardarena.com
retention_policy: WORM (Write Once Read Many)
```
