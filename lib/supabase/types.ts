export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; avatar_url: string | null; company: string | null; created_at: string; updated_at: string };
        Insert: { id: string; full_name?: string | null; avatar_url?: string | null; company?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; full_name?: string | null; avatar_url?: string | null; company?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      workspaces: {
        Row: { id: string; name: string; slug: string; logo_url: string | null; default_from_name: string | null; default_from_email: string | null; timezone: string; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; logo_url?: string | null; default_from_name?: string | null; default_from_email?: string | null; timezone?: string; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; slug?: string; logo_url?: string | null; default_from_name?: string | null; default_from_email?: string | null; timezone?: string; created_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      workspace_members: {
        Row: { id: string; workspace_id: string; user_id: string; role: string; created_at: string };
        Insert: { id?: string; workspace_id: string; user_id: string; role?: string; created_at?: string };
        Update: { id?: string; workspace_id?: string; user_id?: string; role?: string; created_at?: string };
        Relationships: [];
      };
      workspace_sending_domains: {
        Row: { id: string; workspace_id: string; resend_domain_id: string; name: string; status: string; region: string | null; records: Json; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; resend_domain_id: string; name: string; status?: string; region?: string | null; records?: Json; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string; resend_domain_id?: string; name?: string; status?: string; region?: string | null; records?: Json; created_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      connected_email_accounts: {
        Row: { id: string; workspace_id: string; provider: string; email: string; display_name: string | null; status: string; access_token_encrypted: string | null; refresh_token_encrypted: string | null; token_expires_at: string | null; scopes: string[]; metadata: Json; last_used_at: string | null; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; provider: string; email: string; display_name?: string | null; status?: string; access_token_encrypted?: string | null; refresh_token_encrypted?: string | null; token_expires_at?: string | null; scopes?: string[]; metadata?: Json; last_used_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string; provider?: string; email?: string; display_name?: string | null; status?: string; access_token_encrypted?: string | null; refresh_token_encrypted?: string | null; token_expires_at?: string | null; scopes?: string[]; metadata?: Json; last_used_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      template_folders: {
        Row: { id: string; workspace_id: string; name: string; slug: string; description: string | null; color: string; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; name: string; slug: string; description?: string | null; color?: string; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string; name?: string; slug?: string; description?: string | null; color?: string; created_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      audiences: {
        Row: { id: string; workspace_id: string | null; name: string; description: string | null; contact_count: number; tags: string[]; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id?: string | null; name: string; description?: string | null; contact_count?: number; tags?: string[]; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string | null; name?: string; description?: string | null; contact_count?: number; tags?: string[]; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      contacts: {
        Row: { id: string; workspace_id: string | null; audience_id: string | null; name: string; email: string; company: string | null; status: string; source: string | null; tags: string[]; custom_fields: Json; last_activity_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id?: string | null; audience_id?: string | null; name: string; email: string; company?: string | null; status?: string; source?: string | null; tags?: string[]; custom_fields?: Json; last_activity_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string | null; audience_id?: string | null; name?: string; email?: string; company?: string | null; status?: string; source?: string | null; tags?: string[]; custom_fields?: Json; last_activity_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      email_templates: {
        Row: { id: string; workspace_id: string | null; folder_id: string | null; name: string; slug: string; category: string; description: string | null; subject: string; preheader: string | null; from_name: string | null; from_email: string | null; reply_to: string | null; html: string | null; text: string | null; design: Json; variables: string[]; status: string; thumbnail_url: string | null; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id?: string | null; folder_id?: string | null; name: string; slug: string; category?: string; description?: string | null; subject: string; preheader?: string | null; from_name?: string | null; from_email?: string | null; reply_to?: string | null; html?: string | null; text?: string | null; design?: Json; variables?: string[]; status?: string; thumbnail_url?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string | null; folder_id?: string | null; name?: string; slug?: string; category?: string; description?: string | null; subject?: string; preheader?: string | null; from_name?: string | null; from_email?: string | null; reply_to?: string | null; html?: string | null; text?: string | null; design?: Json; variables?: string[]; status?: string; thumbnail_url?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      email_template_versions: {
        Row: { id: string; template_id: string; version_number: number; subject: string; preheader: string | null; html: string | null; text: string | null; design: Json; created_by: string | null; created_at: string };
        Insert: { id?: string; template_id: string; version_number: number; subject: string; preheader?: string | null; html?: string | null; text?: string | null; design?: Json; created_by?: string | null; created_at?: string };
        Update: { id?: string; template_id?: string; version_number?: number; subject?: string; preheader?: string | null; html?: string | null; text?: string | null; design?: Json; created_by?: string | null; created_at?: string };
        Relationships: [];
      };
      triggers: {
        Row: { id: string; workspace_id: string | null; name: string; type: string; endpoint_slug: string; event_name: string | null; source: string | null; status: string; auth_mode: string; schedule_cron: string | null; sample_payload: Json; config: Json; last_received_at: string | null; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id?: string | null; name: string; type: string; endpoint_slug: string; event_name?: string | null; source?: string | null; status?: string; auth_mode?: string; schedule_cron?: string | null; sample_payload?: Json; config?: Json; last_received_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string | null; name?: string; type?: string; endpoint_slug?: string; event_name?: string | null; source?: string | null; status?: string; auth_mode?: string; schedule_cron?: string | null; sample_payload?: Json; config?: Json; last_received_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      flows: {
        Row: { id: string; workspace_id: string | null; trigger_id: string | null; audience_id: string | null; name: string; slug: string; description: string | null; status: string; trigger_type: string | null; timezone: string; settings: Json; stats: Json; published_at: string | null; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id?: string | null; trigger_id?: string | null; audience_id?: string | null; name: string; slug: string; description?: string | null; status?: string; trigger_type?: string | null; timezone?: string; settings?: Json; stats?: Json; published_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string | null; trigger_id?: string | null; audience_id?: string | null; name?: string; slug?: string; description?: string | null; status?: string; trigger_type?: string | null; timezone?: string; settings?: Json; stats?: Json; published_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      flow_steps: {
        Row: { id: string; flow_id: string; parent_step_id: string | null; type: string; name: string; position: number; branch_key: string | null; template_id: string | null; config: Json; created_at: string; updated_at: string };
        Insert: { id?: string; flow_id: string; parent_step_id?: string | null; type: string; name: string; position?: number; branch_key?: string | null; template_id?: string | null; config?: Json; created_at?: string; updated_at?: string };
        Update: { id?: string; flow_id?: string; parent_step_id?: string | null; type?: string; name?: string; position?: number; branch_key?: string | null; template_id?: string | null; config?: Json; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      flow_runs: {
        Row: { id: string; workspace_id: string | null; flow_id: string | null; contact_id: string | null; trigger_id: string | null; status: string; payload: Json; started_at: string | null; completed_at: string | null; created_at: string };
        Insert: { id?: string; workspace_id?: string | null; flow_id?: string | null; contact_id?: string | null; trigger_id?: string | null; status?: string; payload?: Json; started_at?: string | null; completed_at?: string | null; created_at?: string };
        Update: { id?: string; workspace_id?: string | null; flow_id?: string | null; contact_id?: string | null; trigger_id?: string | null; status?: string; payload?: Json; started_at?: string | null; completed_at?: string | null; created_at?: string };
        Relationships: [];
      };
      run_events: {
        Row: { id: string; workspace_id: string | null; flow_id: string | null; flow_run_id: string | null; contact_id: string | null; event_type: string; title: string; metadata: Json; created_at: string };
        Insert: { id?: string; workspace_id?: string | null; flow_id?: string | null; flow_run_id?: string | null; contact_id?: string | null; event_type: string; title: string; metadata?: Json; created_at?: string };
        Update: { id?: string; workspace_id?: string | null; flow_id?: string | null; flow_run_id?: string | null; contact_id?: string | null; event_type?: string; title?: string; metadata?: Json; created_at?: string };
        Relationships: [];
      };
      trigger_events: {
        Row: { id: string; workspace_id: string | null; trigger_id: string | null; flow_run_id: string | null; status: string; payload: Json; headers: Json; error_message: string | null; created_at: string };
        Insert: { id?: string; workspace_id?: string | null; trigger_id?: string | null; flow_run_id?: string | null; status?: string; payload?: Json; headers?: Json; error_message?: string | null; created_at?: string };
        Update: { id?: string; workspace_id?: string | null; trigger_id?: string | null; flow_run_id?: string | null; status?: string; payload?: Json; headers?: Json; error_message?: string | null; created_at?: string };
        Relationships: [];
      };
      mailhooks: {
        Row: { id: string; workspace_id: string | null; trigger_id: string | null; address: string; name: string; status: string; flow_id: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id?: string | null; trigger_id?: string | null; address: string; name: string; status?: string; flow_id?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; workspace_id?: string | null; trigger_id?: string | null; address?: string; name?: string; status?: string; flow_id?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      ensure_workspace: {
        Args: { workspace_name?: string; default_from_name?: string; default_from_email?: string | null };
        Returns: string;
      };
    };
  };
};
