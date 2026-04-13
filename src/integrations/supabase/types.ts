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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          country_code: string | null
          created_at: string
          custom_permissions: Database["public"]["Enums"]["app_permission"][]
          date_of_birth: string | null
          denied_permissions: Database["public"]["Enums"]["app_permission"][]
          full_name: string | null
          full_name_change_count: number | null
          full_name_last_changed_at: string | null
          granted_permissions: Database["public"]["Enums"]["app_permission"][]
          id: string
          is_admin: boolean | null
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
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          custom_permissions?: Database["public"]["Enums"]["app_permission"][]
          date_of_birth?: string | null
          denied_permissions?: Database["public"]["Enums"]["app_permission"][]
          full_name?: string | null
          full_name_change_count?: number | null
          full_name_last_changed_at?: string | null
          granted_permissions?: Database["public"]["Enums"]["app_permission"][]
          id?: string
          is_admin?: boolean | null
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
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          custom_permissions?: Database["public"]["Enums"]["app_permission"][]
          date_of_birth?: string | null
          denied_permissions?: Database["public"]["Enums"]["app_permission"][]
          full_name?: string | null
          full_name_change_count?: number | null
          full_name_last_changed_at?: string | null
          granted_permissions?: Database["public"]["Enums"]["app_permission"][]
          id?: string
          is_admin?: boolean | null
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
        | "verified_member"
        | "certified"
        | "moderator"
        | "market_manager"
        | "founder"
        | "admin"
        | "system"
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
        "verified_member",
        "certified",
        "moderator",
        "market_manager",
        "founder",
        "admin",
        "system",
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
