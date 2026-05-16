# Postgres Backup and Recovery Best Practices

> Source: https://youtu.be/TYiKdH1iMsg

## Agenda

- Backup Types
- Databse SQL Dumps and restore dumps
- Offline Physical Backups
- Continuous Archiving
- Online Physical Backups Using pg_basebackup
- Point-int-time Recovery and recovery settings
- EDB tools

## Why we need backups?

- A backup is a up-to-date copy of the data within the database that can be used to restore it.
- We backup to avoid data loss due to:
  - User errors
  - Hardware failure
  - Data corruption
  - To protect the company's business and reputation
- Databases need to be quickly restored to meet the RPO and RTO requirements

### Backup Types

#### Logical Backups

- Useful for data migration, backing up the objects(tables, indexes, etc.)
  - Database SQL Dumps:
    - For capturing individual databases:
    - `pg_dump`
  - Database Cluster SQL Dump:
    - For clusters where a cluster contains multiple databases:
    - `pg_dumpall`

```sql
## Scenario:
You have a database containing tables, functions, indexes, views, extensions, etc, you can perform a logical backup to get the data and objects and move them to another database.
```

- What Logical Backups Capture ✅

PostgreSQL logical backups (using pg_dump) capture:

1. Tables (data and structure)
2. Indexes (all types including primary keys, unique, partial indexes)
3. Functions (including triggers, stored procedures)
4. Views (regular and materialized views)
5. Extensions (the extension definitions, but actual extension binaries must be installed on target)
6. Constraints (foreign keys, check constraints, defaults)
7. Sequences and their current values
8. Privileges (GRANT/REVOKE statements)
9. Comments (COMMENT ON objects)
10. Enums and composite types
11. Schemas and schema structures

```bash
Option 1: Full Database Backup (Most Common)
# Backup everything (schema + data)
$ pg_dump -h source_host -p 5432 -U username -d database_name -F c -f backup.dump

Option 2: Schema-Only Backup (for migrations without data)
# Backup only schema (no data)
$ pg_dump -h source_host -U username -d database_name --schema-only -f schema_backup.sql

Option 3: Data-Only Backup
# Backup only data (no schema)
$ pg_dump -h source_host -U username -d database_name --data-only -f data_backup.sql


# 1. Backup source database
$ pg_dump -h source.host -U postgres -d postgres \
  -F c -f production_backup_$(date +%Y%m%d).dump

# 2. Create target database (if needed)
createdb -h target.host -U postgres new_database_name

# 3. Restore to target
pg_restore -h target.host -U postgres -d new_database_name \
  --clean --if-exists production_backup_20240401.dump

# --clean: Drop existing objects before creating
# --if-exists: Use DROP IF EXISTS to avoid errors
```

#### Physical Backups

- Physical backups capture the actual files that make up your database at the filesystem level.
- Example it captures the database file itself within which we find everything related to the objects.
- Physical backups are ideal for disaster recovery and full system restoration, while logical backups are better for selective restores and data migration.

```bash
# From a physical backup, you can restore:
# ✅ Entire database cluster
# ✅ Point-in-time (with WAL archives)
# ✅ All tables, indexes, schemas
# ✅ Stored procedures and functions
# ✅ Triggers and constraints
# ✅ User permissions
```

- Offline File System Level Backups: aka Cold backups where you shutdown the database and take the copy

```bash
# Taking a physical backup via filesystem copy
cp -R /var/lib/postgresql/data /backup/postgres-data

# This captures the entire data directory
```

- Online File System Level Backups: aka Hot Backup. Database is still running and you use a low-level API or `pg_basebackup` to create the copy

```sql
-- Using pg_basebackup (standard physical backup tool)
pg_basebackup -D /backup/directory -F tar -z -P

-- This captures:
-- - All database files
-- - WAL files needed for consistency
-- - Configuration files
```

### Databse SQL Dumps and restore dumps

- Generates a text fiel with sql commands which when run in another database will leave a copy of the copied database's objects.
- It does not block reader and writers so database works file while the backup is happening
- It creates internally consistent backup. This means you get a snapshot of everything within the database as at the time you run the command. So you need to run it periodically for consistency.

#### Restore

