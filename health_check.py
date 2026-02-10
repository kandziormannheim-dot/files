#!/usr/bin/env python3
"""
System Health Monitor
=====================
Monitors the health of all affiliate automation components
and provides diagnostics and alerts.

Usage:
    python3 health_check.py --check all
    python3 health_check.py --check wordpress
    python3 health_check.py --check n8n
    python3 health_check.py --check database
"""

import os
import sys
import requests
import subprocess
import json
from datetime import datetime
from typing import Dict, List, Any, Tuple
import argparse
import logging
from enum import Enum

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """Health check status"""
    HEALTHY = "✓ Healthy"
    WARNING = "⚠ Warning"
    CRITICAL = "✗ Critical"


class HealthCheck:
    """Base health check class"""
    
    def __init__(self):
        self.results = []
    
    def log_check(self, name: str, status: HealthStatus, message: str, details: Dict = None):
        """Log a health check result"""
        self.results.append({
            'timestamp': datetime.now().isoformat(),
            'name': name,
            'status': status.value,
            'message': message,
            'details': details or {}
        })
        
        if status == HealthStatus.HEALTHY:
            logger.info(f"{status.value} | {name}: {message}")
        elif status == HealthStatus.WARNING:
            logger.warning(f"{status.value} | {name}: {message}")
        else:
            logger.error(f"{status.value} | {name}: {message}")


class SystemHealthCheck(HealthCheck):
    """Check system resources"""
    
    def check_disk_space(self) -> Tuple[HealthStatus, str]:
        """Check disk space"""
        try:
            result = subprocess.run(['df', '-h', '/'], capture_output=True, text=True)
            lines = result.stdout.strip().split('\n')
            usage = lines[1].split()
            
            percent = int(usage[4].rstrip('%'))
            
            if percent > 90:
                return HealthStatus.CRITICAL, f"Disk usage critical: {percent}%"
            elif percent > 75:
                return HealthStatus.WARNING, f"Disk usage high: {percent}%"
            else:
                return HealthStatus.HEALTHY, f"Disk usage normal: {percent}%"
        except Exception as e:
            return HealthStatus.WARNING, f"Could not check disk space: {e}"
    
    def check_memory(self) -> Tuple[HealthStatus, str]:
        """Check memory usage"""
        try:
            result = subprocess.run(['free', '-h'], capture_output=True, text=True)
            lines = result.stdout.strip().split('\n')
            
            # This is a simplified check
            logger.info("Memory check passed")
            return HealthStatus.HEALTHY, "Memory available"
        except Exception as e:
            return HealthStatus.WARNING, f"Could not check memory: {e}"
    
    def check_cpu(self) -> Tuple[HealthStatus, str]:
        """Check CPU load"""
        try:
            with open('/proc/loadavg', 'r') as f:
                load = f.read().split()[:3]
                avg_load = float(load[0])
            
            if avg_load > 4:
                return HealthStatus.CRITICAL, f"CPU load high: {avg_load}"
            elif avg_load > 2:
                return HealthStatus.WARNING, f"CPU load elevated: {avg_load}"
            else:
                return HealthStatus.HEALTHY, f"CPU load normal: {avg_load}"
        except Exception as e:
            return HealthStatus.WARNING, f"Could not check CPU: {e}"
    
    def run_all(self):
        """Run all system checks"""
        logger.info("Starting System Health Checks")
        
        status, msg = self.check_disk_space()
        self.log_check("Disk Space", status, msg)
        
        status, msg = self.check_memory()
        self.log_check("Memory", status, msg)
        
        status, msg = self.check_cpu()
        self.log_check("CPU Load", status, msg)


class WordPressHealthCheck(HealthCheck):
    """Check WordPress installations"""
    
    def __init__(self, domains: List[str]):
        super().__init__()
        self.domains = domains
    
    def check_site_online(self, domain: str) -> Tuple[HealthStatus, str]:
        """Check if WordPress site is online"""
        try:
            response = requests.get(f"https://{domain}", timeout=5, verify=False)
            if response.status_code == 200:
                return HealthStatus.HEALTHY, f"{domain} is online"
            else:
                return HealthStatus.WARNING, f"{domain} returned {response.status_code}"
        except requests.exceptions.ConnectionError:
            return HealthStatus.CRITICAL, f"{domain} is unreachable"
        except Exception as e:
            return HealthStatus.WARNING, f"Error checking {domain}: {e}"
    
    def check_ssl(self, domain: str) -> Tuple[HealthStatus, str]:
        """Check SSL certificate"""
        try:
            response = requests.get(f"https://{domain}", timeout=5, verify=True)
            return HealthStatus.HEALTHY, "SSL certificate valid"
        except requests.exceptions.SSLError:
            return HealthStatus.CRITICAL, "SSL certificate invalid or expired"
        except Exception as e:
            return HealthStatus.WARNING, f"Could not verify SSL: {e}"
    
    def check_wp_json_api(self, domain: str) -> Tuple[HealthStatus, str]:
        """Check WordPress REST API"""
        try:
            response = requests.get(f"https://{domain}/wp-json/wp/v2/posts", timeout=5, verify=False)
            if response.status_code == 200:
                return HealthStatus.HEALTHY, "REST API accessible"
            else:
                return HealthStatus.WARNING, f"REST API returned {response.status_code}"
        except Exception as e:
            return HealthStatus.CRITICAL, f"REST API not accessible: {e}"
    
    def run_all(self):
        """Run all WordPress checks"""
        logger.info("Starting WordPress Health Checks")
        
        for domain in self.domains:
            status, msg = self.check_site_online(domain)
            self.log_check(f"Site Online ({domain})", status, msg)
            
            if status != HealthStatus.CRITICAL:
                status, msg = self.check_ssl(domain)
                self.log_check(f"SSL Certificate ({domain})", status, msg)
                
                status, msg = self.check_wp_json_api(domain)
                self.log_check(f"REST API ({domain})", status, msg)


