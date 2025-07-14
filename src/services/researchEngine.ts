import { ClientService } from './clientService';
import { supabase } from '../config/supabase';
import { AgentOrchestrator } from '../agents/queen/AgentOrchestrator';

export interface ResearchRequest {
  clientId: string;
  analysisTypes: ('market' | 'seo' | 'competitive' | 'audience_icp' | 'social_presence')[];
  priority?: 'high' | 'medium' | 'low';
  context?: Record<string, any>;
}

export interface ResearchResult {
  type: string;
  findings: Record<string, any>;
  recommendations: string[];
  confidence: number;
  generatedAt: string;
}

export class ResearchEngine {
  private clientService: ClientService;
  private orchestrator: AgentOrchestrator;

  constructor() {
    this.clientService = new ClientService();
    this.orchestrator = new AgentOrchestrator();
  }

  async runAnalysis(request: ResearchRequest): Promise<void> {
    const client = await this.clientService.getClient(request.clientId);
    
    // Create analysis records
    for (const analysisType of request.analysisTypes) {
      const analysis = await this.clientService.createAnalysis({
        client_id: request.clientId,
        type: analysisType,
        status: 'pending'
      });

      // Queue analysis task
      this.queueAnalysisTask(client, analysis.id, analysisType);
    }
  }

  private async queueAnalysisTask(client: any, analysisId: string, type: string): Promise<void> {
    try {
      // Update status to in_progress
      await this.clientService.updateAnalysis(analysisId, { status: 'in_progress' });

      // Perform analysis based on type
      const result = await this.performAnalysis(client, type);

      // Store results
      await this.clientService.updateAnalysis(analysisId, {
        status: 'completed',
        results: result,
        generated_at: new Date().toISOString()
      });

    } catch (error) {
      await this.clientService.updateAnalysis(analysisId, {
        status: 'failed',
        results: { error: error.message }
      });
    }
  }

  private async performAnalysis(client: any, type: string): Promise<ResearchResult> {
    switch (type) {
      case 'market':
        return await this.performMarketAnalysis(client);
      case 'seo':
        return await this.performSEOAnalysis(client);
      case 'competitive':
        return await this.performCompetitiveAnalysis(client);
      case 'audience_icp':
        return await this.performAudienceAnalysis(client);
      case 'social_presence':
        return await this.performSocialAnalysis(client);
      default:
        throw new Error(`Unknown analysis type: ${type}`);
    }
  }

  private async performMarketAnalysis(client: any): Promise<ResearchResult> {
    // Gather market data
    const marketData = await this.gatherMarketData(client);
    
    // Use swarm for analysis
    const swarmAnalysis = await this.orchestrator.handleRequest({
      context: {
        task: 'market_analysis',
        client: client.name,
        domain: client.domain,
        data: marketData
      },
      priority: 'high'
    });

    return {
      type: 'market',
      findings: {
        marketSize: marketData.marketSize,
        growthRate: marketData.growthRate,
        trends: marketData.trends,
        opportunities: swarmAnalysis.decision.recommendations,
        threats: marketData.threats,
        targetSegments: marketData.segments
      },
      recommendations: [
        'Focus on emerging market segments showing 20%+ growth',
        'Invest in AI/ML capabilities to stay competitive',
        'Expand into adjacent markets with similar customer profiles',
        'Develop strategic partnerships in high-growth areas'
      ],
      confidence: swarmAnalysis.decision.confidence,
      generatedAt: new Date().toISOString()
    };
  }

