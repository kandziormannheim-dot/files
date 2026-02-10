#!/usr/bin/env python3
"""
Backup Manager
==============
Manages backups for WordPress, n8n, and databases
Supports local backup and S3 upload.

Usage:
    python3 backup_manager.py --action full
    python3 backup_manager.py --action wordpress --domain ai-tools-guide.com
    python3 backup_manager.py --action database
    python3 backup_manager.py --action restore --file backup_20250210.tar.gz
    python3 backup_manager.py --action cleanup --days 90
"""

import os
import sys
import tarfile
import gzip
import shutil
import json
import subprocess
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Tuple
import argparse
import boto3

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class BackupManager:
    """Manages all backup operations"""
    
    def __init__(self, backup_dir: str = "backups", s3_enabled: bool = False):
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
        self.s3_enabled = s3_enabled
        if s3_enabled:
            self.s3_client = boto3.client('s3')
            self.s3_bucket = os.getenv('AWS_S3_BUCKET')
        
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        logger.info(f"Backup manager initialized | Backup dir: {self.backup_dir}")
    
    def backup_wordpress(self, domain: str, wp_path: str = None) -> Tuple[bool, str]:
        """Backup WordPress site"""
        logger.info(f"Starting WordPress backup for {domain}")
        
        try:
            if not wp_path:
                wp_path = f"/var/www/{domain}"
            
            if not Path(wp_path).exists():
                logger.error(f"WordPress path not found: {wp_path}")
                return False, f"Path not found: {wp_path}"
            
            backup_file = self.backup_dir / f"wordpress_{domain}_{self.timestamp}.tar.gz"
            
            # Create tar archive
            logger.info(f"Creating archive: {backup_file}")
            with tarfile.open(backup_file, "w:gz") as tar:
                tar.add(wp_path, arcname=domain)
            
            file_size = backup_file.stat().st_size / (1024 * 1024)  # MB
            logger.info(f"WordPress backup complete: {file_size:.2f} MB")
            
            # Upload to S3 if enabled
            if self.s3_enabled:
                self._upload_to_s3(backup_file)
            
            return True, str(backup_file)
        
        except Exception as e:
            logger.error(f"WordPress backup failed: {e}")
            return False, str(e)
    
    def backup_database(self, db_config: Dict) -> Tuple[bool, str]:
        """Backup PostgreSQL database"""
        logger.info("Starting database backup")
        
        try:
            db_name = db_config.get('database', 'affiliate_db')
            db_user = db_config.get('user', 'affiliate_user')
            db_host = db_config.get('host', 'localhost')
            db_port = db_config.get('port', 5432)
            
            backup_file = self.backup_dir / f"database_{db_name}_{self.timestamp}.sql.gz"
            
            logger.info(f"Exporting database: {db_name}")
            
            # Use pg_dump to backup
            with open(backup_file, 'wb') as f:
                process = subprocess.Popen([
                    'pg_dump',
                    '--host', str(db_host),
                    '--port', str(db_port),
                    '--username', db_user,
                    '--no-password',
                    db_name
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                # Compress on the fly
                with gzip.open(f, 'wb') as gz:
                    gz.write(process.stdout.read())
            
            if process.returncode != 0:
                logger.error(f"pg_dump failed: {process.stderr.decode()}")
                return False, "Database export failed"
            
            file_size = backup_file.stat().st_size / (1024 * 1024)  # MB
            logger.info(f"Database backup complete: {file_size:.2f} MB")
            
            # Upload to S3 if enabled
            if self.s3_enabled:
                self._upload_to_s3(backup_file)
            
            return True, str(backup_file)
        
        except Exception as e:
            logger.error(f"Database backup failed: {e}")
            return False, str(e)
    
    def backup_n8n(self, n8n_data_dir: str = "/home/n8n/.n8n") -> Tuple[bool, str]:
        """Backup n8n workflows and data"""
        logger.info("Starting n8n backup")
        
        try:
            if not Path(n8n_data_dir).exists():
                logger.error(f"n8n data dir not found: {n8n_data_dir}")
                return False, f"Path not found: {n8n_data_dir}"
            
            backup_file = self.backup_dir / f"n8n_backup_{self.timestamp}.tar.gz"
            
            logger.info(f"Creating n8n archive: {backup_file}")
            with tarfile.open(backup_file, "w:gz") as tar:
                tar.add(n8n_data_dir, arcname="n8n")
            
            file_size = backup_file.stat().st_size / (1024 * 1024)  # MB
            logger.info(f"n8n backup complete: {file_size:.2f} MB")
            
            # Upload to S3 if enabled
            if self.s3_enabled:
                self._upload_to_s3(backup_file)
            
            return True, str(backup_file)
        
        except Exception as e:
            logger.error(f"n8n backup failed: {e}")
            return False, str(e)
    
    def backup_full(self, domains: List[str], db_config: Dict) -> Dict[str, Any]:
        """Perform full system backup"""
        logger.info("=" * 60)
        logger.info("STARTING FULL SYSTEM BACKUP")
        logger.info("=" * 60)
        
        results = {
            'timestamp': self.timestamp,
            'status': 'success',
            'backups': {}
        }
        
        # Backup each WordPress site
        logger.info(f"\nBacking up {len(domains)} WordPress sites...")
        for domain in domains:
            success, result = self.backup_wordpress(domain)
            results['backups'][f'wordpress_{domain}'] = {
                'success': success,
                'path': result
            }
        
        # Backup database
        logger.info("\nBacking up database...")
        success, result = self.backup_database(db_config)
        results['backups']['database'] = {
            'success': success,
            'path': result
        }
        
        # Backup n8n
        logger.info("\nBacking up n8n...")
        success, result = self.backup_n8n()
        results['backups']['n8n'] = {
            'success': success,
            'path': result
        }
        
        # Write backup manifest
        manifest_file = self.backup_dir / f"manifest_{self.timestamp}.json"
        with open(manifest_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"\nBackup manifest saved: {manifest_file}")
        logger.info("=" * 60)
        logger.info("FULL SYSTEM BACKUP COMPLETE")
        logger.info("=" * 60 + "\n")
        
        return results
    
    def restore_backup(self, backup_file: str, restore_to: str = None) -> Tuple[bool, str]:
        """Restore from backup"""
        logger.info(f"Starting restore from: {backup_file}")
        
        try:
            backup_path = Path(backup_file)
            if not backup_path.exists():
                return False, f"Backup file not found: {backup_file}"
            
            restore_dir = restore_to or self.backup_dir / "restore" / self.timestamp
            restore_dir = Path(restore_dir)
            restore_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"Extracting to: {restore_dir}")
            
            if backup_file.endswith('.tar.gz'):
                with tarfile.open(backup_path, "r:gz") as tar:
                    tar.extractall(restore_dir)
            elif backup_file.endswith('.sql.gz'):
                with gzip.open(backup_path, 'rb') as f:
                    sql_file = restore_dir / "database.sql"
                    with open(sql_file, 'wb') as out:
                        out.write(f.read())
            else:
                return False, "Unsupported backup format"
            
            logger.info(f"Restore complete: {restore_dir}")
            return True, str(restore_dir)
        
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False, str(e)
    
    def cleanup_old_backups(self, retention_days: int = 90) -> Dict[str, int]:
        """Remove backups older than retention period"""
        logger.info(f"Cleaning up backups older than {retention_days} days")
        
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        deleted_count = 0
        freed_space = 0
        
        for backup_file in self.backup_dir.glob("*"):
            if backup_file.is_file():
                file_age = datetime.fromtimestamp(backup_file.stat().st_mtime)
                
                if file_age < cutoff_date:
                    freed_space += backup_file.stat().st_size
                    backup_file.unlink()
                    deleted_count += 1
                    logger.info(f"Deleted: {backup_file.name}")
        
        freed_mb = freed_space / (1024 * 1024)
        logger.info(f"Cleanup complete: {deleted_count} backups deleted, {freed_mb:.2f} MB freed")
        
        return {
            'deleted_count': deleted_count,
            'freed_space_mb': freed_mb
        }
    
    def list_backups(self) -> List[Dict[str, Any]]:
        """List all backups"""
        backups = []
        
        for backup_file in sorted(self.backup_dir.glob("*"), reverse=True):
            if backup_file.is_file():
                stat = backup_file.stat()
                backups.append({
                    'filename': backup_file.name,
                    'size_mb': stat.st_size / (1024 * 1024),
                    'created': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'path': str(backup_file)
                })
        
        return backups
    
    def _upload_to_s3(self, file_path: Path):
        """Upload backup to S3"""
        try:
            if not self.s3_enabled:
                return
            
            logger.info(f"Uploading to S3: {file_path.name}")
            
            self.s3_client.upload_file(
                str(file_path),
                self.s3_bucket,
                f"backups/{file_path.name}"
            )
            
            logger.info(f"S3 upload complete: s3://{self.s3_bucket}/backups/{file_path.name}")
        
        except Exception as e:
            logger.error(f"S3 upload failed: {e}")


def main():
    parser = argparse.ArgumentParser(description='Backup Manager')
    parser.add_argument(
        '--action',
        choices=['full', 'wordpress', 'database', 'n8n', 'restore', 'list', 'cleanup'],
        default='full',
        help='Backup action to perform'
    )
    parser.add_argument('--domain', help='WordPress domain')
    parser.add_argument('--file', help='Backup file for restore')
    parser.add_argument('--days', type=int, default=90, help='Retention days')
    parser.add_argument('--s3', action='store_true', help='Enable S3 upload')
    
    args = parser.parse_args()
    
    # Load configuration
    db_config = {
        'host': os.getenv('DATABASE_HOST', 'localhost'),
        'port': int(os.getenv('DATABASE_PORT', 5432)),
        'database': os.getenv('DATABASE_NAME', 'affiliate_db'),
        'user': os.getenv('DATABASE_USER', 'affiliate_user'),
        'password': os.getenv('DATABASE_PASSWORD', '')
    }
    
    domains = [
        'ai-tools-guide.com',
        'freelancer-tools.com',
        'gaming-gear-reviews.com'
    ]
    
    manager = BackupManager(s3_enabled=args.s3)
    
    if args.action == 'full':
        results = manager.backup_full(domains, db_config)
        print(json.dumps(results, indent=2))
    
    elif args.action == 'wordpress':
        if not args.domain:
            logger.error("--domain required for wordpress backup")
            sys.exit(1)
        success, result = manager.backup_wordpress(args.domain)
        print(f"Success: {success}\nPath: {result}")
    
    elif args.action == 'database':
        success, result = manager.backup_database(db_config)
        print(f"Success: {success}\nPath: {result}")
    
    elif args.action == 'n8n':
        success, result = manager.backup_n8n()
        print(f"Success: {success}\nPath: {result}")
    
    elif args.action == 'restore':
        if not args.file:
            logger.error("--file required for restore")
            sys.exit(1)
        success, result = manager.restore_backup(args.file)
        print(f"Success: {success}\nPath: {result}")
    
    elif args.action == 'list':
        backups = manager.list_backups()
        print(json.dumps(backups, indent=2))
    
    elif args.action == 'cleanup':
        result = manager.cleanup_old_backups(args.days)
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
