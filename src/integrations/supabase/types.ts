export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      endorsements: {
        Row: {
          comment: string | null
          created_at: string
          endorsed_id: string
          endorser_id: string
          id: string
          is_hidden: boolean | null
          pillar: Database["public"]["Enums"]["pillar_type"]
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          endorsed_id: string
          endorser_id: string
          id?: string
          is_hidden?: boolean | null
          pillar: Database["public"]["Enums"]["pillar_type"]
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          endorsed_id?: string
          endorser_id?: string
          id?: string
          is_hidden?: boolean | null
          pillar?: Database["public"]["Enums"]["pillar_type"]
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "endorsements_endorsed_id_fkey"
            columns: ["endorsed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endorsements_endorser_id_fkey"
            columns: ["endorser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          created_at: string
          description: string | null
          endorsement_id: string
          file_type: string | null
          file_url: string
          id: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          endorsement_id: string
          file_type?: string | null
          file_url: string
          id?: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          endorsement_id?: string
          file_type?: string | null
          file_url?: string
          id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_endorsement_id_fkey"
            columns: ["endorsement_id"]
            isOneToOne: false
            referencedRelation: "endorsements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      constitutional_offices: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          ended_at: string | null
          id: string
          is_active: boolean
          metadata: Json
          notes: string | null
          office_key: Database["public"]["Enums"]["constitutional_office_key"]
          profile_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          notes?: string | null
          office_key: Database["public"]["Enums"]["constitutional_office_key"]
          profile_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          notes?: string | null
          office_key?: Database["public"]["Enums"]["constitutional_office_key"]
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "constitutional_offices_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constitutional_offices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_citizen_since: string | null
          avatar_url: string | null
          bio: string | null
          citizen_signing_key_algorithm: string | null
          citizen_signing_key_registered_at: string | null
          citizen_signing_public_key: string | null
          citizenship_accepted_at: string | null
          citizenship_acceptance_mode: string | null
          citizenship_review_cleared_at: string | null
          citizenship_status: Database["public"]["Enums"]["citizenship_status"]
          country: string | null
          country_code: string | null
          created_at: string
          custom_permissions: Database["public"]["Enums"]["app_permission"][]
          date_of_birth: string | null
          denied_permissions: Database["public"]["Enums"]["app_permission"][]
          deleted_at: string | null
          deletion_reason: string | null
          experience_level: string
          full_name: string | null
          full_name_change_count: number | null
          full_name_last_changed_at: string | null
          granted_permissions: Database["public"]["Enums"]["app_permission"][]
          governance_eligible_at: string | null
          id: string
          is_admin: boolean | null
          is_active_citizen: boolean
          is_governance_eligible: boolean
          is_verified: boolean | null
          language_code: string | null
          last_active_at: string | null
          official_id: string
          place_of_birth: string | null
          phone_country_code: string | null
          phone_e164: string | null
          phone_number: string | null
          role: Database["public"]["Enums"]["app_role"]
          sex: string | null
          social_security_number: string
          updated_at: string
          user_id: string
          username: string | null
          username_last_changed_at: string | null
        }
        Insert: {
          active_citizen_since?: string | null
          avatar_url?: string | null
          bio?: string | null
          citizen_signing_key_algorithm?: string | null
          citizen_signing_key_registered_at?: string | null
          citizen_signing_public_key?: string | null
          citizenship_accepted_at?: string | null
          citizenship_acceptance_mode?: string | null
          citizenship_review_cleared_at?: string | null
          citizenship_status?: Database["public"]["Enums"]["citizenship_status"]
          country?: string | null
          country_code?: string | null
          created_at?: string
          custom_permissions?: Database["public"]["Enums"]["app_permission"][]
          date_of_birth?: string | null
          denied_permissions?: Database["public"]["Enums"]["app_permission"][]
          deleted_at?: string | null
          deletion_reason?: string | null
          experience_level?: string
          full_name?: string | null
          full_name_change_count?: number | null
          full_name_last_changed_at?: string | null
          granted_permissions?: Database["public"]["Enums"]["app_permission"][]
          governance_eligible_at?: string | null
          id?: string
          is_admin?: boolean | null
          is_active_citizen?: boolean
          is_governance_eligible?: boolean
          is_verified?: boolean | null
          language_code?: string | null
          last_active_at?: string | null
          official_id?: string
          place_of_birth?: string | null
          phone_country_code?: string | null
          phone_e164?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          sex?: string | null
          social_security_number?: string
          updated_at?: string
          user_id: string
          username?: string | null
          username_last_changed_at?: string | null
        }
        Update: {
          active_citizen_since?: string | null
          avatar_url?: string | null
          bio?: string | null
          citizen_signing_key_algorithm?: string | null
          citizen_signing_key_registered_at?: string | null
          citizen_signing_public_key?: string | null
          citizenship_accepted_at?: string | null
          citizenship_acceptance_mode?: string | null
          citizenship_review_cleared_at?: string | null
          citizenship_status?: Database["public"]["Enums"]["citizenship_status"]
          country?: string | null
          country_code?: string | null
          created_at?: string
          custom_permissions?: Database["public"]["Enums"]["app_permission"][]
          date_of_birth?: string | null
          denied_permissions?: Database["public"]["Enums"]["app_permission"][]
          deleted_at?: string | null
          deletion_reason?: string | null
          experience_level?: string
          full_name?: string | null
          full_name_change_count?: number | null
          full_name_last_changed_at?: string | null
          granted_permissions?: Database["public"]["Enums"]["app_permission"][]
          governance_eligible_at?: string | null
          id?: string
          is_admin?: boolean | null
          is_active_citizen?: boolean
          is_governance_eligible?: boolean
          is_verified?: boolean | null
          language_code?: string | null
          last_active_at?: string | null
          official_id?: string
          place_of_birth?: string | null
          phone_country_code?: string | null
          phone_e164?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          sex?: string | null
          social_security_number?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          username_last_changed_at?: string | null
        }
        Relationships: []
      }
      linked_accounts: {
        Row: {
          business_name_normalized: string | null
          created_at: string
          id: string
          linked_profile_id: string
          owner_profile_id: string
          relationship_type: string
          updated_at: string
        }
        Insert: {
          business_name_normalized?: string | null
          created_at?: string
          id?: string
          linked_profile_id: string
          owner_profile_id: string
          relationship_type?: string
          updated_at?: string
        }
        Update: {
          business_name_normalized?: string | null
          created_at?: string
          id?: string
          linked_profile_id?: string
          owner_profile_id?: string
          relationship_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "linked_accounts_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linked_accounts_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_account_access_requests: {
        Row: {
          created_at: string
          id: string
          request_note: string | null
          requester_profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_note?: string | null
          requester_profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          request_note?: string | null
          requester_profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_account_access_requests_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_account_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_account_access_requests_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      citizen_activation_scopes: {
        Row: {
          activated_at: string
          activated_by: string | null
          country_code: string
          created_at: string
          id: string
          notes: string | null
          profile_id: string
          scope_type: Database["public"]["Enums"]["activation_scope_type"]
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          country_code?: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          scope_type: Database["public"]["Enums"]["activation_scope_type"]
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          country_code?: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
          scope_type?: Database["public"]["Enums"]["activation_scope_type"]
        }
        Relationships: [
          {
            foreignKeyName: "citizen_activation_scopes_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citizen_activation_scopes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_decisions: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["activation_review_decision"]
          id: string
          metadata: Json
          notes: string | null
          review_id: string
          reviewer_id: string | null
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["activation_review_decision"]
          id?: string
          metadata?: Json
          notes?: string | null
          review_id: string
          reviewer_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["activation_review_decision"]
          id?: string
          metadata?: Json
          notes?: string | null
          review_id?: string
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_decisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "activation_threshold_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_decisions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_demographic_snapshots: {
        Row: {
          country_code: string
          created_at: string
          created_by: string | null
          id: string
          ingestion_notes: string | null
          jurisdiction_label: string
          metadata: Json
          observed_at: string
          scope_type: Database["public"]["Enums"]["activation_scope_type"]
          source_label: string
          source_url: string | null
          target_population: number
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ingestion_notes?: string | null
          jurisdiction_label?: string
          metadata?: Json
          observed_at?: string
          scope_type: Database["public"]["Enums"]["activation_scope_type"]
          source_label: string
          source_url?: string | null
          target_population: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ingestion_notes?: string | null
          jurisdiction_label?: string
          metadata?: Json
          observed_at?: string
          scope_type?: Database["public"]["Enums"]["activation_scope_type"]
          source_label?: string
          source_url?: string | null
          target_population?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_demographic_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_demographic_feed_adapters: {
        Row: {
          adapter_key: string
          adapter_name: string
          adapter_type: Database["public"]["Enums"]["activation_demographic_feed_adapter_type"]
          added_by: string | null
          country_code: string
          created_at: string
          endpoint_url: string | null
          id: string
          is_active: boolean
          key_algorithm: string
          last_ingested_at: string | null
          metadata: Json
          public_signer_key: string
          scope_type: Database["public"]["Enums"]["activation_scope_type"]
          updated_at: string
          worker_sweep_interval_minutes: number | null
        }
        Insert: {
          adapter_key: string
          adapter_name: string
          adapter_type?: Database["public"]["Enums"]["activation_demographic_feed_adapter_type"]
          added_by?: string | null
          country_code?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          key_algorithm?: string
          last_ingested_at?: string | null
          metadata?: Json
          public_signer_key: string
          scope_type?: Database["public"]["Enums"]["activation_scope_type"]
          updated_at?: string
          worker_sweep_interval_minutes?: number | null
        }
        Update: {
          adapter_key?: string
          adapter_name?: string
          adapter_type?: Database["public"]["Enums"]["activation_demographic_feed_adapter_type"]
          added_by?: string | null
          country_code?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          key_algorithm?: string
          last_ingested_at?: string | null
          metadata?: Json
          public_signer_key?: string
          scope_type?: Database["public"]["Enums"]["activation_scope_type"]
          updated_at?: string
          worker_sweep_interval_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_demographic_feed_adapters_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_demographic_feed_ingestions: {
        Row: {
          adapter_id: string
          country_code: string
          created_at: string
          id: string
          ingested_by: string | null
          ingestion_metadata: Json
          ingestion_notes: string | null
          ingestion_status: string
          observed_at: string
          payload_hash: string | null
          payload_signature: string | null
          scope_type: Database["public"]["Enums"]["activation_scope_type"]
          signature_verified: boolean
          signed_payload: string | null
          snapshot_id: string | null
          target_population: number
        }
        Insert: {
          adapter_id: string
          country_code?: string
          created_at?: string
          id?: string
          ingested_by?: string | null
          ingestion_metadata?: Json
          ingestion_notes?: string | null
          ingestion_status?: string
          observed_at: string
          payload_hash?: string | null
          payload_signature?: string | null
          scope_type: Database["public"]["Enums"]["activation_scope_type"]
          signature_verified?: boolean
          signed_payload?: string | null
          snapshot_id?: string | null
          target_population: number
        }
        Update: {
          adapter_id?: string
          country_code?: string
          created_at?: string
          id?: string
          ingested_by?: string | null
          ingestion_metadata?: Json
          ingestion_notes?: string | null
          ingestion_status?: string
          observed_at?: string
          payload_hash?: string | null
          payload_signature?: string | null
          scope_type?: Database["public"]["Enums"]["activation_scope_type"]
          signature_verified?: boolean
          signed_payload?: string | null
          snapshot_id?: string | null
          target_population?: number
        }
        Relationships: [
          {
            foreignKeyName: "activation_demographic_feed_ingestions_adapter_id_fkey"
            columns: ["adapter_id"]
            isOneToOne: false
            referencedRelation: "activation_demographic_feed_adapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_demographic_feed_ingestions_ingested_by_fkey"
            columns: ["ingested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_demographic_feed_ingestions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "activation_demographic_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_demographic_feed_worker_outbox: {
        Row: {
          adapter_id: string
          attempt_count: number
          claim_expires_at: string | null
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          metadata: Json
          requested_at: string
          status: string
          updated_at: string
          worker_identity: string | null
        }
        Insert: {
          adapter_id: string
          attempt_count?: number
          claim_expires_at?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          requested_at?: string
          status?: string
          updated_at?: string
          worker_identity?: string | null
        }
        Update: {
          adapter_id?: string
          attempt_count?: number
          claim_expires_at?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          requested_at?: string
          status?: string
          updated_at?: string
          worker_identity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_demographic_feed_worker_outbox_adapter_id_fkey"
            columns: ["adapter_id"]
            isOneToOne: false
            referencedRelation: "activation_demographic_feed_adapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_demographic_feed_worker_outbox_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_demographic_feed_worker_runs: {
        Row: {
          adapter_id: string
          alert_message: string
          alert_severity: string
          alert_type: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          observed_at: string
          payload_hash: string | null
          resolved_at: string | null
          run_status: string
          updated_at: string
        }
        Insert: {
          adapter_id: string
          alert_message: string
          alert_severity?: string
          alert_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          observed_at?: string
          payload_hash?: string | null
          resolved_at?: string | null
          run_status: string
          updated_at?: string
        }
        Update: {
          adapter_id?: string
          alert_message?: string
          alert_severity?: string
          alert_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          observed_at?: string
          payload_hash?: string | null
          resolved_at?: string | null
          run_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_demographic_feed_worker_runs_adapter_id_fkey"
            columns: ["adapter_id"]
            isOneToOne: false
            referencedRelation: "activation_demographic_feed_adapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_demographic_feed_worker_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_demographic_feed_worker_schedule_policies: {
        Row: {
          claim_ttl_minutes: number
          default_interval_minutes: number
          id: string
          policy_key: string
          updated_at: string
        }
        Insert: {
          claim_ttl_minutes?: number
          default_interval_minutes?: number
          id?: string
          policy_key: string
          updated_at?: string
        }
        Update: {
          claim_ttl_minutes?: number
          default_interval_minutes?: number
          id?: string
          policy_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      activation_evidence: {
        Row: {
          created_at: string
          created_by: string | null
          evidence_type: string
          id: string
          metadata: Json
          metric_key: string | null
          metric_value: number | null
          notes: string | null
          observed_at: string | null
          review_id: string
          source_label: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          evidence_type: string
          id?: string
          metadata?: Json
          metric_key?: string | null
          metric_value?: number | null
          notes?: string | null
          observed_at?: string | null
          review_id: string
          source_label?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          evidence_type?: string
          id?: string
          metadata?: Json
          metric_key?: string | null
          metric_value?: number | null
          notes?: string | null
          observed_at?: string | null
          review_id?: string
          source_label?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_evidence_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_evidence_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "activation_threshold_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_threshold_reviews: {
        Row: {
          country_code: string
          created_at: string
          declaration_notes: string | null
          declared_at: string | null
          declared_by: string | null
          eligible_verified_citizens_count: number
          id: string
          jurisdiction_label: string
          metadata: Json
          opened_at: string
          opened_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          review_notes: string | null
          scope_type: Database["public"]["Enums"]["activation_scope_type"]
          status: Database["public"]["Enums"]["activation_review_status"]
          target_population: number | null
          threshold_percent: number
          updated_at: string
          verified_citizens_count: number
        }
        Insert: {
          country_code?: string
          created_at?: string
          declaration_notes?: string | null
          declared_at?: string | null
          declared_by?: string | null
          eligible_verified_citizens_count?: number
          id?: string
          jurisdiction_label?: string
          metadata?: Json
          opened_at?: string
          opened_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          scope_type: Database["public"]["Enums"]["activation_scope_type"]
          status?: Database["public"]["Enums"]["activation_review_status"]
          target_population?: number | null
          threshold_percent?: number
          updated_at?: string
          verified_citizens_count?: number
        }
        Update: {
          country_code?: string
          created_at?: string
          declaration_notes?: string | null
          declared_at?: string | null
          declared_by?: string | null
          eligible_verified_citizens_count?: number
          id?: string
          jurisdiction_label?: string
          metadata?: Json
          opened_at?: string
          opened_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          scope_type?: Database["public"]["Enums"]["activation_scope_type"]
          status?: Database["public"]["Enums"]["activation_review_status"]
          target_population?: number | null
          threshold_percent?: number
          updated_at?: string
          verified_citizens_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "activation_threshold_reviews_declared_by_fkey"
            columns: ["declared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_threshold_reviews_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_threshold_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professions: {
        Row: {
          created_at: string
          description: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_professions: {
        Row: {
          created_at: string
          evidence_url: string | null
          notes: string | null
          profession_id: string
          profile_id: string
          status: Database["public"]["Enums"]["profession_verification_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          evidence_url?: string | null
          notes?: string | null
          profession_id: string
          profile_id: string
          status?: Database["public"]["Enums"]["profession_verification_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          evidence_url?: string | null
          notes?: string | null
          profession_id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["profession_verification_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_professions_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_professions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_professions_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_categories: {
        Row: {
          allowed_professions: string[]
          contribution_policy: string
          created_at: string
          default_content_types: string[]
          default_moderation_lane: Database["public"]["Enums"]["content_moderation_lane"]
          description: string
          id: string
          label: string
          required_contribution_permission: Database["public"]["Enums"]["app_permission"]
          required_review_permission: Database["public"]["Enums"]["app_permission"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          allowed_professions?: string[]
          contribution_policy: string
          created_at?: string
          default_content_types?: string[]
          default_moderation_lane: Database["public"]["Enums"]["content_moderation_lane"]
          description: string
          id: string
          label: string
          required_contribution_permission: Database["public"]["Enums"]["app_permission"]
          required_review_permission: Database["public"]["Enums"]["app_permission"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allowed_professions?: string[]
          contribution_policy?: string
          created_at?: string
          default_content_types?: string[]
          default_moderation_lane?: Database["public"]["Enums"]["content_moderation_lane"]
          description?: string
          id?: string
          label?: string
          required_contribution_permission?: Database["public"]["Enums"]["app_permission"]
          required_review_permission?: Database["public"]["Enums"]["app_permission"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_contribution_rules: {
        Row: {
          allowed_professions: string[]
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          category_id: string
          content_type: string
          created_at: string
          moderation_lane: Database["public"]["Enums"]["content_moderation_lane"]
          required_permission: Database["public"]["Enums"]["app_permission"]
          requires_approved_profession: boolean
          updated_at: string
        }
        Insert: {
          allowed_professions?: string[]
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          category_id: string
          content_type?: string
          created_at?: string
          moderation_lane: Database["public"]["Enums"]["content_moderation_lane"]
          required_permission: Database["public"]["Enums"]["app_permission"]
          requires_approved_profession?: boolean
          updated_at?: string
        }
        Update: {
          allowed_professions?: string[]
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          category_id?: string
          content_type?: string
          created_at?: string
          moderation_lane?: Database["public"]["Enums"]["content_moderation_lane"]
          required_permission?: Database["public"]["Enums"]["app_permission"]
          requires_approved_profession?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_contribution_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "content_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          author_id: string | null
          body_preview: string | null
          category_id: string
          classification_confidence: number
          classification_method: string
          classification_reasons: Json
          content_type: string
          contribution_policy: string
          created_at: string
          id: string
          metadata: Json
          moderation_lane: Database["public"]["Enums"]["content_moderation_lane"]
          professional_domain: string
          review_status: Database["public"]["Enums"]["content_review_status"]
          reviewed_at: string | null
          reviewer_id: string | null
          source_id: string | null
          source_table: string | null
          submitted_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_preview?: string | null
          category_id?: string
          classification_confidence?: number
          classification_method?: string
          classification_reasons?: Json
          content_type?: string
          contribution_policy?: string
          created_at?: string
          id?: string
          metadata?: Json
          moderation_lane?: Database["public"]["Enums"]["content_moderation_lane"]
          professional_domain?: string
          review_status?: Database["public"]["Enums"]["content_review_status"]
          reviewed_at?: string | null
          reviewer_id?: string | null
          source_id?: string | null
          source_table?: string | null
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_preview?: string | null
          category_id?: string
          classification_confidence?: number
          classification_method?: string
          classification_reasons?: Json
          content_type?: string
          contribution_policy?: string
          created_at?: string
          id?: string
          metadata?: Json
          moderation_lane?: Database["public"]["Enums"]["content_moderation_lane"]
          professional_domain?: string
          review_status?: Database["public"]["Enums"]["content_review_status"]
          reviewed_at?: string | null
          reviewer_id?: string | null
          source_id?: string | null
          source_table?: string | null
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "content_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          endorsement_id: string | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          endorsement_id?: string | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          endorsement_id?: string | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_endorsement_id_fkey"
            columns: ["endorsement_id"]
            isOneToOne: false
            referencedRelation: "endorsements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      law_articles: {
        Row: {
          body: string | null
          created_at: string
          id: string
          label: string
          section_id: string
          slug: string
          sort_order: number
          summary: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          label: string
          section_id: string
          slug: string
          sort_order?: number
          summary: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          label?: string
          section_id?: string
          slug?: string
          sort_order?: number
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "law_articles_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "law_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      law_contributions: {
        Row: {
          author_id: string
          contribution_type: Database["public"]["Enums"]["law_contribution_type"]
          created_at: string
          id: string
          note: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          source_id: string | null
          source_reference: string | null
          status: Database["public"]["Enums"]["law_contribution_status"]
          title: string
          track: Database["public"]["Enums"]["law_track"]
          updated_at: string
        }
        Insert: {
          author_id: string
          contribution_type: Database["public"]["Enums"]["law_contribution_type"]
          created_at?: string
          id?: string
          note: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          source_id?: string | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["law_contribution_status"]
          title: string
          track: Database["public"]["Enums"]["law_track"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          contribution_type?: Database["public"]["Enums"]["law_contribution_type"]
          created_at?: string
          id?: string
          note?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          source_id?: string | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["law_contribution_status"]
          title?: string
          track?: Database["public"]["Enums"]["law_track"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "law_contributions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "law_contributions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "law_contributions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "law_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      law_sections: {
        Row: {
          created_at: string
          id: string
          slug: string
          sort_order: number
          source_id: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          sort_order?: number
          source_id: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          sort_order?: number
          source_id?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "law_sections_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "law_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      law_sources: {
        Row: {
          created_at: string
          domain: string
          id: string
          instrument: string
          is_published: boolean
          jurisdiction: string
          slug: string
          sort_order: number
          source_url: string | null
          summary: string
          title: string
          track: Database["public"]["Enums"]["law_track"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          instrument: string
          is_published?: boolean
          jurisdiction: string
          slug: string
          sort_order?: number
          source_url?: string | null
          summary: string
          title: string
          track: Database["public"]["Enums"]["law_track"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          instrument?: string
          is_published?: boolean
          jurisdiction?: string
          slug?: string
          sort_order?: number
          source_url?: string | null
          summary?: string
          title?: string
          track?: Database["public"]["Enums"]["law_track"]
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monetary_policy_approvals: {
        Row: {
          approval_class: string
          approver_id: string
          created_at: string
          decision: string
          id: string
          notes: string | null
          policy_profile_id: string
        }
        Insert: {
          approval_class: string
          approver_id: string
          created_at?: string
          decision: string
          id?: string
          notes?: string | null
          policy_profile_id: string
        }
        Update: {
          approval_class?: string
          approver_id?: string
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          policy_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monetary_policy_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monetary_policy_approvals_policy_profile_id_fkey"
            columns: ["policy_profile_id"]
            isOneToOne: false
            referencedRelation: "monetary_policy_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monetary_policy_audit_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          policy_profile_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          policy_profile_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          policy_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monetary_policy_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monetary_policy_audit_events_policy_profile_id_fkey"
            columns: ["policy_profile_id"]
            isOneToOne: false
            referencedRelation: "monetary_policy_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monetary_policy_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          policy_json: Json
          policy_name: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          policy_json?: Json
          policy_name?: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          policy_json?: Json
          policy_name?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "monetary_policy_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_action_intents: {
        Row: {
          action_scope: string
          actor_id: string
          client_created_at: string
          created_at: string
          id: string
          key_algorithm: string
          payload: Json
          payload_hash: string
          public_key: string
          signature: string
          target_id: string | null
        }
        Insert: {
          action_scope: string
          actor_id: string
          client_created_at: string
          created_at?: string
          id?: string
          key_algorithm: string
          payload?: Json
          payload_hash: string
          public_key: string
          signature: string
          target_id?: string | null
        }
        Update: {
          action_scope?: string
          actor_id?: string
          client_created_at?: string
          created_at?: string
          id?: string
          key_algorithm?: string
          payload?: Json
          payload_hash?: string
          public_key?: string
          signature?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_action_intents_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_domain_roles: {
        Row: {
          created_at: string
          description: string
          domain_key: string
          is_system_role: boolean
          name: string
          role_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          domain_key: string
          is_system_role?: boolean
          name: string
          role_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          domain_key?: string
          is_system_role?: boolean
          name?: string
          role_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_domain_roles_domain_key_fkey"
            columns: ["domain_key"]
            isOneToOne: false
            referencedRelation: "governance_domains"
            referencedColumns: ["domain_key"]
          },
        ]
      }
      governance_domains: {
        Row: {
          created_at: string
          description: string
          domain_key: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          domain_key: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          domain_key?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      governance_domain_maturity_snapshots: {
        Row: {
          created_at: string
          domain_key: string
          id: string
          is_mature: boolean
          measured_at: string
          measured_by: string | null
          metadata: Json
          notes: string | null
          source: string
          threshold_count: number
          threshold_results: Json
          thresholds_met_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_key: string
          id?: string
          is_mature: boolean
          measured_at?: string
          measured_by?: string | null
          metadata?: Json
          notes?: string | null
          source?: string
          threshold_count?: number
          threshold_results?: Json
          thresholds_met_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_key?: string
          id?: string
          is_mature?: boolean
          measured_at?: string
          measured_by?: string | null
          metadata?: Json
          notes?: string | null
          source?: string
          threshold_count?: number
          threshold_results?: Json
          thresholds_met_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_domain_maturity_snapshots_domain_key_fkey"
            columns: ["domain_key"]
            isOneToOne: false
            referencedRelation: "governance_domains"
            referencedColumns: ["domain_key"]
          },
          {
            foreignKeyName: "governance_domain_maturity_snapshots_measured_by_fkey"
            columns: ["measured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_domain_maturity_transitions: {
        Row: {
          created_at: string
          current_is_mature: boolean
          current_snapshot_id: string
          current_threshold_count: number
          current_thresholds_met_count: number
          domain_key: string
          id: string
          metadata: Json
          previous_is_mature: boolean | null
          previous_snapshot_id: string | null
          previous_threshold_count: number | null
          previous_thresholds_met_count: number | null
          transition_type: string
          trigger_source: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          current_is_mature: boolean
          current_snapshot_id: string
          current_threshold_count: number
          current_thresholds_met_count: number
          domain_key: string
          id?: string
          metadata?: Json
          previous_is_mature?: boolean | null
          previous_snapshot_id?: string | null
          previous_threshold_count?: number | null
          previous_thresholds_met_count?: number | null
          transition_type: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          current_is_mature?: boolean
          current_snapshot_id?: string
          current_threshold_count?: number
          current_thresholds_met_count?: number
          domain_key?: string
          id?: string
          metadata?: Json
          previous_is_mature?: boolean | null
          previous_snapshot_id?: string | null
          previous_threshold_count?: number | null
          previous_thresholds_met_count?: number | null
          transition_type?: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_domain_maturity_transitions_current_snapshot_id_fkey"
            columns: ["current_snapshot_id"]
            isOneToOne: false
            referencedRelation: "governance_domain_maturity_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_domain_maturity_transitions_domain_key_fkey"
            columns: ["domain_key"]
            isOneToOne: false
            referencedRelation: "governance_domains"
            referencedColumns: ["domain_key"]
          },
          {
            foreignKeyName: "governance_domain_maturity_transitions_previous_snapshot_id_fkey"
            columns: ["previous_snapshot_id"]
            isOneToOne: false
            referencedRelation: "governance_domain_maturity_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_domain_maturity_transitions_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_domain_maturity_thresholds: {
        Row: {
          created_at: string
          description: string
          domain_key: string
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean
          metadata: Json
          required_count: number
          role_keys: string[]
          threshold_key: string
          threshold_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          domain_key: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          required_count: number
          role_keys?: string[]
          threshold_key: string
          threshold_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          domain_key?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          required_count?: number
          role_keys?: string[]
          threshold_key?: string
          threshold_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_domain_maturity_thresholds_domain_key_fkey"
            columns: ["domain_key"]
            isOneToOne: false
            referencedRelation: "governance_domains"
            referencedColumns: ["domain_key"]
          },
        ]
      }
      governance_proposal_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          proposal_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          proposal_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_proposal_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "governance_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_proposal_guardian_approvals: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["governance_guardian_decision"]
          id: string
          proposal_id: string
          rationale: string | null
          signed_at: string
          signer_profile_id: string
          snapshot: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["governance_guardian_decision"]
          id?: string
          proposal_id: string
          rationale?: string | null
          signed_at?: string
          signer_profile_id: string
          snapshot?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["governance_guardian_decision"]
          id?: string
          proposal_id?: string
          rationale?: string | null
          signed_at?: string
          signer_profile_id?: string
          snapshot?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_proposal_guardian_approvals_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "governance_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_guardian_approvals_signer_profile_id_fkey"
            columns: ["signer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_guardian_external_signers: {
        Row: {
          activated_at: string
          added_by: string | null
          created_at: string
          custody_provider: string | null
          deactivated_at: string | null
          id: string
          is_active: boolean
          key_algorithm: string
          metadata: Json
          signer_key: string
          signer_label: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string
          added_by?: string | null
          created_at?: string
          custody_provider?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          key_algorithm?: string
          metadata?: Json
          signer_key: string
          signer_label?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string
          added_by?: string | null
          created_at?: string
          custody_provider?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          key_algorithm?: string
          metadata?: Json
          signer_key?: string
          signer_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_guardian_external_signers_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_guardian_multisig_policies: {
        Row: {
          contract_reference: string | null
          created_at: string
          id: string
          is_enabled: boolean
          metadata: Json
          network: string | null
          notes: string | null
          policy_key: string
          policy_name: string
          required_external_approvals: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contract_reference?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          network?: string | null
          notes?: string | null
          policy_key: string
          policy_name: string
          required_external_approvals?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contract_reference?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          network?: string | null
          notes?: string | null
          policy_key?: string
          policy_name?: string
          required_external_approvals?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_guardian_multisig_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_proposal_guardian_external_signatures: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["governance_guardian_decision"]
          external_signer_id: string
          id: string
          payload_hash: string | null
          proposal_id: string
          rationale: string | null
          signature: string | null
          signature_reference: string | null
          signed_at: string
          signed_message: string | null
          snapshot: Json
          updated_at: string
          verification_method: string
          verified_at: string
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["governance_guardian_decision"]
          external_signer_id: string
          id?: string
          payload_hash?: string | null
          proposal_id: string
          rationale?: string | null
          signature?: string | null
          signature_reference?: string | null
          signed_at?: string
          signed_message?: string | null
          snapshot?: Json
          updated_at?: string
          verification_method?: string
          verified_at?: string
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["governance_guardian_decision"]
          external_signer_id?: string
          id?: string
          payload_hash?: string | null
          proposal_id?: string
          rationale?: string | null
          signature?: string | null
          signature_reference?: string | null
          signed_at?: string
          signed_message?: string | null
          snapshot?: Json
          updated_at?: string
          verification_method?: string
          verified_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_proposal_guardian_external_signatures_external_signer_id_fkey"
            columns: ["external_signer_id"]
            isOneToOne: false
            referencedRelation: "governance_guardian_external_signers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_guardian_external_signatures_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "governance_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_guardian_external_signatures_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_guardian_relay_nodes: {
        Row: {
          added_by: string | null
          created_at: string
          endpoint_url: string | null
          id: string
          is_active: boolean
          key_algorithm: string
          metadata: Json
          relay_key: string
          relay_label: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          key_algorithm?: string
          metadata?: Json
          relay_key: string
          relay_label?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          key_algorithm?: string
          metadata?: Json
          relay_key?: string
          relay_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_guardian_relay_nodes_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_guardian_relay_policies: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          metadata: Json
          notes: string | null
          policy_key: string
          policy_name: string
          require_chain_proof_match: boolean
          required_relay_attestations: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          notes?: string | null
          policy_key: string
          policy_name: string
          require_chain_proof_match?: boolean
          required_relay_attestations?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          notes?: string | null
          policy_key?: string
          policy_name?: string
          require_chain_proof_match?: boolean
          required_relay_attestations?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_guardian_relay_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_proposal_guardian_relay_attestations: {
        Row: {
          attestation_metadata: Json
          chain_network: string | null
          chain_reference: string | null
          created_at: string
          decision: Database["public"]["Enums"]["governance_guardian_decision"]
          external_signer_id: string
          id: string
          payload_hash: string | null
          proposal_id: string
          relay_id: string
          relay_reference: string | null
          status: Database["public"]["Enums"]["governance_guardian_relay_attestation_status"]
          updated_at: string
          verified_at: string
          verified_by: string | null
        }
        Insert: {
          attestation_metadata?: Json
          chain_network?: string | null
          chain_reference?: string | null
          created_at?: string
          decision: Database["public"]["Enums"]["governance_guardian_decision"]
          external_signer_id: string
          id?: string
          payload_hash?: string | null
          proposal_id: string
          relay_id: string
          relay_reference?: string | null
          status?: Database["public"]["Enums"]["governance_guardian_relay_attestation_status"]
          updated_at?: string
          verified_at?: string
          verified_by?: string | null
        }
        Update: {
          attestation_metadata?: Json
          chain_network?: string | null
          chain_reference?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["governance_guardian_decision"]
          external_signer_id?: string
          id?: string
          payload_hash?: string | null
          proposal_id?: string
          relay_id?: string
          relay_reference?: string | null
          status?: Database["public"]["Enums"]["governance_guardian_relay_attestation_status"]
          updated_at?: string
          verified_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_proposal_guardian_relay_attestations_external_signer_id_fkey"
            columns: ["external_signer_id"]
            isOneToOne: false
            referencedRelation: "governance_guardian_external_signers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_guardian_relay_attestations_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "governance_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_guardian_relay_attestations_relay_id_fkey"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "governance_guardian_relay_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_guardian_relay_attestations_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_public_audit_batch_items: {
        Row: {
          batch_id: string
          created_at: string
          event_actor_id: string | null
          event_created_at: string
          event_digest: string
          event_id: string
          event_payload: Json
          event_position: number
          event_source: string
          id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          event_actor_id?: string | null
          event_created_at: string
          event_digest: string
          event_id: string
          event_payload?: Json
          event_position: number
          event_source: string
          id?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          event_actor_id?: string | null
          event_created_at?: string
          event_digest?: string
          event_id?: string
          event_payload?: Json
          event_position?: number
          event_source?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_public_audit_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "governance_public_audit_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_public_audit_batch_items_event_actor_id_fkey"
            columns: ["event_actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_public_audit_batches: {
        Row: {
          anchor_network: string | null
          anchor_reference: string | null
          anchored_at: string | null
          batch_hash: string
          batch_index: number
          batch_scope: string
          batch_source: string
          created_at: string
          created_by: string | null
          event_count: number
          from_created_at: string | null
          id: string
          metadata: Json
          previous_batch_hash: string | null
          previous_batch_id: string | null
          to_created_at: string | null
          updated_at: string
        }
        Insert: {
          anchor_network?: string | null
          anchor_reference?: string | null
          anchored_at?: string | null
          batch_hash: string
          batch_index?: number
          batch_scope?: string
          batch_source?: string
          created_at?: string
          created_by?: string | null
          event_count?: number
          from_created_at?: string | null
          id?: string
          metadata?: Json
          previous_batch_hash?: string | null
          previous_batch_id?: string | null
          to_created_at?: string | null
          updated_at?: string
        }
        Update: {
          anchor_network?: string | null
          anchor_reference?: string | null
          anchored_at?: string | null
          batch_hash?: string
          batch_index?: number
          batch_scope?: string
          batch_source?: string
          created_at?: string
          created_by?: string | null
          event_count?: number
          from_created_at?: string | null
          id?: string
          metadata?: Json
          previous_batch_hash?: string | null
          previous_batch_id?: string | null
          to_created_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_public_audit_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_public_audit_batches_previous_batch_id_fkey"
            columns: ["previous_batch_id"]
            isOneToOne: false
            referencedRelation: "governance_public_audit_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_public_audit_batch_verifications: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          proof_payload: Json
          proof_reference: string | null
          status: Database["public"]["Enums"]["governance_public_audit_verification_status"]
          updated_at: string
          verification_hash: string | null
          verified_at: string
          verified_by: string | null
          verifier_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          proof_payload?: Json
          proof_reference?: string | null
          status: Database["public"]["Enums"]["governance_public_audit_verification_status"]
          updated_at?: string
          verification_hash?: string | null
          verified_at?: string
          verified_by?: string | null
          verifier_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          proof_payload?: Json
          proof_reference?: string | null
          status?: Database["public"]["Enums"]["governance_public_audit_verification_status"]
          updated_at?: string
          verification_hash?: string | null
          verified_at?: string
          verified_by?: string | null
          verifier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_public_audit_batch_verifications_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "governance_public_audit_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_public_audit_batch_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_public_audit_batch_verifications_verifier_id_fkey"
            columns: ["verifier_id"]
            isOneToOne: false
            referencedRelation: "governance_public_audit_verifier_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_public_audit_anchor_adapters: {
        Row: {
          adapter_key: string
          adapter_name: string
          added_by: string | null
          attestation_scheme: string
          created_at: string
          endpoint_url: string | null
          id: string
          is_active: boolean
          metadata: Json
          network: string
          updated_at: string
        }
        Insert: {
          adapter_key: string
          adapter_name: string
          added_by?: string | null
          attestation_scheme?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          network: string
          updated_at?: string
        }
        Update: {
          adapter_key?: string
          adapter_name?: string
          added_by?: string | null
          attestation_scheme?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          network?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_public_audit_anchor_adapters_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_public_audit_immutable_anchors: {
        Row: {
          adapter_id: string | null
          anchored_at: string
          anchored_by: string | null
          batch_id: string
          block_height: number | null
          created_at: string
          id: string
          immutable_reference: string
          network: string
          proof_payload: Json
        }
        Insert: {
          adapter_id?: string | null
          anchored_at?: string
          anchored_by?: string | null
          batch_id: string
          block_height?: number | null
          created_at?: string
          id?: string
          immutable_reference: string
          network: string
          proof_payload?: Json
        }
        Update: {
          adapter_id?: string | null
          anchored_at?: string
          anchored_by?: string | null
          batch_id?: string
          block_height?: number | null
          created_at?: string
          id?: string
          immutable_reference?: string
          network?: string
          proof_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "governance_public_audit_immutable_anchors_adapter_id_fkey"
            columns: ["adapter_id"]
            isOneToOne: false
            referencedRelation: "governance_public_audit_anchor_adapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_public_audit_immutable_anchors_anchored_by_fkey"
            columns: ["anchored_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_public_audit_immutable_anchors_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "governance_public_audit_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_public_audit_network_proofs: {
        Row: {
          batch_id: string
          block_height: number | null
          created_at: string
          id: string
          network: string
          proof_payload: Json
          proof_reference: string
          recorded_at: string
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          block_height?: number | null
          created_at?: string
          id?: string
          network: string
          proof_payload?: Json
          proof_reference: string
          recorded_at?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          block_height?: number | null
          created_at?: string
          id?: string
          network?: string
          proof_payload?: Json
          proof_reference?: string
          recorded_at?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_public_audit_network_proofs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "governance_public_audit_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_public_audit_network_proofs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_public_audit_replication_policies: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          metadata: Json
          notes: string | null
          policy_key: string
          policy_name: string
          required_network_proof_count: number
          required_verified_count: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          notes?: string | null
          policy_key: string
          policy_name: string
          required_network_proof_count?: number
          required_verified_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          notes?: string | null
          policy_key?: string
          policy_name?: string
          required_network_proof_count?: number
          required_verified_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_public_audit_replication_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_public_audit_verifier_nodes: {
        Row: {
          added_by: string | null
          created_at: string
          endpoint_url: string | null
          id: string
          is_active: boolean
          key_algorithm: string
          metadata: Json
          updated_at: string
          verifier_key: string
          verifier_label: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          key_algorithm?: string
          metadata?: Json
          updated_at?: string
          verifier_key: string
          verifier_label?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          key_algorithm?: string
          metadata?: Json
          updated_at?: string
          verifier_key?: string
          verifier_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_public_audit_verifier_nodes_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_public_audit_verifier_jobs: {
        Row: {
          batch_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          result_reference: string | null
          scheduled_at: string
          scheduled_by: string | null
          status: Database["public"]["Enums"]["governance_public_audit_verifier_job_status"]
          updated_at: string
          verifier_id: string
        }
        Insert: {
          batch_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          result_reference?: string | null
          scheduled_at?: string
          scheduled_by?: string | null
          status?: Database["public"]["Enums"]["governance_public_audit_verifier_job_status"]
          updated_at?: string
          verifier_id: string
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          result_reference?: string | null
          scheduled_at?: string
          scheduled_by?: string | null
          status?: Database["public"]["Enums"]["governance_public_audit_verifier_job_status"]
          updated_at?: string
          verifier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_public_audit_verifier_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "governance_public_audit_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_public_audit_verifier_jobs_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_public_audit_verifier_jobs_verifier_id_fkey"
            columns: ["verifier_id"]
            isOneToOne: false
            referencedRelation: "governance_public_audit_verifier_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_execution_unit_memberships: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          is_active: boolean
          membership_role: Database["public"]["Enums"]["governance_unit_membership_role"]
          notes: string | null
          profile_id: string
          unit_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          membership_role?: Database["public"]["Enums"]["governance_unit_membership_role"]
          notes?: string | null
          profile_id: string
          unit_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          membership_role?: Database["public"]["Enums"]["governance_unit_membership_role"]
          notes?: string | null
          profile_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_execution_unit_memberships_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_execution_unit_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_execution_unit_memberships_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "governance_execution_units"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_execution_units: {
        Row: {
          created_at: string
          description: string
          domain_key: string
          id: string
          is_active: boolean
          is_system_unit: boolean
          name: string
          unit_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          domain_key: string
          id?: string
          is_active?: boolean
          is_system_unit?: boolean
          name: string
          unit_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          domain_key?: string
          id?: string
          is_active?: boolean
          is_system_unit?: boolean
          name?: string
          unit_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      governance_execution_threshold_rules: {
        Row: {
          action_type: string
          approval_class: Database["public"]["Enums"]["governance_threshold_approval_class"]
          created_at: string
          decision_class: Database["public"]["Enums"]["governance_decision_class"] | null
          id: string
          is_active: boolean
          metadata: Json
          min_approval_share: number
          min_approval_votes: number
          min_decisive_votes: number
          min_quorum: number
          notes: string | null
          requires_window_close: boolean
          updated_at: string
        }
        Insert: {
          action_type: string
          approval_class?: Database["public"]["Enums"]["governance_threshold_approval_class"]
          created_at?: string
          decision_class?: Database["public"]["Enums"]["governance_decision_class"] | null
          id?: string
          is_active?: boolean
          metadata?: Json
          min_approval_share?: number
          min_approval_votes?: number
          min_decisive_votes?: number
          min_quorum?: number
          notes?: string | null
          requires_window_close?: boolean
          updated_at?: string
        }
        Update: {
          action_type?: string
          approval_class?: Database["public"]["Enums"]["governance_threshold_approval_class"]
          created_at?: string
          decision_class?: Database["public"]["Enums"]["governance_decision_class"] | null
          id?: string
          is_active?: boolean
          metadata?: Json
          min_approval_share?: number
          min_approval_votes?: number
          min_decisive_votes?: number
          min_quorum?: number
          notes?: string | null
          requires_window_close?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      governance_implementation_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          execution_status: Database["public"]["Enums"]["governance_implementation_status"]
          execution_summary: string
          id: string
          implementation_id: string
          proposal_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          execution_status: Database["public"]["Enums"]["governance_implementation_status"]
          execution_summary?: string
          id?: string
          implementation_id: string
          proposal_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          execution_status?: Database["public"]["Enums"]["governance_implementation_status"]
          execution_summary?: string
          id?: string
          implementation_id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_implementation_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_implementation_logs_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "governance_proposal_implementations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_implementation_logs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "governance_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_proposal_implementations: {
        Row: {
          assigned_at: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          implementation_summary: string
          metadata: Json
          proposal_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["governance_implementation_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          implementation_summary?: string
          metadata?: Json
          proposal_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["governance_implementation_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          implementation_summary?: string
          metadata?: Json
          proposal_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["governance_implementation_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_proposal_implementations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_implementations_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "governance_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_implementations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "governance_execution_units"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_proposal_votes: {
        Row: {
          choice: Database["public"]["Enums"]["governance_vote_choice"]
          created_at: string
          id: string
          proposal_id: string
          rationale: string | null
          snapshot: Json
          updated_at: string
          voter_id: string
          weight: number
        }
        Insert: {
          choice: Database["public"]["Enums"]["governance_vote_choice"]
          created_at?: string
          id?: string
          proposal_id: string
          rationale?: string | null
          snapshot?: Json
          updated_at?: string
          voter_id: string
          weight?: number
        }
        Update: {
          choice?: Database["public"]["Enums"]["governance_vote_choice"]
          created_at?: string
          id?: string
          proposal_id?: string
          rationale?: string | null
          snapshot?: Json
          updated_at?: string
          voter_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "governance_proposal_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "governance_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_proposal_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_proposals: {
        Row: {
          approval_threshold: number
          body: string
          bootstrap_mode: boolean
          closes_at: string
          created_at: string
          decision_class: Database["public"]["Enums"]["governance_decision_class"]
          eligible_voter_count_snapshot: number
          final_decision_summary: string | null
          id: string
          metadata: Json
          opens_at: string
          proposal_type: string
          proposer_id: string
          required_quorum: number
          resolved_at: string | null
          status: Database["public"]["Enums"]["governance_proposal_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_threshold?: number
          body?: string
          bootstrap_mode?: boolean
          closes_at?: string
          created_at?: string
          decision_class?: Database["public"]["Enums"]["governance_decision_class"]
          eligible_voter_count_snapshot?: number
          final_decision_summary?: string | null
          id?: string
          metadata?: Json
          opens_at?: string
          proposal_type?: string
          proposer_id: string
          required_quorum?: number
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["governance_proposal_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_threshold?: number
          body?: string
          bootstrap_mode?: boolean
          closes_at?: string
          created_at?: string
          decision_class?: Database["public"]["Enums"]["governance_decision_class"]
          eligible_voter_count_snapshot?: number
          final_decision_summary?: string | null
          id?: string
          metadata?: Json
          opens_at?: string
          proposal_type?: string
          proposer_id?: string
          required_quorum?: number
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["governance_proposal_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_proposals_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_sanction_appeals: {
        Row: {
          appeal_reason: string
          created_at: string
          evidence_notes: string | null
          id: string
          metadata: Json
          opened_at: string
          profile_id: string
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sanction_id: string
          status: Database["public"]["Enums"]["governance_sanction_appeal_status"]
          updated_at: string
        }
        Insert: {
          appeal_reason?: string
          created_at?: string
          evidence_notes?: string | null
          id?: string
          metadata?: Json
          opened_at?: string
          profile_id: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sanction_id: string
          status?: Database["public"]["Enums"]["governance_sanction_appeal_status"]
          updated_at?: string
        }
        Update: {
          appeal_reason?: string
          created_at?: string
          evidence_notes?: string | null
          id?: string
          metadata?: Json
          opened_at?: string
          profile_id?: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sanction_id?: string
          status?: Database["public"]["Enums"]["governance_sanction_appeal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_sanction_appeals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_sanction_appeals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_sanction_appeals_sanction_id_fkey"
            columns: ["sanction_id"]
            isOneToOne: false
            referencedRelation: "governance_sanctions"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_sanctions: {
        Row: {
          blocks_execution: boolean
          blocks_governance_all: boolean
          blocks_proposal_creation: boolean
          blocks_verification_review: boolean
          blocks_voting: boolean
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          issued_by: string | null
          lifted_at: string | null
          lifted_by: string | null
          metadata: Json
          notes: string | null
          profile_id: string
          reason: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          blocks_execution?: boolean
          blocks_governance_all?: boolean
          blocks_proposal_creation?: boolean
          blocks_verification_review?: boolean
          blocks_voting?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          issued_by?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          metadata?: Json
          notes?: string | null
          profile_id: string
          reason?: string
          starts_at?: string
          updated_at?: string
        }
        Update: {
          blocks_execution?: boolean
          blocks_governance_all?: boolean
          blocks_proposal_creation?: boolean
          blocks_verification_review?: boolean
          blocks_voting?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          issued_by?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          metadata?: Json
          notes?: string | null
          profile_id?: string
          reason?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_sanctions_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_sanctions_lifted_by_fkey"
            columns: ["lifted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_sanctions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_governance_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_source: string
          created_at: string
          domain_key: string
          ended_at: string | null
          id: string
          is_active: boolean
          metadata: Json
          notes: string | null
          profile_id: string
          role_key: string
          source_unit_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_source?: string
          created_at?: string
          domain_key: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          notes?: string | null
          profile_id: string
          role_key: string
          source_unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_source?: string
          created_at?: string
          domain_key?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          notes?: string | null
          profile_id?: string
          role_key?: string
          source_unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_governance_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_governance_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_governance_roles_role_fkey"
            columns: ["domain_key", "role_key"]
            isOneToOne: false
            referencedRelation: "governance_domain_roles"
            referencedColumns: ["domain_key", "role_key"]
          },
          {
            foreignKeyName: "profile_governance_roles_source_unit_id_fkey"
            columns: ["source_unit_id"]
            isOneToOne: false
            referencedRelation: "governance_execution_units"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_eligibility_snapshots: {
        Row: {
          calculated_at: string
          calculation_version: string
          citizenship_status: Database["public"]["Enums"]["citizenship_status"]
          created_at: string
          eligible: boolean
          governance_score: number
          id: string
          influence_weight: number
          is_active_citizen: boolean
          is_verified: boolean
          levela_score: number
          profile_id: string
          reason_codes: string[]
          source: string
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          calculation_version?: string
          citizenship_status: Database["public"]["Enums"]["citizenship_status"]
          created_at?: string
          eligible?: boolean
          governance_score?: number
          id?: string
          influence_weight?: number
          is_active_citizen?: boolean
          is_verified?: boolean
          levela_score?: number
          profile_id: string
          reason_codes?: string[]
          source?: string
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          calculation_version?: string
          citizenship_status?: Database["public"]["Enums"]["citizenship_status"]
          created_at?: string
          eligible?: boolean
          governance_score?: number
          id?: string
          influence_weight?: number
          is_active_citizen?: boolean
          is_verified?: boolean
          levela_score?: number
          profile_id?: string
          reason_codes?: string[]
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_eligibility_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verification_artifacts: {
        Row: {
          artifact_hash: string | null
          artifact_kind: Database["public"]["Enums"]["identity_verification_artifact_kind"]
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          storage_path: string | null
        }
        Insert: {
          artifact_hash?: string | null
          artifact_kind: Database["public"]["Enums"]["identity_verification_artifact_kind"]
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          storage_path?: string | null
        }
        Update: {
          artifact_hash?: string | null
          artifact_kind?: Database["public"]["Enums"]["identity_verification_artifact_kind"]
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_artifacts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "identity_verification_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verification_artifacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verification_cases: {
        Row: {
          contact_info_completed: boolean
          created_at: string
          discrepancy_flags: string[]
          id: string
          last_reviewed_by: string | null
          live_verification_completed: boolean
          metadata: Json
          notes: string | null
          personal_info_completed: boolean
          profile_id: string
          resolved_at: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["identity_verification_case_status"]
          submitted_at: string | null
          updated_at: string
          verification_method: string
        }
        Insert: {
          contact_info_completed?: boolean
          created_at?: string
          discrepancy_flags?: string[]
          id?: string
          last_reviewed_by?: string | null
          live_verification_completed?: boolean
          metadata?: Json
          notes?: string | null
          personal_info_completed?: boolean
          profile_id: string
          resolved_at?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["identity_verification_case_status"]
          submitted_at?: string | null
          updated_at?: string
          verification_method?: string
        }
        Update: {
          contact_info_completed?: boolean
          created_at?: string
          discrepancy_flags?: string[]
          id?: string
          last_reviewed_by?: string | null
          live_verification_completed?: boolean
          metadata?: Json
          notes?: string | null
          personal_info_completed?: boolean
          profile_id?: string
          resolved_at?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["identity_verification_case_status"]
          submitted_at?: string | null
          updated_at?: string
          verification_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_cases_last_reviewed_by_fkey"
            columns: ["last_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verification_cases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verification_reviews: {
        Row: {
          case_id: string
          created_at: string
          decision: Database["public"]["Enums"]["identity_verification_decision"]
          id: string
          notes: string | null
          reviewer_id: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          decision: Database["public"]["Enums"]["identity_verification_decision"]
          id?: string
          notes?: string | null
          reviewer_id?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["identity_verification_decision"]
          id?: string
          notes?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "identity_verification_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verification_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean | null
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_bookmarks: {
        Row: {
          created_at: string
          document_key: string
          id: string
          notes: string | null
          profile_id: string
          title: string
        }
        Insert: {
          created_at?: string
          document_key: string
          id?: string
          notes?: string | null
          profile_id: string
          title: string
        }
        Update: {
          created_at?: string
          document_key?: string
          id?: string
          notes?: string | null
          profile_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_bookmarks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_certifications: {
        Row: {
          certification_key: string
          created_at: string
          earned_at: string | null
          id: string
          metadata: Json
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          certification_key: string
          created_at?: string
          earned_at?: string | null
          id?: string
          metadata?: Json
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          certification_key?: string
          created_at?: string
          earned_at?: string | null
          id?: string
          metadata?: Json
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_certifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          document_key: string
          id: string
          last_read_at: string
          profile_id: string
          progress_percent: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          document_key: string
          id?: string
          last_read_at?: string
          profile_id: string
          progress_percent?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          document_key?: string
          id?: string
          last_read_at?: string
          profile_id?: string
          progress_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activation_scope_is_declared: {
        Args: {
          requested_country_code?: string
          requested_scope_type: Database["public"]["Enums"]["activation_scope_type"]
        }
        Returns: boolean
      }
      capture_all_governance_domain_maturity_snapshots: {
        Args: {
          measured_by_profile_id?: string
          snapshot_notes?: string
          snapshot_source?: string
        }
        Returns: number
      }
      capture_activation_demographic_snapshot: {
        Args: {
          measured_by_profile_id?: string
          requested_country_code?: string
          requested_scope_type: Database["public"]["Enums"]["activation_scope_type"]
          snapshot_notes?: string
          snapshot_source?: string
        }
        Returns: string
      }
      capture_governance_domain_maturity_snapshot: {
        Args: {
          measured_by_profile_id?: string
          requested_domain_key: string
          snapshot_notes?: string
          snapshot_source?: string
        }
        Returns: string
      }
      capture_governance_domain_maturity_snapshot_if_stale: {
        Args: {
          max_snapshot_age?: string
          measured_by_profile_id?: string
          requested_domain_key: string
          snapshot_notes?: string
          snapshot_source?: string
        }
        Returns: string | null
      }
      capture_governance_domain_maturity_snapshots_for_profile: {
        Args: {
          requested_profile_id: string
          snapshot_notes?: string
          snapshot_source?: string
        }
        Returns: number
      }
      capture_scheduled_governance_domain_maturity_snapshots: {
        Args: {
          max_snapshot_age?: string
          snapshot_notes?: string
          snapshot_source?: string
        }
        Returns: number
      }
      capture_scheduled_activation_demographic_snapshots: {
        Args: {
          snapshot_notes?: string
          snapshot_source?: string
        }
        Returns: number
      }
      capture_governance_public_audit_batch: {
        Args: {
          batch_source?: string
          created_by_profile_id?: string
          max_events?: number
          requested_from?: string
          requested_metadata?: Json
          requested_to?: string
        }
        Returns: string | null
      }
      can_contribute_to_content_category: {
        Args: { target_category_id: string; target_profile_id?: string }
        Returns: boolean
      }
      classify_content_category: {
        Args: {
          body_preview?: string
          content_type?: string
          source?: string
          title?: string
        }
        Returns: string
      }
      current_profile_has_governance_domain_role: {
        Args: { domain_keys: string[]; role_keys?: string[] }
        Returns: boolean
      }
      current_profile_can_manage_guardian_multisig: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_profile_can_manage_activation_demographic_feeds: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_profile_can_manage_guardian_relays: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_profile_can_manage_public_audit_verifiers: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_profile_is_guardian_signer: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_profile_is_maturity_steward: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_profile_in_governance_domain: {
        Args: { domain_keys: string[] }
        Returns: boolean
      }
      evaluate_governance_domain_maturity: {
        Args: { requested_domain_key: string }
        Returns: Json
      }
      governance_domain_is_mature: {
        Args: { requested_domain_key: string }
        Returns: boolean
      }
      governance_proposal_is_execution_ready: {
        Args: { target_proposal_id: string }
        Returns: boolean
      }
      governance_proposal_guardian_signoff_summary: {
        Args: { target_proposal_id: string }
        Returns: {
          approval_class: Database["public"]["Enums"]["governance_threshold_approval_class"]
          approval_count: number
          decisive_count: number
          meets_signoff: boolean
          rejection_count: number
          required_approvals: number
          requires_guardian_signoff: boolean
          requires_window_close: boolean
        }[]
      }
      governance_proposal_external_multisig_summary: {
        Args: { target_proposal_id: string }
        Returns: {
          active_external_signer_count: number
          external_approval_count: number
          external_decisive_count: number
          external_multisig_required: boolean
          external_rejection_count: number
          policy_contract_reference: string | null
          policy_network: string | null
          required_external_approvals: number
        }[]
      }
      governance_proposal_guardian_relay_summary: {
        Args: { target_proposal_id: string }
        Returns: {
          active_relay_count: number
          chain_proof_match_met: boolean
          external_approval_count: number
          policy_enabled: boolean
          relay_mismatch_count: number
          relay_quorum_met: boolean
          relay_unreachable_count: number
          relay_verified_count: number
          require_chain_proof_match: boolean
          required_relay_attestations: number
          signers_with_chain_proof_count: number
          signers_with_relay_quorum_count: number
        }[]
      }
      governance_public_audit_batch_verifier_summary: {
        Args: { target_batch_id: string }
        Returns: {
          active_verifier_count: number
          meets_replication_threshold: boolean
          mismatch_count: number
          network_proof_count: number
          policy_enabled: boolean
          required_network_proof_count: number
          required_verified_count: number
          unreachable_count: number
          verified_count: number
        }[]
      }
      governance_proposal_meets_guardian_signoff: {
        Args: { target_proposal_id: string }
        Returns: boolean
      }
      governance_proposal_meets_execution_threshold: {
        Args: { target_proposal_id: string }
        Returns: boolean
      }
      governance_proposal_requires_guardian_signoff: {
        Args: { target_proposal_id: string }
        Returns: boolean
      }
      map_governance_domain_role_from_unit_membership_role: {
        Args: {
          membership_role: Database["public"]["Enums"]["governance_unit_membership_role"]
        }
        Returns: string
      }
      list_pending_governance_public_audit_events: {
        Args: {
          max_events?: number
          requested_from?: string
          requested_to?: string
        }
        Returns: {
          event_actor_id: string | null
          event_created_at: string
          event_digest: string
          event_id: string
          event_payload: Json
          event_position: number
          event_source: string
        }[]
      }
      resolve_governance_execution_threshold_rule: {
        Args: {
          requested_action_type: string
          requested_decision_class: Database["public"]["Enums"]["governance_decision_class"]
        }
        Returns: {
          approval_class: Database["public"]["Enums"]["governance_threshold_approval_class"]
          min_approval_share: number
          min_decisive_votes: number
          min_approval_votes: number
          min_quorum: number
          requires_window_close: boolean
        }[]
      }
      normalize_activation_scope_country_code: {
        Args: {
          raw_country_code: string
          requested_scope_type: Database["public"]["Enums"]["activation_scope_type"]
        }
        Returns: string
      }
      ingest_signed_activation_demographic_feed_snapshot: {
        Args: {
          ingestion_metadata?: Json
          ingestion_notes?: string
          measured_by_profile_id?: string
          payload_hash?: string
          payload_signature?: string
          requested_observed_at?: string
          requested_source_url?: string
          requested_target_population: number
          signature_verified?: boolean
          signed_payload?: string
          target_adapter_id: string
        }
        Returns: string
      }
      profile_is_guardian_signer: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      record_governance_public_audit_anchor: {
        Args: {
          anchor_metadata?: Json
          anchor_network: string
          anchor_reference: string
          target_batch_id: string
        }
        Returns: boolean
      }
      record_governance_public_audit_batch_verification: {
        Args: {
          proof_payload?: Json
          proof_reference?: string
          target_batch_id: string
          target_verifier_id: string
          verification_hash?: string
          verification_status: Database["public"]["Enums"]["governance_public_audit_verification_status"]
          verified_at?: string
        }
        Returns: string
      }
      record_governance_public_audit_immutable_anchor: {
        Args: {
          immutable_reference?: string
          proof_block_height?: number
          proof_payload?: Json
          target_adapter_id?: string
          target_batch_id: string
          target_network?: string
        }
        Returns: string
      }
      complete_governance_public_audit_verifier_job: {
        Args: {
          completion_status: Database["public"]["Enums"]["governance_public_audit_verifier_job_status"]
          error_message?: string
          proof_payload?: Json
          proof_reference?: string
          target_job_id: string
          verification_hash?: string
          verification_status?: Database["public"]["Enums"]["governance_public_audit_verification_status"]
        }
        Returns: string
      }
      record_governance_public_audit_network_proof: {
        Args: {
          proof_block_height?: number
          proof_network: string
          proof_payload?: Json
          proof_reference: string
          target_batch_id: string
        }
        Returns: string
      }
      register_governance_public_audit_verifier_node: {
        Args: {
          endpoint_url?: string
          key_algorithm?: string
          metadata?: Json
          verifier_key: string
          verifier_label?: string
        }
        Returns: string
      }
      register_activation_demographic_feed_adapter: {
        Args: {
          adapter_key: string
          adapter_name: string
          adapter_type?: Database["public"]["Enums"]["activation_demographic_feed_adapter_type"]
          country_code?: string
          endpoint_url?: string
          key_algorithm?: string
          metadata?: Json
          public_signer_key?: string
          scope_type?: Database["public"]["Enums"]["activation_scope_type"]
        }
        Returns: string
      }
      register_governance_guardian_relay_node: {
        Args: {
          endpoint_url?: string
          key_algorithm?: string
          metadata?: Json
          relay_key: string
          relay_label?: string
        }
        Returns: string
      }
      register_governance_public_audit_anchor_adapter: {
        Args: {
          adapter_key: string
          adapter_name: string
          attestation_scheme?: string
          endpoint_url?: string
          metadata?: Json
          network: string
        }
        Returns: string
      }
      record_governance_guardian_relay_attestation: {
        Args: {
          attestation_chain_network?: string
          attestation_chain_reference?: string
          attestation_decision: Database["public"]["Enums"]["governance_guardian_decision"]
          attestation_metadata?: Json
          attestation_payload_hash?: string
          attestation_reference?: string
          attestation_status?: Database["public"]["Enums"]["governance_guardian_relay_attestation_status"]
          target_external_signer_id: string
          target_proposal_id: string
          target_relay_id: string
          verified_at?: string
        }
        Returns: string
      }
      run_governance_public_audit_verifier_cycle: {
        Args: {
          target_batch_id?: string
        }
        Returns: number
      }
      schedule_governance_public_audit_verifier_jobs: {
        Args: {
          force_reschedule?: boolean
          target_batch_id?: string
        }
        Returns: number
      }
      verify_governance_public_audit_chain: {
        Args: { max_batches?: number }
        Returns: Json
      }
      profile_has_governance_domain_role: {
        Args: {
          domain_keys: string[]
          role_keys?: string[]
          target_profile_id: string
        }
        Returns: boolean
      }
      profile_has_approved_profession: {
        Args: { allowed_professions: string[]; target_profile_id: string }
        Returns: boolean
      }
      resolve_login_email: {
        Args: { identifier: string }
        Returns: string | null
      }
    }
    Enums: {
      activation_review_decision:
        | "approve"
        | "reject"
        | "request_changes"
        | "declare_activation"
        | "revoke_activation"
      activation_review_status:
        | "pre_activation"
        | "pending_review"
        | "approved_for_activation"
        | "activated"
        | "rejected"
        | "revoked"
      activation_scope_type:
        | "country"
        | "world"
      activation_demographic_feed_adapter_type:
        | "signed_json_feed"
        | "oracle_attestation"
        | "manual_signed_import"
      constitutional_office_key: "founder"
      app_permission:
        | "law.read"
        | "law.contribute"
        | "law.review"
        | "content.read"
        | "content.contribute_unmoderated"
        | "content.contribute_moderated"
        | "content.review"
        | "content.moderate"
        | "profession.verify"
        | "build.use"
        | "profile.read"
        | "profile.update_self"
        | "profile.update_any"
        | "post.create"
        | "post.edit_self"
        | "post.delete_self"
        | "post.moderate"
        | "comment.create"
        | "comment.edit_self"
        | "comment.delete_self"
        | "comment.moderate"
        | "message.create"
        | "message.edit_self"
        | "message.moderate"
        | "endorsement.create"
        | "endorsement.review"
        | "endorsement.moderate"
        | "report.create"
        | "report.review"
        | "market.manage"
        | "role.assign"
        | "settings.manage"
        | "like.create"
        | "like.delete_self"
      app_role:
        | "guest"
        | "member"
        | "citizen"
        | "verified_member"
        | "certified"
        | "moderator"
        | "market_manager"
        | "founder"
        | "admin"
        | "system"
      citizenship_status:
        | "registered_member"
        | "verified_member"
        | "citizen"
      content_moderation_lane:
        | "unmoderated"
        | "moderated"
      content_review_status:
        | "draft"
        | "proposed"
        | "in_review"
        | "changes_requested"
        | "approved"
        | "rejected"
        | "archived"
      law_contribution_status:
        | "pending"
        | "approved"
        | "changes_requested"
        | "rejected"
      law_contribution_type:
        | "source"
        | "structure"
        | "summary"
      law_track:
        | "civil"
        | "criminal"
      identity_verification_artifact_kind:
        | "personal_info"
        | "contact_info"
        | "live_presence"
        | "duplicate_check"
        | "supporting_document"
      identity_verification_case_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "approved"
        | "rejected"
        | "revoked"
      identity_verification_decision:
        | "approved"
        | "rejected"
        | "revoked"
      governance_decision_class:
        | "ordinary"
        | "elevated"
        | "constitutional"
      governance_block_scope:
        | "proposal_create"
        | "vote"
        | "verification_review"
        | "execution"
      governance_guardian_decision:
        | "approve"
        | "reject"
      governance_guardian_relay_attestation_status:
        | "verified"
        | "mismatch"
        | "unreachable"
      governance_public_audit_verification_status:
        | "verified"
        | "mismatch"
        | "unreachable"
      governance_public_audit_verifier_job_status:
        | "pending"
        | "completed"
        | "failed"
        | "cancelled"
      governance_implementation_status:
        | "queued"
        | "in_progress"
        | "completed"
        | "blocked"
        | "cancelled"
      governance_threshold_approval_class:
        | "ordinary_majority"
        | "supermajority"
        | "guardian_threshold"
      governance_proposal_status:
        | "open"
        | "approved"
        | "rejected"
        | "cancelled"
      governance_sanction_appeal_status:
        | "open"
        | "under_review"
        | "accepted"
        | "rejected"
        | "withdrawn"
      governance_unit_membership_role:
        | "lead"
        | "member"
        | "observer"
      governance_vote_choice:
        | "approve"
        | "reject"
        | "abstain"
      pillar_type:
        | "education_skills"
        | "culture_ethics"
        | "responsibility_reliability"
        | "environment_community"
        | "economy_contribution"
      profession_verification_status:
        | "pending"
        | "approved"
        | "suspended"
        | "revoked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activation_review_decision: [
        "approve",
        "reject",
        "request_changes",
        "declare_activation",
        "revoke_activation",
      ],
      activation_review_status: [
        "pre_activation",
        "pending_review",
        "approved_for_activation",
        "activated",
        "rejected",
        "revoked",
      ],
      activation_scope_type: [
        "country",
        "world",
      ],
      constitutional_office_key: ["founder"],
      app_permission: [
        "law.read",
        "law.contribute",
        "law.review",
        "content.read",
        "content.contribute_unmoderated",
        "content.contribute_moderated",
        "content.review",
        "content.moderate",
        "profession.verify",
        "build.use",
        "profile.read",
        "profile.update_self",
        "profile.update_any",
        "post.create",
        "post.edit_self",
        "post.delete_self",
        "post.moderate",
        "comment.create",
        "comment.edit_self",
        "comment.delete_self",
        "comment.moderate",
        "message.create",
        "message.edit_self",
        "message.moderate",
        "endorsement.create",
        "endorsement.review",
        "endorsement.moderate",
        "report.create",
        "report.review",
        "market.manage",
        "role.assign",
        "settings.manage",
        "like.create",
        "like.delete_self",
      ],
      app_role: [
        "guest",
        "member",
        "citizen",
        "verified_member",
        "certified",
        "moderator",
        "market_manager",
        "founder",
        "admin",
        "system",
      ],
      citizenship_status: [
        "registered_member",
        "verified_member",
        "citizen",
      ],
      content_moderation_lane: [
        "unmoderated",
        "moderated",
      ],
      content_review_status: [
        "draft",
        "proposed",
        "in_review",
        "changes_requested",
        "approved",
        "rejected",
        "archived",
      ],
      identity_verification_artifact_kind: [
        "personal_info",
        "contact_info",
        "live_presence",
        "duplicate_check",
        "supporting_document",
      ],
      identity_verification_case_status: [
        "draft",
        "submitted",
        "in_review",
        "approved",
        "rejected",
        "revoked",
      ],
      identity_verification_decision: [
        "approved",
        "rejected",
        "revoked",
      ],
      governance_decision_class: [
        "ordinary",
        "elevated",
        "constitutional",
      ],
      governance_block_scope: [
        "proposal_create",
        "vote",
        "verification_review",
        "execution",
      ],
      governance_guardian_decision: [
        "approve",
        "reject",
      ],
      governance_implementation_status: [
        "queued",
        "in_progress",
        "completed",
        "blocked",
        "cancelled",
      ],
      governance_threshold_approval_class: [
        "ordinary_majority",
        "supermajority",
        "guardian_threshold",
      ],
      governance_proposal_status: [
        "open",
        "approved",
        "rejected",
        "cancelled",
      ],
      governance_sanction_appeal_status: [
        "open",
        "under_review",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      governance_unit_membership_role: [
        "lead",
        "member",
        "observer",
      ],
      governance_vote_choice: [
        "approve",
        "reject",
        "abstain",
      ],
      pillar_type: [
        "education_skills",
        "culture_ethics",
        "responsibility_reliability",
        "environment_community",
        "economy_contribution",
      ],
      profession_verification_status: [
        "pending",
        "approved",
        "suspended",
        "revoked",
      ],
    },
  },
} as const