  private async performSEOAnalysis(client: any): Promise<ResearchResult> {
    // Mock SEO data gathering
    const seoData = {
      domainAuthority: 45,
      pageSpeed: 78,
      mobileScore: 85,
      backlinks: 1250,
      organicKeywords: 456,
      topPages: [
        { url: '/products', traffic: 15000 },
        { url: '/blog', traffic: 8500 },
        { url: '/about', traffic: 3200 }
      ],
      technicalIssues: [
        'Missing meta descriptions on 23 pages',
        'Slow server response time (>2s)',
        'Large image files reducing page speed'
      ]
    };

    return {
      type: 'seo',
      findings: seoData,
      recommendations: [
        'Optimize meta descriptions for all product pages',
        'Implement lazy loading for images',
        'Improve server response time with caching',
        'Target long-tail keywords in your industry',
        'Build high-quality backlinks from industry publications'
      ],
      confidence: 88,
      generatedAt: new Date().toISOString()
    };
  }

  private async performCompetitiveAnalysis(client: any): Promise<ResearchResult> {
    // Mock competitive analysis
    const competitiveData = {
      mainCompetitors: [
        { name: 'Competitor A', marketShare: 25, strengths: ['Brand recognition', 'Large salesforce'] },
        { name: 'Competitor B', marketShare: 18, strengths: ['Technology', 'Customer service'] },
        { name: 'Competitor C', marketShare: 12, strengths: ['Price', 'Distribution'] }
      ],
      competitiveAdvantages: [
        'Superior product quality',
        'Innovative features',
        'Better customer support'
      ],
      gaps: [
        'Limited market presence in APAC',
        'Higher pricing than competitors',
        'Less brand awareness'
      ]
    };

    return {
      type: 'competitive',
      findings: competitiveData,
      recommendations: [
        'Develop competitive pricing strategy for key markets',
        'Invest in brand awareness campaigns',
        'Expand distribution channels in underserved regions',
        'Highlight unique value propositions in marketing',
        'Monitor competitor product launches and features'
      ],
      confidence: 82,
      generatedAt: new Date().toISOString()
    };
  }

  private async performAudienceAnalysis(client: any): Promise<ResearchResult> {
    // Mock audience/ICP analysis
    const audienceData = {
      idealCustomerProfiles: [
        {
          segment: 'Enterprise Tech Companies',
          size: 'Large (1000+ employees)',
          characteristics: ['High tech adoption', 'Large budgets', 'Complex needs'],
          painPoints: ['Integration challenges', 'Scalability', 'Security concerns']
        },
        {
          segment: 'Growing SaaS Startups',
          size: 'Medium (50-500 employees)',
          characteristics: ['Fast growth', 'Agile', 'Cost-conscious'],
          painPoints: ['Limited resources', 'Need for automation', 'Growth challenges']
        }
      ],
      demographics: {
        primaryAge: '35-54',
        decisionMakers: ['CTO', 'VP Engineering', 'IT Director'],
        industries: ['Technology', 'Finance', 'Healthcare']
      }
    };

    return {
      type: 'audience_icp',
      findings: audienceData,
      recommendations: [
        'Create targeted content for each ICP segment',
        'Develop case studies featuring similar companies',
        'Adjust messaging to address specific pain points',
        'Focus sales efforts on high-value segments',
        'Build partnerships with complementary services'
      ],
      confidence: 90,
      generatedAt: new Date().toISOString()
    };
  }

  private async performSocialAnalysis(client: any): Promise<ResearchResult> {
    // Get social links
    const socialLinks = await this.clientService.getSocialLinks(client.id);
    
    // Mock social presence analysis
    const socialData = {
      platforms: socialLinks.map(link => ({
        platform: link.platform,
        followers: Math.floor(Math.random() * 50000) + 5000,
        engagementRate: (Math.random() * 5 + 1).toFixed(2),
        postsPerWeek: Math.floor(Math.random() * 10) + 3
      })),
      sentiment: {
        positive: 68,
        neutral: 25,
        negative: 7
      },
      topContent: [
        { type: 'Educational', engagement: 4.5 },
        { type: 'Product Updates', engagement: 3.8 },
        { type: 'Industry News', engagement: 2.9 }
      ],
      competitorComparison: {
        followersVsAvg: '+23%',
        engagementVsAvg: '+15%',
        sentimentVsAvg: '+8%'
      }
    };

    return {
      type: 'social_presence',
      findings: socialData,
      recommendations: [
        'Increase posting frequency on high-engagement platforms',
        'Create more educational content (highest engagement)',
        'Implement social listening for brand mentions',
        'Engage more with user-generated content',
        'Launch influencer partnership program'
      ],
      confidence: 85,
      generatedAt: new Date().toISOString()
    };
  }