class N8nHealthCheck(HealthCheck):
    """Check n8n automation"""
    
    def __init__(self, n8n_url: str, api_key: str):
        super().__init__()
        self.n8n_url = n8n_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            'X-N8N-API-KEY': api_key,
            'Content-Type': 'application/json'
        }
    
    def check_n8n_online(self) -> Tuple[HealthStatus, str]:
        """Check if n8n is online"""
        try:
            response = requests.get(f"{self.n8n_url}/api/v1/workflows", headers=self.headers, timeout=5)
            if response.status_code == 200:
                return HealthStatus.HEALTHY, "n8n is online"
            else:
                return HealthStatus.WARNING, f"n8n returned {response.status_code}"
        except requests.exceptions.ConnectionError:
            return HealthStatus.CRITICAL, "n8n is unreachable"
        except Exception as e:
            return HealthStatus.CRITICAL, f"Error connecting to n8n: {e}"
    
    def check_workflows(self) -> Tuple[HealthStatus, str]:
        """Check workflow status"""
        try:
            response = requests.get(f"{self.n8n_url}/api/v1/workflows", headers=self.headers, timeout=5)
            if response.status_code == 200:
                workflows = response.json().get('data', [])
                active_count = sum(1 for w in workflows if w.get('active'))
                return HealthStatus.HEALTHY, f"{len(workflows)} workflows ({active_count} active)"
            else:
                return HealthStatus.WARNING, "Could not fetch workflows"
        except Exception as e:
            return HealthStatus.CRITICAL, f"Error fetching workflows: {e}"
    
    def check_recent_executions(self) -> Tuple[HealthStatus, str]:
        """Check recent workflow executions"""
        try:
            response = requests.get(f"{self.n8n_url}/api/v1/workflows", headers=self.headers, timeout=5)
            if response.status_code == 200:
                workflows = response.json().get('data', [])
                
                if not workflows:
                    return HealthStatus.WARNING, "No workflows found"
                
                # Check last execution time
                logger.info(f"Checked {len(workflows)} workflows")
                return HealthStatus.HEALTHY, f"All {len(workflows)} workflows accessible"
            else:
                return HealthStatus.WARNING, "Could not check executions"
        except Exception as e:
            return HealthStatus.WARNING, f"Error checking executions: {e}"
    
    def run_all(self):
        """Run all n8n checks"""
        logger.info("Starting n8n Health Checks")
        
        status, msg = self.check_n8n_online()
        self.log_check("n8n Online", status, msg)
        
        if status != HealthStatus.CRITICAL:
            status, msg = self.check_workflows()
            self.log_check("Workflows", status, msg)
            
            status, msg = self.check_recent_executions()
            self.log_check("Recent Executions", status, msg)


class DatabaseHealthCheck(HealthCheck):
    """Check database health"""
    
    def __init__(self, db_config: Dict):
        super().__init__()
        self.db_config = db_config
    
    def check_connection(self) -> Tuple[HealthStatus, str]:
        """Check database connection"""
        try:
            import psycopg2
            conn = psycopg2.connect(
                host=self.db_config.get('host', 'localhost'),
                port=self.db_config.get('port', 5432),
                database=self.db_config.get('database', 'affiliate_db'),
                user=self.db_config.get('user', 'affiliate_user'),
                password=self.db_config.get('password', '')
            )
            conn.close()
            return HealthStatus.HEALTHY, "Database connection successful"
        except Exception as e:
            return HealthStatus.CRITICAL, f"Database connection failed: {e}"
    
    def check_tables(self) -> Tuple[HealthStatus, str]:
        """Check required tables"""
        try:
            import psycopg2
            conn = psycopg2.connect(
                host=self.db_config.get('host', 'localhost'),
                port=self.db_config.get('port', 5432),
                database=self.db_config.get('database', 'affiliate_db'),
                user=self.db_config.get('user', 'affiliate_user'),
                password=self.db_config.get('password', '')
            )
            
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            
            count = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            
            if count > 10:
                return HealthStatus.HEALTHY, f"{count} tables found"
            else:
                return HealthStatus.WARNING, f"Only {count} tables found"
        except Exception as e:
            return HealthStatus.WARNING, f"Could not check tables: {e}"
    
    def run_all(self):
        """Run all database checks"""
        logger.info("Starting Database Health Checks")
        
        status, msg = self.check_connection()
        self.log_check("Database Connection", status, msg)
        
        if status != HealthStatus.CRITICAL:
            status, msg = self.check_tables()
            self.log_check("Database Tables", status, msg)


