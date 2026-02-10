import React, { useState, useEffect } from 'react';
import { Activity, Settings, BarChart3, Zap, Database, Share2, Link2, TrendingUp, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function AffiliateAutomationDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    totalRevenue: 2847,
    conversions: 142,
    content: { published: 42, scheduled: 18 },
    traffic: 12843,
    affiliateLinks: { active: 23, tracked: 23 },
    workflows: { active: 8, status: 'healthy' }
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'content', label: 'Content', icon: Database },
    { id: 'workflows', label: 'n8n Workflows', icon: Zap },
    { id: 'social', label: 'Social Media', icon: Share2 },
    { id: 'affiliates', label: 'Affiliates', icon: Link2 },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const sites = [
    { name: 'AI Tools Guide', domain: 'ai-tools-guide.com', status: 'active', traffic: 4250, revenue: 1240 },
    { name: 'Freelancer Tools Hub', domain: 'freelancer-tools.com', status: 'active', traffic: 5100, revenue: 1350 },
    { name: 'Gaming Gear Reviews', domain: 'gaming-gear-reviews.com', status: 'active', traffic: 3493, revenue: 257 }
  ];

  const workflows = [
    { name: 'WordPress Auto-Publisher (AI Tools)', status: 'active', lastRun: '2025-02-10 06:00', nextRun: '2025-02-11 06:00', articlesGenerated: 142 },
    { name: 'WordPress Auto-Publisher (Freelancer)', status: 'active', lastRun: '2025-02-10 06:05', nextRun: '2025-02-11 06:05', articlesGenerated: 156 },
    { name: 'WordPress Auto-Publisher (Gaming)', status: 'active', lastRun: '2025-02-10 06:10', nextRun: '2025-02-11 06:10', articlesGenerated: 89 },
    { name: 'Social Media Distributor', status: 'active', lastRun: '2025-02-10 04:00', nextRun: '2025-02-10 08:00', articlesGenerated: 0 },
    { name: 'Affiliate Link Tracker', status: 'active', lastRun: '2025-02-09 22:00', nextRun: '2025-02-10 22:00', articlesGenerated: 0 },
    { name: 'Email Newsletter', status: 'paused', lastRun: '2025-02-05 09:00', nextRun: '2025-02-12 09:00', articlesGenerated: 0 },
    { name: 'SEO Monitoring', status: 'active', lastRun: '2025-02-10 12:00', nextRun: '2025-02-11 12:00', articlesGenerated: 0 },
    { name: 'Backup Automation', status: 'active', lastRun: '2025-02-10 02:00', nextRun: '2025-02-11 02:00', articlesGenerated: 0 }
  ];

  const affiliatePrograms = [
    { name: 'Jasper AI', commission: '30% recurring', links: 12, clicks: 234, conversions: 8, revenue: 960 },
    { name: 'Copy.ai', commission: '25% recurring', links: 11, clicks: 189, conversions: 5, revenue: 425 },
    { name: 'Monday.com', commission: '25-30% recurring', links: 8, clicks: 156, conversions: 4, revenue: 320 },
    { name: 'ClickUp', commission: '30% recurring', links: 9, clicks: 201, conversions: 6, revenue: 540 },
    { name: 'Amazon Associates', commission: '3-10%', links: 45, clicks: 842, conversions: 98, revenue: 602 },
    { name: 'HeyGen', commission: '25%', links: 7, clicks: 89, conversions: 3, revenue: 180 }
  ];

  const socialAccounts = [
    { platform: 'LinkedIn', followers: 2847, posts: 42, engagement: 8.2, status: 'connected' },
    { platform: 'Reddit', followers: 1240, posts: 156, engagement: 12.5, status: 'connected' },
    { platform: 'Facebook', followers: 3456, posts: 67, engagement: 5.3, status: 'connected' },
    { platform: 'Twitter', followers: 890, posts: 234, engagement: 4.1, status: 'connected' },
    { platform: 'Pinterest', followers: 4521, posts: 89, engagement: 9.7, status: 'connected' }
  ];

  const refreshData = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1500));
    setRefreshing(false);
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', minHeight: '100vh', color: '#e2e8f0' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #334155', padding: '20px', background: 'rgba(15, 23, 42, 0.8)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#f1f5f9' }}>Affiliate Business Automation</h1>
            <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>Master Control Dashboard</p>
          </div>
          <button 
            onClick={refreshData}
            disabled={refreshing}
            style={{
              padding: '10px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: refreshing ? 0.6 : 1
            }}
          >
            {refreshing ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav style={{ background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid #334155', overflowX: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '0' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '16px 20px',
                  background: activeTab === tab.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '1px solid #334155',
                  color: activeTab === tab.id ? '#3b82f6' : '#94a3b8',
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  transition: 'all 0.3s'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div>
            {/* Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <MetricCard label="Total Revenue (30d)" value={`€${metrics.totalRevenue.toLocaleString()}`} trend="+24%" icon={TrendingUp} />
              <MetricCard label="Conversions" value={metrics.conversions} trend="+15%" icon={CheckCircle} />
              <MetricCard label="Unique Visitors" value={metrics.traffic.toLocaleString()} trend="+38%" icon={Activity} />
              <MetricCard label="Active Workflows" value={metrics.workflows.active} status="healthy" icon={Zap} />
            </div>

            {/* Sites Overview */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>Your Sites</h2>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
                {sites.map((site, i) => (
                  <div 
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      borderBottom: i < sites.length - 1 ? '1px solid #334155' : 'none'
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{site.name}</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>{site.domain}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Traffic</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 'bold' }}>{site.traffic.toLocaleString()}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Revenue (30d)</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>€{site.revenue}</p>
                      </div>
                      <div>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '4px 12px',
                          background: '#10b981',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {site.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Status */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <StatusBox title="Content Generation" items={['✅ 387 articles published', '⏱️ 18 scheduled for this week', '📊 Avg. 2 articles/day']} />
              <StatusBox title="Affiliate Performance" items={['💰 €2,847 this month', '📈 23 active programs', '🎯 142 conversions']} />
              <StatusBox title="System Health" items={['✅ 8/8 workflows running', '💚 All domains healthy', '🔒 SSL certified']} />
            </div>
          </div>
        )}

        {/* CONTENT TAB */}
        {activeTab === 'content' && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Content Management</h2>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid #334155', padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
                  Articles Published This Month
                </label>
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ background: '#3b82f6', height: '100%', width: '72%' }}></div>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>387 / 540 articles (72%)</p>
              </div>

              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Content by Niche</h3>
              {[
                { niche: 'AI Tools Guide', articles: 156, seo: 'Good', status: 'publishing' },
                { niche: 'Freelancer Tools', articles: 167, seo: 'Excellent', status: 'publishing' },
                { niche: 'Gaming Gear Reviews', articles: 89, seo: 'Good', status: 'publishing' }
              ].map((item, i) => (
                <div 
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: i % 2 === 0 ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{item.niche}</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>SEO: {item.seo}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{item.articles} articles</p>
                    <span style={{ fontSize: '11px', padding: '2px 8px', background: '#3b82f6', borderRadius: '12px', color: 'white', marginTop: '4px', display: 'inline-block' }}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WORKFLOWS TAB */}
        {activeTab === 'workflows' && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>n8n Automation Workflows</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {workflows.map((wf, i) => (
                <div 
                  key={i}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{wf.name}</h3>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                      Last run: {wf.lastRun} | Next run: {wf.nextRun}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {wf.articlesGenerated > 0 && (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{wf.articlesGenerated} articles</span>
                    )}
                    <span 
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: wf.status === 'active' ? '#10b981' : '#f59e0b',
                        color: wf.status === 'active' ? '#065f46' : '#92400e'
                      }}
                    >
                      {wf.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SOCIAL MEDIA TAB */}
        {activeTab === 'social' && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Social Media Accounts</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {socialAccounts.map((social, i) => (
                <div 
                  key={i}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    padding: '16px'
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{social.platform}</h3>
                  <div style={{ margin: '12px 0 0 0' }}>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Followers: <strong style={{ color: '#e2e8f0' }}>{social.followers.toLocaleString()}</strong></p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Posts: <strong style={{ color: '#e2e8f0' }}>{social.posts}</strong></p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Engagement: <strong style={{ color: '#10b981' }}>{social.engagement}%</strong></p>
                    <span 
                      style={{
                        display: 'inline-block',
                        marginTop: '8px',
                        padding: '4px 12px',
                        background: '#10b981',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}
                    >
                      ✓ {social.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AFFILIATES TAB */}
        {activeTab === 'affiliates' && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Affiliate Program Performance</h2>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', background: 'rgba(15, 23, 42, 0.5)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Program</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Commission</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Links</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Clicks</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Conversions</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliatePrograms.map((prog, i) => (
                    <tr 
                      key={i}
                      style={{
                        borderBottom: i < affiliatePrograms.length - 1 ? '1px solid #334155' : 'none',
                        background: i % 2 === 0 ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '12px' }}>{prog.name}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#94a3b8' }}>{prog.commission}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{prog.links}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{prog.clicks}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{prog.conversions}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>€{prog.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Analytics & Performance</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <AnalyticsCard 
                title="Revenue Trend"
                description="Last 30 days"
                value="€2,847"
                change="+24%"
                trend="up"
              />
              <AnalyticsCard 
                title="Conversion Rate"
                description="All sources"
                value="2.1%"
                change="+0.3%"
                trend="up"
              />
              <AnalyticsCard 
                title="Traffic Sources"
                description="Organic + Social"
                value="12.8k"
                change="+38%"
                trend="up"
              />
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Settings & Configuration</h2>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid #334155', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>API Keys & Integrations</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {[
                  { name: 'OpenClaw API', status: 'connected', value: '••••••••' },
                  { name: 'n8n API', status: 'connected', value: '••••••••' },
                  { name: 'WordPress Admin', status: 'active', value: '••••••••' },
                  { name: 'Plesk Admin', status: 'active', value: '••••••••' }
                ].map((item, i) => (
                  <div 
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      background: 'rgba(15, 23, 42, 0.5)',
                      borderRadius: '4px',
                      borderLeft: `3px solid ${item.status === 'connected' || item.status === 'active' ? '#10b981' : '#f59e0b'}`
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{item.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <code style={{ fontSize: '12px', color: '#94a3b8' }}>{item.value}</code>
                      <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', background: item.status === 'connected' ? '#10b981' : '#3b82f6', color: 'white', fontWeight: '600' }}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px' }}>System Configuration</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <ConfigItem label="OpenClaw Content Generation" value="2 articles/day" action="Edit" />
                <ConfigItem label="Social Media Posting" value="5 platforms active" action="Manage" />
                <ConfigItem label="Workflow Status" value="8/8 active" action="Monitor" />
                <ConfigItem label="Backup Schedule" value="Daily at 2 AM" action="Configure" />
              </div>

              <button style={{ 
                marginTop: '24px',
                padding: '12px 24px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                Save All Changes
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function MetricCard({ label, value, trend, icon: Icon, status }) {
  return (
    <div style={{
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }}>
      <div>
        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>{label}</p>
        <p style={{ margin: '8px 0 0 0', fontSize: '24px', fontWeight: 'bold' }}>{value}</p>
        {trend && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#10b981' }}>{trend}</p>}
      </div>
      <Icon size={24} style={{ color: '#3b82f6', opacity: 0.6 }} />
    </div>
  );
}

function StatusBox({ title, items }) {
  return (
    <div style={{
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>{title}</h3>
      {items.map((item, i) => (
        <p key={i} style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>{item}</p>
      ))}
    </div>
  );
}

function AnalyticsCard({ title, description, value, change, trend }) {
  return (
    <div style={{
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{title}</p>
      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>{description}</p>
      <p style={{ margin: '12px 0 0 0', fontSize: '28px', fontWeight: 'bold' }}>{value}</p>
      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: trend === 'up' ? '#10b981' : '#ef4444' }}>
        {trend === 'up' ? '📈' : '📉'} {change}
      </p>
    </div>
  );
}

function ConfigItem({ label, value, action }) {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.5)',
      borderRadius: '4px',
      padding: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{label}</p>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>{value}</p>
      </div>
      <button style={{
        padding: '6px 12px',
        background: '#334155',
        color: '#e2e8f0',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600'
      }}>
        {action}
      </button>
    </div>
  );
}