  private async gatherMarketData(client: any): Promise<any> {
    // Mock market data gathering
    return {
      marketSize: '$45.6B',
      growthRate: '12.5%',
      trends: [
        'AI/ML adoption increasing 40% YoY',
        'Remote work driving cloud solutions',
        'Sustainability becoming key factor'
      ],
      segments: [
        { name: 'Enterprise', size: '$28B', growth: '10%' },
        { name: 'SMB', size: '$12B', growth: '18%' },
        { name: 'Startup', size: '$5.6B', growth: '25%' }
      ],
      threats: [
        'New regulations in key markets',
        'Economic uncertainty',
        'Increasing competition'
      ]
    };
  }

  async generateInsights(clientId: string): Promise<any> {
    const analyses = await this.clientService.getAnalyses(clientId);
    const completedAnalyses = analyses.filter(a => a.status === 'completed');
    
    if (completedAnalyses.length === 0) {
      return null;
    }

    // Aggregate insights from all analyses
    const insights = {
      summary: this.generateExecutiveSummary(completedAnalyses),
      keyFindings: this.extractKeyFindings(completedAnalyses),
      prioritizedRecommendations: this.prioritizeRecommendations(completedAnalyses),
      actionPlan: this.generateActionPlan(completedAnalyses)
    };

    return insights;
  }

  private generateExecutiveSummary(analyses: any[]): string {
    return `Based on comprehensive analysis across ${analyses.length} areas, your business shows strong potential for growth with key opportunities in market expansion and digital optimization. The analysis reveals an average confidence score of 85%, with particularly strong performance in audience alignment and competitive positioning.`;
  }

  private extractKeyFindings(analyses: any[]): string[] {
    const findings = [];
    
    analyses.forEach(analysis => {
      if (analysis.results?.findings) {
        // Extract top findings from each analysis
        findings.push(`${analysis.type}: Strong performance indicators identified`);
      }
    });
    
    return findings;
  }

  private prioritizeRecommendations(analyses: any[]): any[] {
    const allRecommendations = [];
    
    analyses.forEach(analysis => {
      if (analysis.results?.recommendations) {
        analysis.results.recommendations.forEach(rec => {
          allRecommendations.push({
            recommendation: rec,
            type: analysis.type,
            priority: this.calculatePriority(rec, analysis)
          });
        });
      }
    });
    
    return allRecommendations.sort((a, b) => b.priority - a.priority).slice(0, 10);
  }

  private calculatePriority(recommendation: string, analysis: any): number {
    // Simple priority calculation based on confidence and type
    const typeWeights = {
      market: 1.2,
      competitive: 1.1,
      audience_icp: 1.0,
      seo: 0.9,
      social_presence: 0.8
    };
    
    const confidence = analysis.results?.confidence || 75;
    const typeWeight = typeWeights[analysis.type] || 1.0;
    
    return confidence * typeWeight;
  }

  private generateActionPlan(analyses: any[]): any {
    return {
      immediate: [
        'Address technical SEO issues identified',
        'Launch targeted campaigns for high-value segments',
        'Implement social listening tools'
      ],
      shortTerm: [
        'Develop content strategy based on audience insights',
        'Optimize pricing strategy vs competitors',
        'Expand presence on high-engagement platforms'
      ],
      longTerm: [
        'Enter new market segments showing 20%+ growth',
        'Build strategic partnerships',
        'Develop AI-powered customer experiences'
      ]
    };
  }
}