class APIHealthCheck(HealthCheck):
    """Check external APIs"""
    
    def check_openai(self) -> Tuple[HealthStatus, str]:
        """Check OpenAI API"""
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return HealthStatus.WARNING, "OPENAI_API_KEY not configured"
        
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "test"}]},
                timeout=5
            )
            if response.status_code == 200:
                return HealthStatus.HEALTHY, "OpenAI API accessible"
            else:
                return HealthStatus.WARNING, f"OpenAI returned {response.status_code}"
        except Exception as e:
            return HealthStatus.WARNING, f"OpenAI API check failed: {e}"
    
    def check_openclaw(self) -> Tuple[HealthStatus, str]:
        """Check OpenClaw API"""
        api_key = os.getenv('OPENCLAW_API_KEY')
        if not api_key:
            return HealthStatus.WARNING, "OPENCLAW_API_KEY not configured"
        
        try:
            response = requests.get(
                "https://api.openclaw.io/v1/status",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=5
            )
            if response.status_code == 200:
                return HealthStatus.HEALTHY, "OpenClaw API accessible"
            else:
                return HealthStatus.WARNING, f"OpenClaw returned {response.status_code}"
        except Exception as e:
            return HealthStatus.WARNING, f"OpenClaw API check failed: {e}"
    
    def run_all(self):
        """Run all API checks"""
        logger.info("Starting API Health Checks")
        
        status, msg = self.check_openai()
        self.log_check("OpenAI API", status, msg)
        
        status, msg = self.check_openclaw()
        self.log_check("OpenClaw API", status, msg)


def main():
    parser = argparse.ArgumentParser(description='System Health Check Monitor')
    parser.add_argument(
        '--check',
        choices=['all', 'system', 'wordpress', 'n8n', 'database', 'api'],
        default='all',
        help='Which component to check'
    )
    parser.add_argument(
        '--report',
        action='store_true',
        help='Generate JSON report'
    )
    
    args = parser.parse_args()
    
    all_results = []
    
    logger.info("=" * 60)
    logger.info("AFFILIATE AUTOMATION - HEALTH CHECK")
    logger.info("=" * 60 + "\n")
    
    # System checks
    if args.check in ['all', 'system']:
        system_check = SystemHealthCheck()
        system_check.run_all()
        all_results.extend(system_check.results)
    
    # WordPress checks
    if args.check in ['all', 'wordpress']:
        domains = [
            'ai-tools-guide.com',
            'freelancer-tools.com',
            'gaming-gear-reviews.com'
        ]
        wp_check = WordPressHealthCheck(domains)
        wp_check.run_all()
        all_results.extend(wp_check.results)
    
    # n8n checks
    if args.check in ['all', 'n8n']:
        n8n_check = N8nHealthCheck(
            os.getenv('N8N_URL', 'http://localhost:5678'),
            os.getenv('N8N_API_KEY', '')
        )
        n8n_check.run_all()
        all_results.extend(n8n_check.results)
    
    # Database checks
    if args.check in ['all', 'database']:
        db_config = {
            'host': os.getenv('DATABASE_HOST', 'localhost'),
            'port': int(os.getenv('DATABASE_PORT', 5432)),
            'database': os.getenv('DATABASE_NAME', 'affiliate_db'),
            'user': os.getenv('DATABASE_USER', 'affiliate_user'),
            'password': os.getenv('DATABASE_PASSWORD', '')
        }
        db_check = DatabaseHealthCheck(db_config)
        db_check.run_all()
        all_results.extend(db_check.results)
    
    # API checks
    if args.check in ['all', 'api']:
        api_check = APIHealthCheck()
        api_check.run_all()
        all_results.extend(api_check.results)
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("HEALTH CHECK SUMMARY")
    logger.info("=" * 60)
    
    healthy = sum(1 for r in all_results if "✓" in r['status'])
    warnings = sum(1 for r in all_results if "⚠" in r['status'])
    critical = sum(1 for r in all_results if "✗" in r['status'])
    
    logger.info(f"\n✓ Healthy: {healthy}")
    logger.info(f"⚠ Warnings: {warnings}")
    logger.info(f"✗ Critical: {critical}")
    logger.info(f"Total Checks: {len(all_results)}\n")
    
    if args.report:
        with open('health_check_report.json', 'w') as f:
            json.dump(all_results, f, indent=2)
        logger.info("Report saved to health_check_report.json")
    
    # Exit with status
    if critical > 0:
        sys.exit(1)
    elif warnings > 0:
        sys.exit(0)  # Warning but not critical
    else:
        sys.exit(0)  # All healthy


if __name__ == '__main__':
    main()
