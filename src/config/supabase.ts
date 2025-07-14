import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Note: Replace these with your actual Supabase project credentials
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Client {
  id: string;
  name: string;
  domain: string;
  created_at: string;
  updated_at: string;
  onboarding_completed: boolean;
  onboarding_progress: number;
}

export interface ClientStakeholder {
  id: string;
  client_id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  linkedin_url?: string;
  is_primary: boolean;
}

export interface ClientSocialLink {
  id: string;
  client_id: string;
  platform: string;
  url: string;
  handle?: string;
}

export interface ClientIntegration {
  id: string;
  client_id: string;
  type: 'crm' | 'drive' | 'notion' | 'asana' | 'slack' | 'whatsapp' | 'mailchimp' | 'hootsuite' | 'other';
  name: string;
  status: 'connected' | 'pending' | 'failed';
  config: Record<string, any>;
  last_sync?: string;
}

export interface ClientDocument {
  id: string;
  client_id: string;
  type: 'financial_report' | 'brand_material' | 'style_guide' | 'other';
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface ClientAnalysis {
  id: string;
  client_id: string;
  type: 'market' | 'seo' | 'competitive' | 'audience_icp' | 'social_presence';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  results?: Record<string, any>;
  generated_at?: string;
}

export interface ClientContent {
  id: string;
  client_id: string;
  type: 'campaign' | 'sales_plan' | 'marketing_plan' | 'revops_plan' | 'cx_plan' | 'event_plan' | 'social_media';
  title: string;
  content: Record<string, any>;
  status: 'draft' | 'review' | 'approved' | 'published';
  created_at: string;
  updated_at: string;
}

export interface ClientChat {
  id: string;
  client_id: string;
  user_message: string;
  swarm_response: string;
  agents_involved: string[];
  created_at: string;
}