- Plain text scripts are incompatible with `pg_restore`. You must restore them using the `psql` command:
  - `psql client` - used for backups taken using pg_dump with plain text format(Fp) and backups taken using pg_dumpall(because this one dumps in plain-text SQL format).

  ```bash
  $ psql -f backup.sql postgres
  ```

  - `pg_restore` utility - used for backups taken using pg_dump with custom(Fc), tar(Ft) or directory(Fd) formats. It supports parallel jobs during restore. Can select objects to restore.

### Offline Physical Backups

- Physical backups basically copy the files that postgres uses to store the data in the database.

### Continuous Archiving

- PostgreSQL maintains WAL files for all transactions in **pg_wal** directory.
- PostgreSQL automatically maintains the WAL logs which are full and switched:
  - What Happens During a WAL Switch
    - Think of WAL as a series of numbered log files (segments). PostgreSQL writes sequentially to one file, and when it's full (typically 16MB by default), it:
    - Closes the current WAL file (e.g., 000000010000000000000001)
    - Marks it as "ready for archiving" (if archive mode is enabled)
    - Creates a new WAL file with the next sequence number (e.g., 000000010000000000000002)
    - Continues writing to the new file
- Continuous Archiving can be setup to keep a copy of switched WAL logs which can be later used for recovery.
- It enables offline file system backup of a database cluster.
- What WAL Actually Records (Physical Change): "On page 741 of the employees table, at offset 894, change the 4 bytes from '45000' to '50000'". This allows for replay when the database crashes, to replay all the sequence of phyical changes until we get to the instance before the db crashed.
- Requirements to setup continuous archiving:
  - Archiver Process: Parameters to set in the postgresql.conf file
    - `wal_level` = `replica`
    - `archive_mode` = `on`
    - `archive_command` = `cp -i %p /pgsql/archive/%f`
    - Restart the database server
    - Archive files are automatically generated after every log switch
  - Streaming WAL: to stream the WAL logs from db to server or storage location
    - `wal_level` = `replica`
    - `archive_mode` = `on`
    - `max_wal_senders` = 3
    - Restart the database server
    - Then to initiate the streaming: `pg_receivewal -h localhost -D /pgsql/archive` stream PostgreSQL Write-Ahead Log (WAL) files from a PostgreSQL server to a local directory for backup or replication purposes

```ini
# Enable WAL archiving
wal_level = replica  # or logical
archive_mode = on
archive_command = 'cp %p /pgsql/archive/%f'

# For pg_receivewal specifically
max_wal_senders = 3  # At least 1 for pg_receivewal
```

### Online Physical Backups Using pg_basebackup

- `pg_basebackup` can take an online base backup of a database cluster

You've got it exactly right! They serve **different but complementary purposes**. Let me clarify:

## Core Difference

| Tool                | What it does                                                                          | When to use                                                             |
| ------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **`pg_basebackup`** | Takes a **consistent snapshot** of the entire database cluster (data directory + WAL) | Creating a **base backup** for disaster recovery or setting up replicas |
| **`pg_receivewal`** | **Streams WAL files** continuously as they're generated                               | Maintaining an **archive of WALs** for point-in-time recovery (PITR)    |

## They Work Together for Complete Backup Strategy

A proper PostgreSQL backup strategy uses **BOTH**:

```
Base Backup (weekly/daily) + Continuous WAL Streaming = Point-in-Time Recovery
```

### Visual Timeline:

```
Base Backup    WAL files    WAL files    WAL files    Current Time
(Snapshot)     (Day 1)      (Day 2)      (Day 3)        ↓
    |────────────|────────────|────────────|────────────|
    ↑            ↑            ↑            ↑
    Full backup  Can restore to ANY point in time
    (Monday)     by replaying WALs from Monday's backup
```

## Common Backup Strategies

### Strategy 1: Traditional (pg_basebackup only)

```bash
# Take a full backup (with WAL included)
pg_basebackup -h localhost -D /backups/base_$(date +%Y%m%d) -Ft -z -P
```

**Problem:** Without continuous WAL archiving, you lose all changes since the last backup.

### Strategy 2: Continuous Archiving (pg_basebackup + pg_receivewal)

```bash
# Step 1: Take initial base backup
pg_basebackup -h localhost -D /backups/base_20240101 -Ft -z -P

# Step 2: Run pg_receivewal continuously to capture all changes
pg_receivewal -h localhost -D /wal_archive --create-slot --slot=backup_slot

# Step 3: Take periodic new base backups (e.g., weekly)
# Step 4: Can restore to ANY point between backups using WALs
```

### Strategy 3: Modern (PostgreSQL 15+ with pg_basebackup --wal-method)

