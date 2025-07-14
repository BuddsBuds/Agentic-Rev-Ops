import { supabase, Client, ClientStakeholder, ClientSocialLink, ClientIntegration, ClientDocument, ClientAnalysis, ClientContent, ClientChat } from '../config/supabase';

export class ClientService {
  // Client CRUD operations
  async createClient(clientData: Partial<Client>): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getClient(clientId: string): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error) throw error;
    return data;
  }

  async getAllClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateClient(clientId: string, updates: Partial<Client>): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateOnboardingProgress(clientId: string, progress: number): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .update({ 
        onboarding_progress: progress,
        onboarding_completed: progress >= 100
      })
      .eq('id', clientId);

    if (error) throw error;
  }

  // Stakeholder operations
  async addStakeholder(stakeholder: Omit<ClientStakeholder, 'id'>): Promise<ClientStakeholder> {
    const { data, error } = await supabase
      .from('client_stakeholders')
      .insert(stakeholder)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getStakeholders(clientId: string): Promise<ClientStakeholder[]> {
    const { data, error } = await supabase
      .from('client_stakeholders')
      .select('*')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Social links operations
  async addSocialLink(socialLink: Omit<ClientSocialLink, 'id'>): Promise<ClientSocialLink> {
    const { data, error } = await supabase
      .from('client_social_links')
      .insert(socialLink)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSocialLinks(clientId: string): Promise<ClientSocialLink[]> {
    const { data, error } = await supabase
      .from('client_social_links')
      .select('*')
      .eq('client_id', clientId);

    if (error) throw error;
    return data || [];
  }

  // Integration operations
  async addIntegration(integration: Omit<ClientIntegration, 'id'>): Promise<ClientIntegration> {
    const { data, error } = await supabase
      .from('client_integrations')
      .insert(integration)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateIntegrationStatus(integrationId: string, status: 'connected' | 'pending' | 'failed', config?: any): Promise<void> {
    const updates: any = { status };
    if (config) updates.config = config;
    if (status === 'connected') updates.last_sync = new Date().toISOString();

    const { error } = await supabase
      .from('client_integrations')
      .update(updates)
      .eq('id', integrationId);

    if (error) throw error;
  }

  async getIntegrations(clientId: string): Promise<ClientIntegration[]> {
    const { data, error } = await supabase
      .from('client_integrations')
      .select('*')
      .eq('client_id', clientId);

    if (error) throw error;
    return data || [];
  }

  // Document operations
  async uploadDocument(document: Omit<ClientDocument, 'id'>): Promise<ClientDocument> {
    const { data, error } = await supabase
      .from('client_documents')
      .insert(document)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getDocuments(clientId: string): Promise<ClientDocument[]> {
    const { data, error } = await supabase
      .from('client_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Analysis operations
  async createAnalysis(analysis: Omit<ClientAnalysis, 'id'>): Promise<ClientAnalysis> {
    const { data, error } = await supabase
      .from('client_analyses')
      .insert(analysis)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateAnalysis(analysisId: string, updates: Partial<ClientAnalysis>): Promise<void> {
    const { error } = await supabase
      .from('client_analyses')
      .update(updates)
      .eq('id', analysisId);

    if (error) throw error;
  }

  async getAnalyses(clientId: string): Promise<ClientAnalysis[]> {
    const { data, error } = await supabase
      .from('client_analyses')
      .select('*')
      .eq('client_id', clientId)
      .order('generated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Content operations
  async createContent(content: Omit<ClientContent, 'id'>): Promise<ClientContent> {
    const { data, error } = await supabase
      .from('client_content')
      .insert(content)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateContent(contentId: string, updates: Partial<ClientContent>): Promise<ClientContent> {
    const { data, error } = await supabase
      .from('client_content')
      .update(updates)
      .eq('id', contentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getContent(clientId: string, type?: string): Promise<ClientContent[]> {
    let query = supabase
      .from('client_content')
      .select('*')
      .eq('client_id', clientId);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Chat operations
  async saveChatInteraction(chat: Omit<ClientChat, 'id'>): Promise<ClientChat> {
    const { data, error } = await supabase
      .from('client_chats')
      .insert(chat)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getChatHistory(clientId: string, limit: number = 50): Promise<ClientChat[]> {
    const { data, error } = await supabase
      .from('client_chats')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // Comprehensive client data fetch
  async getClientFullProfile(clientId: string): Promise<any> {
    const [client, stakeholders, socialLinks, integrations, documents, analyses, content] = await Promise.all([
      this.getClient(clientId),
      this.getStakeholders(clientId),
      this.getSocialLinks(clientId),
      this.getIntegrations(clientId),
      this.getDocuments(clientId),
      this.getAnalyses(clientId),
      this.getContent(clientId)
    ]);

    return {
      client,
      stakeholders,
      socialLinks,
      integrations,
      documents,
      analyses,
      content
    };
  }
}