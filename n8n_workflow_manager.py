#!/usr/bin/env python3
"""
n8n Workflow Manager
====================
Manages importing, deploying, and monitoring n8n workflows
for the affiliate business automation system.

Usage:
    python3 n8n_workflow_manager.py --action import-all
    python3 n8n_workflow_manager.py --action list-workflows
    python3 n8n_workflow_manager.py --action activate-all
    python3 n8n_workflow_manager.py --action test-workflow --id WORKFLOW_ID
"""

import os
import json
import requests
import sys
import argparse
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class N8nWorkflowManager:
    """Manages n8n workflows via API"""
    
    def __init__(self, n8n_url: str, api_key: str):
        self.n8n_url = n8n_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            'X-N8N-API-KEY': api_key,
            'Content-Type': 'application/json'
        }
        
        # Test connection
        if not self._test_connection():
            raise Exception("Failed to connect to n8n. Check URL and API key.")
        
        logger.info(f"Connected to n8n at {self.n8n_url}")
    
    def _test_connection(self) -> bool:
        """Test connection to n8n"""
        try:
            response = requests.get(
                f"{self.n8n_url}/api/v1/workflows",
                headers=self.headers,
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
    
    def list_workflows(self) -> List[Dict[str, Any]]:
        """List all workflows"""
        try:
            response = requests.get(
                f"{self.n8n_url}/api/v1/workflows",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json().get('data', [])
        except Exception as e:
            logger.error(f"Failed to list workflows: {e}")
            return []
    
    def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get specific workflow details"""
        try:
            response = requests.get(
                f"{self.n8n_url}/api/v1/workflows/{workflow_id}",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get workflow {workflow_id}: {e}")
            return None
    
    def create_workflow(self, workflow_data: Dict[str, Any]) -> Optional[str]:
        """Create new workflow, returns workflow ID"""
        try:
            response = requests.post(
                f"{self.n8n_url}/api/v1/workflows",
                headers=self.headers,
                json=workflow_data
            )
            response.raise_for_status()
            workflow_id = response.json().get('id')
            logger.info(f"Created workflow: {workflow_data.get('name')} (ID: {workflow_id})")
            return workflow_id
        except Exception as e:
            logger.error(f"Failed to create workflow: {e}")
            return None
    
    def update_workflow(self, workflow_id: str, workflow_data: Dict[str, Any]) -> bool:
        """Update existing workflow"""
        try:
            response = requests.put(
                f"{self.n8n_url}/api/v1/workflows/{workflow_id}",
                headers=self.headers,
                json=workflow_data
            )
            response.raise_for_status()
            logger.info(f"Updated workflow {workflow_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to update workflow {workflow_id}: {e}")
            return False
    
    def activate_workflow(self, workflow_id: str) -> bool:
        """Activate workflow"""
        try:
            response = requests.patch(
                f"{self.n8n_url}/api/v1/workflows/{workflow_id}/activate",
                headers=self.headers
            )
            response.raise_for_status()
            logger.info(f"Activated workflow {workflow_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to activate workflow {workflow_id}: {e}")
            return False
    
    def deactivate_workflow(self, workflow_id: str) -> bool:
        """Deactivate workflow"""
        try:
            response = requests.patch(
                f"{self.n8n_url}/api/v1/workflows/{workflow_id}/deactivate",
                headers=self.headers
            )
            response.raise_for_status()
            logger.info(f"Deactivated workflow {workflow_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to deactivate workflow {workflow_id}: {e}")
            return False
    
    def delete_workflow(self, workflow_id: str) -> bool:
        """Delete workflow"""
        try:
            response = requests.delete(
                f"{self.n8n_url}/api/v1/workflows/{workflow_id}",
                headers=self.headers
            )
            response.raise_for_status()
            logger.info(f"Deleted workflow {workflow_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete workflow {workflow_id}: {e}")
            return False
    
    def get_workflow_executions(self, workflow_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get execution history for workflow"""
        try:
            response = requests.get(
                f"{self.n8n_url}/api/v1/workflows/{workflow_id}/executions",
                headers=self.headers,
                params={'limit': limit}
            )
            response.raise_for_status()
            return response.json().get('data', [])
        except Exception as e:
            logger.error(f"Failed to get executions for {workflow_id}: {e}")
            return []
    
    def test_workflow(self, workflow_id: str) -> bool:
        """Test run a workflow"""
        try:
            response = requests.post(
                f"{self.n8n_url}/api/v1/workflows/{workflow_id}/test",
                headers=self.headers
            )
            response.raise_for_status()
            logger.info(f"Test execution started for workflow {workflow_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to test workflow {workflow_id}: {e}")
            return False


class WorkflowTemplateManager:
    """Manages workflow templates"""
    
    @staticmethod
    def wordpress_publisher_workflow(domain: str, niche: str) -> Dict[str, Any]:
        """Generate WordPress auto-publisher workflow"""
        return {
            "name": f"WordPress Auto-Publisher - {niche}",
            "description": f"Automatically publish articles to {domain}",
            "nodes": [
                {
                    "id": "trigger_daily",
                    "type": "Schedule",
                    "position": [100, 300],
                    "parameters": {
                        "triggerTimes": {
                            "item": [{"mode": "everyDay", "hour": 6, "minute": 0}]
                        }
                    }
                },
                {
                    "id": "http_request_openclaw",
                    "type": "HttpRequest",
                    "position": [300, 300],
                    "parameters": {
                        "method": "POST",
                        "url": "https://api.openclaw.io/v1/generate",
                        "headerParameters": {
                            "parameters": [
                                {
                                    "name": "Authorization",
                                    "value": "Bearer {{ $env.OPENCLAW_API_KEY }}"
                                }
                            ]
                        },
                        "bodyContentType": "applicationJson",
                        "body": json.dumps({
                            "niche": niche,
                            "type": "blog_article",
                            "wordCount": 1500,
                            "includeAffiliate": True,
                            "seoOptimized": True
                        })
                    }
                },
                {
                    "id": "wordpress_post",
                    "type": "WordPress",
                    "position": [500, 300],
                    "parameters": {
                        "operation": "create",
                        "url": f"https://{domain}",
                        "title": "={{ $node.http_request_openclaw.json.title }}",
                        "content": "={{ $node.http_request_openclaw.json.content }}",
                        "status": "publish"
                    }
                },
                {
                    "id": "slack_notification",
                    "type": "Slack",
                    "position": [700, 300],
                    "parameters": {
                        "text": "🚀 New article published: {{ $node.http_request_openclaw.json.title }} on {{ $node.wordpress_post.json.link }}"
                    }
                }
            ],
            "connections": {
                "trigger_daily": {"main": [[{"node": "http_request_openclaw", "type": "main", "index": 0}]]},
                "http_request_openclaw": {"main": [[{"node": "wordpress_post", "type": "main", "index": 0}]]},
                "wordpress_post": {"main": [[{"node": "slack_notification", "type": "main", "index": 0}]]}
            }
        }
    
    @staticmethod
    def social_media_distributor() -> Dict[str, Any]:
        """Generate social media distribution workflow"""
        return {
            "name": "Social Media Distributor",
            "description": "Distribute articles to LinkedIn, Reddit, Facebook, Twitter, Pinterest",
            "nodes": [
                {
                    "id": "webhook_trigger",
                    "type": "Webhook",
                    "position": [100, 300],
                    "parameters": {
                        "path": "article-published"
                    }
                },
                {
                    "id": "generate_variants",
                    "type": "OpenAI",
                    "position": [300, 300],
                    "parameters": {
                        "operation": "send",
                        "model": "gpt-4",
                        "prompt": "Create LinkedIn, Reddit, Facebook, Twitter variants of this article: {{ $json.content }}"
                    }
                },
                {
                    "id": "linkedin_post",
                    "type": "LinkedIn",
                    "position": [500, 100],
                    "parameters": {
                        "text": "={{ $node.generate_variants.json.linkedinVersion }}"
                    }
                },
                {
                    "id": "reddit_post",
                    "type": "Reddit",
                    "position": [500, 300],
                    "parameters": {
                        "subreddit": "your_subreddit",
                        "title": "={{ $json.title }}",
                        "text": "={{ $node.generate_variants.json.redditVersion }}"
                    }
                },
                {
                    "id": "facebook_post",
                    "type": "Facebook",
                    "position": [500, 500],
                    "parameters": {
                        "message": "={{ $node.generate_variants.json.facebookVersion }}"
                    }
                },
                {
                    "id": "twitter_post",
                    "type": "Twitter",
                    "position": [700, 100],
                    "parameters": {
                        "text": "={{ $node.generate_variants.json.twitterVersion }}"
                    }
                }
            ],
            "connections": {
                "webhook_trigger": {"main": [[{"node": "generate_variants", "type": "main", "index": 0}]]},
                "generate_variants": {"main": [
                    [
                        {"node": "linkedin_post", "type": "main", "index": 0},
                        {"node": "reddit_post", "type": "main", "index": 0},
                        {"node": "facebook_post", "type": "main", "index": 0},
                        {"node": "twitter_post", "type": "main", "index": 0}
                    ]
                ]}
            }
        }
    
    @staticmethod
    def affiliate_link_tracker() -> Dict[str, Any]:
        """Generate affiliate link performance tracker"""
        return {
            "name": "Affiliate Link Performance Tracker",
            "description": "Track clicks, conversions, and revenue from affiliate links",
            "nodes": [
                {
                    "id": "schedule_daily",
                    "type": "Schedule",
                    "position": [100, 300],
                    "parameters": {
                        "triggerTimes": {
                            "item": [{"mode": "everyDay", "hour": 22, "minute": 0}]
                        }
                    }
                },
                {
                    "id": "fetch_awin",
                    "type": "HttpRequest",
                    "position": [300, 200],
                    "parameters": {
                        "method": "GET",
                        "url": "https://api.awin.com/advertisers/ADVERTISER_ID/stats",
                        "headerParameters": {
                            "parameters": [
                                {"name": "Authorization", "value": "Bearer {{ $env.AWIN_API_KEY }}"}
                            ]
                        }
                    }
                },
                {
                    "id": "fetch_shareasale",
                    "type": "HttpRequest",
                    "position": [300, 400],
                    "parameters": {
                        "method": "GET",
                        "url": "https://www.shareasale.com/api/stats",
                        "auth": {
                            "type": "basicAuth",
                            "user": "{{ $env.SHAREASALE_USER }}",
                            "password": "{{ $env.SHAREASALE_PASS }}"
                        }
                    }
                },
                {
                    "id": "save_to_postgres",
                    "type": "Postgres",
                    "position": [500, 300],
                    "parameters": {
                        "operation": "insert",
                        "schema": "public",
                        "table": "affiliate_metrics",
                        "columns": ["date", "network", "clicks", "conversions", "revenue"],
                        "values": [
                            "NOW()",
                            "{{ $node.fetch_awin.json.network }}",
                            "={{ $node.fetch_awin.json.clicks + $node.fetch_shareasale.json.clicks }}",
                            "={{ $node.fetch_awin.json.conversions + $node.fetch_shareasale.json.conversions }}",
                            "={{ $node.fetch_awin.json.revenue + $node.fetch_shareasale.json.revenue }}"
                        ]
                    }
                },
                {
                    "id": "update_dashboard",
                    "type": "HttpRequest",
                    "position": [700, 300],
                    "parameters": {
                        "method": "POST",
                        "url": "{{ $env.DASHBOARD_WEBHOOK_URL }}",
                        "body": {
                            "metrics": "={{ $node.save_to_postgres.json }}"
                        }
                    }
                }
            ]
        }


def main():
    parser = argparse.ArgumentParser(
        description='n8n Workflow Manager for Affiliate Automation'
    )
    parser.add_argument(
        '--url',
        default=os.getenv('N8N_URL', 'http://localhost:5678'),
        help='n8n instance URL'
    )
    parser.add_argument(
        '--api-key',
        default=os.getenv('N8N_API_KEY', ''),
        help='n8n API key'
    )
    parser.add_argument(
        '--action',
        required=True,
        choices=[
            'import-all',
            'list-workflows',
            'activate-all',
            'deactivate-all',
            'test-all',
            'get-status',
            'cleanup'
        ],
        help='Action to perform'
    )
    parser.add_argument(
        '--id',
        help='Workflow ID (for specific operations)'
    )
    
    args = parser.parse_args()
    
    if not args.api_key:
        logger.error("N8N_API_KEY environment variable or --api-key required")
        sys.exit(1)
    
    try:
        manager = N8nWorkflowManager(args.url, args.api_key)
    except Exception as e:
        logger.error(f"Failed to initialize manager: {e}")
        sys.exit(1)
    
    # Execute action
    if args.action == 'import-all':
        logger.info("Importing all workflows...")
        
        # Create WordPress publishers for each niche
        niches = [
            ('ai-tools-guide.com', 'AI Tools'),
            ('freelancer-tools.com', 'Freelancer Tools'),
            ('gaming-gear-reviews.com', 'Gaming')
        ]
        
        for domain, niche in niches:
            workflow = WorkflowTemplateManager.wordpress_publisher_workflow(domain, niche)
            manager.create_workflow(workflow)
            time.sleep(0.5)
        
        # Create social media distributor
        workflow = WorkflowTemplateManager.social_media_distributor()
        manager.create_workflow(workflow)
        
        # Create affiliate tracker
        workflow = WorkflowTemplateManager.affiliate_link_tracker()
        manager.create_workflow(workflow)
        
        logger.info("✅ All workflows imported successfully!")
    
    elif args.action == 'list-workflows':
        workflows = manager.list_workflows()
        logger.info(f"Found {len(workflows)} workflows:")
        for wf in workflows:
            status = "✅ Active" if wf.get('active') else "⏸️ Inactive"
            logger.info(f"  - {wf['name']} ({status})")
    
    elif args.action == 'activate-all':
        workflows = manager.list_workflows()
        for wf in workflows:
            manager.activate_workflow(wf['id'])
            time.sleep(0.5)
        logger.info(f"✅ Activated {len(workflows)} workflows")
    
    elif args.action == 'deactivate-all':
        workflows = manager.list_workflows()
        for wf in workflows:
            manager.deactivate_workflow(wf['id'])
            time.sleep(0.5)
        logger.info(f"✅ Deactivated {len(workflows)} workflows")
    
    elif args.action == 'test-all':
        workflows = manager.list_workflows()
        for wf in workflows:
            logger.info(f"Testing {wf['name']}...")
            manager.test_workflow(wf['id'])
            time.sleep(1)
        logger.info("✅ All workflows tested")
    
    elif args.action == 'get-status':
        workflows = manager.list_workflows()
        logger.info("Workflow Status Report:")
        logger.info("=" * 60)
        for wf in workflows:
            executions = manager.get_workflow_executions(wf['id'], limit=3)
            last_run = executions[0]['finishedAt'] if executions else 'Never'
            status = "✅" if wf.get('active') else "⏸️"
            logger.info(f"{status} {wf['name']}")
            logger.info(f"   Last run: {last_run}")
    
    elif args.action == 'cleanup':
        logger.warning("This will delete all workflows!")
        confirm = input("Type 'yes' to confirm: ")
        if confirm.lower() == 'yes':
            workflows = manager.list_workflows()
            for wf in workflows:
                manager.delete_workflow(wf['id'])
                time.sleep(0.5)
            logger.info(f"✅ Deleted {len(workflows)} workflows")


if __name__ == '__main__':
    main()