```bash
# pg_basebackup can now stream WALs during backup
pg_basebackup -h localhost -D /backups/base_20240101 --wal-method=stream -P
```

## Practical Examples

### Setting Up a Replica (Uses pg_basebackup)

```bash
# On replica server - clones the primary
pg_basebackup -h primary.example.com -D /var/lib/postgresql/15/main -U replicator -P --wal-method=stream

# Then configure replication - replica will use streaming replication
```

### Setting Up Point-in-Time Recovery (Uses BOTH)

```bash
# 1. Restore base backup
tar -xzf /backups/base_20240101.tar.gz -C /var/lib/postgresql/15/main

# 2. Create recovery.conf (or postgresql.auto.conf)
echo "restore_command = 'cp /wal_archive/%f %p'" >> /var/lib/postgresql/15/main/postgresql.auto.conf

# 3. Start PostgreSQL - it will replay WALs to current time
# or stop at specific time
echo "recovery_target_time = '2024-01-15 14:30:00'" >> recovery.conf
```

## Which One Should You Use?

### Use **only `pg_receivewal`** if you:

- Already have a base backup from another source
- Need continuous WAL archiving for an existing backup
- Are setting up a WAL archive for a replica

### Use **only `pg_basebackup`** if you:

- Need a simple, one-time backup
- Are setting up a read replica (it handles both base + WAL)
- Have small databases and can afford daily full backups

### Use **BOTH** for production:

```bash
#!/bin/bash
# Weekly full backup
pg_basebackup -D /backups/base_$(date +%Y%m%d) -Ft -z -P

# Continuous WAL archiving (runs 24/7 as service)
pg_receivewal -D /wal_archive --verbose --slot=permanent_slot --create-slot
```

## Real-World Scenario

```bash
# Disaster at 3:15 PM, last backup was at 1:00 AM
# Without WAL archiving: Lose 14 hours of data
# With pg_receivewal: Can restore to EXACTLY 3:15 PM

# Restore process:
# 1. Restore 1:00 AM base backup
# 2. Apply all WAL files from 1:00 AM to 3:15 PM
# 3. Zero data loss!
```

## Combined Service Setup

Here's a production-quality setup using both:

```bash
# Base backup service (runs weekly)
sudo cat > /etc/systemd/system/pg_basebackup-weekly.service << 'EOF'
[Unit]
Description=Weekly PostgreSQL Base Backup
After=postgresql.service

[Service]
Type=oneshot
User=postgres
ExecStart=/usr/bin/pg_basebackup -h localhost -D /backups/base_$(date +%%Y%%m%%d) -Ft -z -P
ExecStartPost=/usr/bin/find /backups -name "base_*" -mtime +30 -delete
EOF

# WAL streaming service (runs 24/7)
sudo cat > /etc/systemd/system/pg_receivewal.service << 'EOF'
[Unit]
Description=Continuous PostgreSQL WAL Archiving
After=postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=postgres
ExecStart=/usr/bin/pg_receivewal -h localhost -D /wal_archive --verbose --slot=wal_stream_slot --create-slot
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable both
sudo systemctl enable pg_receivewal
sudo systemctl start pg_receivewal
sudo systemctl enable pg_basebackup-weekly.timer  # Create timer separately
```

## Summary Table

| Feature                  | pg_basebackup                   | pg_receivewal                  |
| ------------------------ | ------------------------------- | ------------------------------ |
| **What it backs up**     | Entire cluster (data + WAL)     | Only WAL files                 |
| **Snapshot type**        | Point-in-time snapshot          | Continuous stream              |
| **Backup size**          | Full database size              | ~15-30MB every 16MB of changes |
| **Can restore alone?**   | Yes (to backup time)            | No (needs base backup)         |
| **Used for replication** | Yes (initial clone)             | Sometimes (for log shipping)   |
| **Data loss potential**  | Loses changes since last backup | Zero data loss (continuous)    |
| **Resource impact**      | High (IO intensive)             | Low (just streams WALs)        |

**Bottom line:** For production, use `pg_basebackup` **weekly** + `pg_receivewal` **24/7**. Together they provide complete disaster recovery capability with point-in-time recovery.

### PITR - Point-in-time Recovery

- This is the ability to restore the database cluster up to the present or a specified point in time in the past.
- Uses a combination of full base backup plus wal logs.
- Must be condifgured before it is needed(wal log archiving must be enabled)
